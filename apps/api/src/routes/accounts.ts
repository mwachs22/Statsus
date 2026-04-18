import { FastifyInstance } from 'fastify';
import { ImapFlow } from 'imapflow';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../lib/db';
import { mail_accounts } from '../db/schema';
import { encrypt } from '../lib/crypto';
import { syncAccount } from '../workers/imap-sync';
import { assertAccountScope } from '../lib/assert-account';

const AddAccountBody = z.object({
  email: z.string().email(),
  imap_host: z.string().min(1),
  imap_port: z.number().int().default(993),
  smtp_host: z.string().min(1),
  smtp_port: z.number().int().default(587),
  username: z.string().min(1),
  password: z.string().min(1),
  caldav_url: z.string().url().optional(),
  carddav_url: z.string().url().optional(),
});

async function testImapConnection(
  host: string,
  port: number,
  username: string,
  password: string
): Promise<void> {
  const client = new ImapFlow({
    host,
    port,
    secure: port === 993,
    auth: { user: username, pass: password },
    logger: false,
    tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  });
  try {
    await client.connect();
  } finally {
    try { await client.logout(); } catch { /* ignore */ }
  }
}

export async function accountRoutes(fastify: FastifyInstance) {
  // List accounts for the current user
  fastify.get(
    '/api/accounts',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const accounts = await db
        .select({
          id: mail_accounts.id,
          email: mail_accounts.email,
          imap_host: mail_accounts.imap_host,
          imap_port: mail_accounts.imap_port,
          smtp_host: mail_accounts.smtp_host,
          smtp_port: mail_accounts.smtp_port,
          caldav_url: mail_accounts.caldav_url,
          carddav_url: mail_accounts.carddav_url,
          status: mail_accounts.status,
          is_default: mail_accounts.is_default,
          created_at: mail_accounts.created_at,
        })
        .from(mail_accounts)
        .where(eq(mail_accounts.user_id, request.user.id));

      return { accounts };
    }
  );

  // Add a new mail account
  fastify.post(
    '/api/accounts',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const parsed = AddAccountBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
      }

      const { email, imap_host, imap_port, smtp_host, smtp_port, username, password, caldav_url, carddav_url } = parsed.data;

      // Test IMAP credentials before storing
      try {
        await testImapConnection(imap_host, imap_port, username, password);
      } catch (err) {
        return reply.code(422).send({
          error: 'Could not connect to IMAP server. Check your credentials and settings.',
          detail: (err as Error).message,
        });
      }

      const credential = JSON.stringify({ username, password });
      const encrypted = encrypt(credential);

      // First account is the default
      const existing = await db
        .select({ id: mail_accounts.id })
        .from(mail_accounts)
        .where(eq(mail_accounts.user_id, request.user.id))
        .limit(1);

      const [account] = await db
        .insert(mail_accounts)
        .values({
          user_id: request.user.id,
          email,
          imap_host,
          imap_port,
          smtp_host,
          smtp_port,
          caldav_url: caldav_url ?? null,
          carddav_url: carddav_url ?? null,
          encrypted_credential: encrypted,
          is_default: existing.length === 0,
          status: 'active',
        })
        .returning({
          id: mail_accounts.id,
          email: mail_accounts.email,
          status: mail_accounts.status,
          is_default: mail_accounts.is_default,
        });

      // Kick off initial sync in background (don't await)
      db.select().from(mail_accounts).where(eq(mail_accounts.id, account.id))
        .limit(1)
        .then(([full]) => {
          if (full) syncAccount(full).catch(console.error);
        });

      return reply.code(201).send({ account });
    }
  );

  // Delete a mail account
  fastify.delete(
    '/api/accounts/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      assertAccountScope(request.user.account_ids, id);

      const deleted = await db
        .delete(mail_accounts)
        .where(and(eq(mail_accounts.id, id), eq(mail_accounts.user_id, request.user.id)))
        .returning({ id: mail_accounts.id });

      if (deleted.length === 0) {
        return reply.code(404).send({ error: 'Account not found' });
      }

      return { ok: true };
    }
  );

  // Trigger manual sync for an account
  fastify.post(
    '/api/accounts/:id/sync',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      assertAccountScope(request.user.account_ids, id);

      const [account] = await db
        .select()
        .from(mail_accounts)
        .where(and(eq(mail_accounts.id, id), eq(mail_accounts.user_id, request.user.id)))
        .limit(1);

      if (!account) return reply.code(404).send({ error: 'Account not found' });

      // Run sync in background
      syncAccount(account).catch(console.error);
      return { ok: true, message: 'Sync started' };
    }
  );
}
