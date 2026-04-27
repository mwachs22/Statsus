import { createDAVClient } from 'tsdav';
import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db';
import { mail_accounts, contacts, dav_sync_state } from '../db/schema';
import { decrypt } from '../lib/crypto';
import { parseVCard } from '../lib/vcard-parser';
import { validateEndpointUrl } from '../lib/ssrf-guard';

type AccountRow = typeof mail_accounts.$inferSelect;

export async function syncCardDAV(account: AccountRow): Promise<void> {
  if (!account.carddav_url) return;

  // SSRF guard: validate the CardDAV URL before connecting
  await validateEndpointUrl(account.carddav_url);

  const raw = decrypt(account.encrypted_credential as Buffer);
  const credential = JSON.parse(raw) as { username: string; password: string };

  const client = await createDAVClient({
    serverUrl: account.carddav_url,
    credentials: { username: credential.username, password: credential.password },
    authMethod: 'Basic',
    defaultAccountType: 'carddav',
  });

  const addressBooks = await client.fetchAddressBooks();

  for (const aBook of addressBooks) {
    if (!aBook.url) continue;
    try {
      await syncOneAddressBook(client, account, aBook);
    } catch (err) {
      console.error(`[carddav] address book "${aBook.displayName}" failed:`, err);
    }
  }
}

async function syncOneAddressBook(
  client: Awaited<ReturnType<typeof createDAVClient>>,
  account: AccountRow,
  aBook: { url: string; ctag?: string; displayName?: string }
): Promise<void> {
  const [state] = await db
    .select()
    .from(dav_sync_state)
    .where(
      and(
        eq(dav_sync_state.account_id, account.id),
        eq(dav_sync_state.type, 'carddav'),
        eq(dav_sync_state.url, aBook.url)
      )
    )
    .limit(1);

  if (state?.ctag && state.ctag === aBook.ctag) {
    await db
      .update(dav_sync_state)
      .set({ last_synced_at: new Date() })
      .where(eq(dav_sync_state.id, state.id));
    return;
  }

  const vCards = await client.fetchVCards({
    addressBook: aBook as Parameters<typeof client.fetchVCards>[0]['addressBook'],
  });

  const toInsert: Array<typeof contacts.$inferInsert> = [];

  for (const vcard of vCards) {
    if (!vcard.data) continue;
    const parsed = parseVCard(vcard.data);

    // Skip entries with no usable identity
    if (!parsed.full_name && parsed.emails.length === 0) continue;

    const uid = parsed.uid ?? vcard.url ?? `${account.id}:${Math.random()}`;

    toInsert.push({
      account_id: account.id,
      uid,
      href: vcard.url ?? null,
      etag: vcard.etag ?? null,
      full_name: parsed.full_name ?? null,
      first_name: parsed.first_name ?? null,
      last_name: parsed.last_name ?? null,
      emails: parsed.emails as unknown as Record<string, string>[],
      phones: parsed.phones as unknown as Record<string, string>[],
      organization: parsed.organization ?? null,
      title: parsed.title ?? null,
      photo_url: parsed.photo_url ?? null,
      notes: parsed.notes ?? null,
      raw_vcard: vcard.data,
    });
  }

  for (let i = 0; i < toInsert.length; i += 100) {
    const batch = toInsert.slice(i, i + 100);
    if (batch.length === 0) continue;
    await db
      .insert(contacts)
      .values(batch)
      .onConflictDoUpdate({
        target: [contacts.account_id, contacts.uid],
        set: {
          full_name: contacts.full_name,
          first_name: contacts.first_name,
          last_name: contacts.last_name,
          emails: contacts.emails,
          phones: contacts.phones,
          organization: contacts.organization,
          title: contacts.title,
          photo_url: contacts.photo_url,
          notes: contacts.notes,
          etag: contacts.etag,
          raw_vcard: contacts.raw_vcard,
        },
      });
  }

  if (state) {
    await db
      .update(dav_sync_state)
      .set({ ctag: aBook.ctag ?? null, last_synced_at: new Date() })
      .where(eq(dav_sync_state.id, state.id));
  } else {
    await db.insert(dav_sync_state).values({
      account_id: account.id,
      type: 'carddav',
      url: aBook.url,
      ctag: aBook.ctag ?? null,
      last_synced_at: new Date(),
    });
  }
}
