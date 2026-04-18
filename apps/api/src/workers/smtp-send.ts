import nodemailer from 'nodemailer';
import { decrypt } from '../lib/crypto';
import { mail_accounts } from '../db/schema';

type AccountRow = typeof mail_accounts.$inferSelect;

interface SendOptions {
  from: string;
  to: string;
  cc?: string;
  subject: string;
  text?: string;
  html?: string;
  inReplyTo?: string;
  references?: string;
}

export async function sendEmail(account: AccountRow, opts: SendOptions): Promise<string> {
  const raw = decrypt(account.encrypted_credential as Buffer);
  const credential = JSON.parse(raw) as { username: string; password: string };

  const port = account.smtp_port ?? 587;
  const transporter = nodemailer.createTransport({
    host: account.smtp_host!,
    port,
    secure: port === 465,
    auth: { user: credential.username, pass: credential.password },
    tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  });

  const info = await transporter.sendMail({
    from: opts.from,
    to: opts.to,
    cc: opts.cc,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    inReplyTo: opts.inReplyTo,
    references: opts.references,
  });

  return info.messageId as string;
}
