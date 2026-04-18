import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { mail_accounts } from '../db/schema';
import { syncAccount } from './imap-sync';
import { syncCalDAV } from './caldav-sync';
import { syncCardDAV } from './carddav-sync';
import { processScheduledEmails } from './send-later';

const IMAP_INTERVAL_MS      = 5 * 60 * 1000;   // 5 minutes
const DAV_INTERVAL_MS       = 15 * 60 * 1000;  // 15 minutes
const SEND_LATER_INTERVAL_MS = 60 * 1000;       // 1 minute

let imapTimer:      ReturnType<typeof setInterval> | null = null;
let davTimer:       ReturnType<typeof setInterval> | null = null;
let sendLaterTimer: ReturnType<typeof setInterval> | null = null;

async function runImapSyncs(): Promise<void> {
  const accounts = await db
    .select()
    .from(mail_accounts)
    .where(eq(mail_accounts.status, 'active'));

  await Promise.allSettled(
    accounts.map(async (account) => {
      try {
        await syncAccount(account);
      } catch (err) {
        console.error(`[scheduler:imap] ${account.email}:`, err);
        await db
          .update(mail_accounts)
          .set({ status: 'error' })
          .where(eq(mail_accounts.id, account.id));
      }
    })
  );
}

async function runDavSyncs(): Promise<void> {
  const accounts = await db
    .select()
    .from(mail_accounts)
    .where(eq(mail_accounts.status, 'active'));

  await Promise.allSettled(
    accounts.map(async (account) => {
      if (account.caldav_url) {
        try { await syncCalDAV(account); } catch (err) {
          console.error(`[scheduler:caldav] ${account.email}:`, err);
        }
      }
      if (account.carddav_url) {
        try { await syncCardDAV(account); } catch (err) {
          console.error(`[scheduler:carddav] ${account.email}:`, err);
        }
      }
    })
  );
}

export function startScheduler(): void {
  if (imapTimer) return;

  // Stagger startup: IMAP at 10s, DAV at 20s, send-later at 5s
  setTimeout(() => runImapSyncs().catch(console.error),             10_000);
  setTimeout(() => runDavSyncs().catch(console.error),              20_000);
  setTimeout(() => processScheduledEmails().catch(console.error),   5_000);

  imapTimer      = setInterval(() => runImapSyncs().catch(console.error),             IMAP_INTERVAL_MS);
  davTimer       = setInterval(() => runDavSyncs().catch(console.error),              DAV_INTERVAL_MS);
  sendLaterTimer = setInterval(() => processScheduledEmails().catch(console.error),   SEND_LATER_INTERVAL_MS);

  console.log(`[scheduler] IMAP every ${IMAP_INTERVAL_MS / 60_000}m, DAV every ${DAV_INTERVAL_MS / 60_000}m, send-later every ${SEND_LATER_INTERVAL_MS / 1000}s`);
}

export function stopScheduler(): void {
  if (imapTimer)      { clearInterval(imapTimer);      imapTimer      = null; }
  if (davTimer)       { clearInterval(davTimer);        davTimer       = null; }
  if (sendLaterTimer) { clearInterval(sendLaterTimer);  sendLaterTimer = null; }
}

export { runImapSyncs as runAllSyncs, runDavSyncs };
