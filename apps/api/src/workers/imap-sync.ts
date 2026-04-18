import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db';
import { mail_accounts, messages, sync_state } from '../db/schema';
import { decrypt } from '../lib/crypto';
import { resolveThreadId } from './thread-builder';
import { applyFiltersToMessages } from '../lib/filter-engine';

type AccountRow = typeof mail_accounts.$inferSelect;

const FOLDERS_TO_SYNC = ['INBOX', 'Sent', 'Drafts', 'Trash'];
const INITIAL_FETCH_LIMIT = 200; // cap first sync to avoid huge imports

export async function syncAccount(account: AccountRow): Promise<void> {
  const raw = decrypt(account.encrypted_credential as Buffer);
  const credential = JSON.parse(raw) as { username: string; password: string };

  const client = new ImapFlow({
    host: account.imap_host!,
    port: account.imap_port ?? 993,
    secure: (account.imap_port ?? 993) === 993,
    auth: { user: credential.username, pass: credential.password },
    logger: false,
    tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  });

  try {
    await client.connect();

    for (const folder of FOLDERS_TO_SYNC) {
      try {
        await syncFolder(client, account, folder);
      } catch (err) {
        console.error(`[sync] folder ${folder} failed for ${account.email}:`, err);
      }
    }
  } finally {
    try { await client.logout(); } catch { /* ignore */ }
  }

  // Mark account as active after successful sync
  await db.update(mail_accounts).set({ status: 'active' }).where(eq(mail_accounts.id, account.id));
}

async function syncFolder(
  client: ImapFlow,
  account: AccountRow,
  folderName: string
): Promise<void> {
  let lock;
  try {
    lock = await client.getMailboxLock(folderName);
  } catch {
    // Folder doesn't exist on this account (e.g. some servers have "Sent Mail" not "Sent")
    return;
  }

  try {
    const [state] = await db
      .select()
      .from(sync_state)
      .where(and(eq(sync_state.account_id, account.id), eq(sync_state.folder, folderName)))
      .limit(1);

    const uidValidity = (client.mailbox as { uidValidity?: number }).uidValidity;

    // Reset if uidValidity changed (mailbox was recreated)
    const lastUid =
      state && state.uid_validity === uidValidity ? (state.last_uid ?? 0) : 0;

    const isInitialSync = lastUid === 0;
    let newLastUid = lastUid;

    // Build UID range: on initial sync cap at last N messages to avoid huge fetch
    let range: string;
    if (isInitialSync) {
      const count = (client.mailbox as { exists?: number }).exists ?? 0;
      const startSeq = Math.max(1, count - INITIAL_FETCH_LIMIT + 1);
      range = `${startSeq}:*`;
    } else {
      range = `${lastUid + 1}:*`;
    }

    const fetched: Array<typeof messages.$inferInsert> = [];

    for await (const msg of client.fetch(
      range,
      { uid: true, flags: true, source: true, internalDate: true },
      { uid: isInitialSync ? false : true } // initial sync uses seq range, subsequent use UID range
    )) {
      if (!msg.source) continue;

      const parsed = await simpleParser(msg.source);

      const fromAddr = parsed.from?.value[0]?.address ?? '';

      const flatAddresses = (
        field: typeof parsed.to
      ): string => {
        if (!field) return '';
        const objs = Array.isArray(field) ? field : [field];
        return objs.flatMap((o) => o.value.map((a) => a.address ?? '')).filter(Boolean).join(', ');
      };

      const toAddr = flatAddresses(parsed.to);
      const ccAddr = flatAddresses(parsed.cc);

      const rawMessageId = parsed.messageId?.replace(/[<>]/g, '').trim() ?? null;
      const inReplyTo = parsed.inReplyTo?.replace(/[<>]/g, '').trim() ?? null;
      const refs = parsed.references
        ? (Array.isArray(parsed.references)
            ? parsed.references.map((r) => r.replace(/[<>]/g, '').trim())
            : parsed.references.split(/\s+/).map((r) => r.replace(/[<>]/g, '').trim()))
        : [];

      // Skip if we already have this message (by message_id)
      if (rawMessageId) {
        const existing = await db
          .select({ id: messages.id })
          .from(messages)
          .where(and(eq(messages.account_id, account.id), eq(messages.message_id, rawMessageId)))
          .limit(1);
        if (existing.length > 0) {
          if (msg.uid > newLastUid) newLastUid = msg.uid;
          continue;
        }
      }

      const threadId = await resolveThreadId(inReplyTo, refs);

      const preview = (parsed.text ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200);

      fetched.push({
        account_id: account.id,
        thread_id: threadId,
        folder: folderName,
        from_addr: fromAddr,
        to_addr: toAddr,
        cc_addr: ccAddr,
        subject: parsed.subject ?? '(no subject)',
        body_preview: preview,
        text_body: parsed.text ?? null,
        html_body: typeof parsed.html === 'string' ? parsed.html : null,
        flags: [...(msg.flags ?? [])],
        date: parsed.date ?? msg.internalDate ?? new Date(),
        size: msg.source.length,
        uid: msg.uid,
        message_id: rawMessageId,
        in_reply_to: inReplyTo,
        references_ids: refs.length > 0 ? refs : null,
      });

      if (msg.uid > newLastUid) newLastUid = msg.uid;
    }

    if (fetched.length > 0) {
      const insertedForFilters: Array<{
        id: string; from_addr: string | null; to_addr: string | null;
        subject: string | null; body_preview: string | null; text_body: string | null;
      }> = [];

      // Insert in batches of 50; capture IDs of INBOX messages for filter evaluation
      for (let i = 0; i < fetched.length; i += 50) {
        const batch = fetched.slice(i, i + 50);
        const inserted = await db.insert(messages).values(batch).returning({
          id: messages.id, folder: messages.folder,
        });
        if (folderName === 'INBOX' && account.user_id) {
          for (let j = 0; j < inserted.length; j++) {
            const src = batch[j];
            insertedForFilters.push({
              id: inserted[j].id,
              from_addr: src.from_addr ?? null,
              to_addr: src.to_addr ?? null,
              subject: src.subject ?? null,
              body_preview: src.body_preview ?? null,
              text_body: src.text_body ?? null,
            });
          }
        }
      }

      // Run filter engine on new INBOX messages (best-effort; don't fail sync on error)
      if (insertedForFilters.length > 0 && account.user_id) {
        applyFiltersToMessages(account.user_id, insertedForFilters).catch((err) =>
          console.error('[filter-engine] error:', err)
        );
      }
    }

    // Upsert sync state
    if (state) {
      await db
        .update(sync_state)
        .set({ last_uid: newLastUid, uid_validity: uidValidity, last_synced_at: new Date() })
        .where(eq(sync_state.id, state.id));
    } else {
      await db.insert(sync_state).values({
        account_id: account.id,
        folder: folderName,
        last_uid: newLastUid,
        uid_validity: uidValidity,
        last_synced_at: new Date(),
      });
    }
  } finally {
    lock.release();
  }
}
