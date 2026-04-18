import { lte, eq, and } from 'drizzle-orm';
import { db } from '../lib/db';
import { scheduled_emails, mail_accounts } from '../db/schema';
import { sendEmail } from './smtp-send';

interface RawMessage {
  to: string;
  cc?: string;
  subject: string;
  text?: string;
  html?: string;
  in_reply_to?: string;
  references?: string;
}

export async function processScheduledEmails(): Promise<void> {
  const due = await db
    .select({ se: scheduled_emails, acct: mail_accounts })
    .from(scheduled_emails)
    .leftJoin(mail_accounts, eq(scheduled_emails.account_id, mail_accounts.id))
    .where(
      and(
        eq(scheduled_emails.status, 'queued'),
        lte(scheduled_emails.scheduled_at, new Date())
      )
    );

  if (due.length === 0) return;

  await Promise.allSettled(
    due.map(async ({ se, acct }) => {
      if (!acct) {
        await db.update(scheduled_emails).set({ status: 'failed' }).where(eq(scheduled_emails.id, se.id));
        return;
      }

      try {
        const msg = se.raw_message as RawMessage;
        await sendEmail(acct, {
          from: acct.email,
          to: msg.to,
          cc: msg.cc,
          subject: msg.subject,
          text: msg.text,
          html: msg.html,
          inReplyTo: msg.in_reply_to,
          references: msg.references,
        });
        await db.update(scheduled_emails).set({ status: 'sent' }).where(eq(scheduled_emails.id, se.id));
      } catch (err) {
        const retries = (se.retry_count ?? 0) + 1;
        await db.update(scheduled_emails).set({
          retry_count: retries,
          status: retries >= 3 ? 'failed' : 'queued',
        }).where(eq(scheduled_emails.id, se.id));
        console.error(`[send-later] ${se.id} failed (attempt ${retries}):`, err);
      }
    })
  );
}
