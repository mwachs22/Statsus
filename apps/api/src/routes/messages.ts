import { FastifyInstance } from 'fastify';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../lib/db';
import { messages, mail_accounts } from '../db/schema';
import { sendEmail } from '../workers/smtp-send';
import { assertAccountScope } from '../lib/assert-account';

const FlagsBody = z.object({
  add:    z.array(z.string().max(100)).max(20).default([]),
  remove: z.array(z.string().max(100)).max(20).default([]),
});

const SendBody = z.object({
  account_id: z.string().uuid(),
  to: z.string().min(1),
  cc: z.string().optional(),
  subject: z.string().min(1),
  text: z.string().optional(),
  html: z.string().optional(),
  in_reply_to: z.string().optional(),
  references: z.string().optional(),
  thread_id: z.string().uuid().optional(),
});

export async function messageRoutes(fastify: FastifyInstance) {
  // List threads for an account/folder
  fastify.get(
    '/api/messages/threads',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = request.query as {
        account_id?: string;
        folder?: string;
        page?: string;
        limit?: string;
      };

      const folder = query.folder ?? 'INBOX';
      const page = Math.max(1, parseInt(query.page ?? '1', 10));
      const limit = Math.min(100, parseInt(query.limit ?? '50', 10));
      const offset = (page - 1) * limit;

      // Verify account belongs to user — fast JWT scope check, no DB round-trip
      if (query.account_id) {
        assertAccountScope(request.user.account_ids, query.account_id);
      }

      // Get latest message per thread using DISTINCT ON (Postgres-specific)
      type ThreadRow = {
        thread_id: string;
        subject: string;
        from_addr: string;
        body_preview: string;
        date: Date;
        flags: string[];
        account_id: string;
        message_count: number;
        unread_count: number;
      };

      const rawResult = await db.execute(sql`
        SELECT
          t.thread_id,
          t.subject,
          t.from_addr,
          t.body_preview,
          t.date,
          t.flags,
          t.account_id,
          c.message_count,
          c.unread_count
        FROM (
          SELECT DISTINCT ON (m.thread_id)
            m.thread_id, m.subject, m.from_addr, m.body_preview,
            m.date, m.flags, m.account_id
          FROM messages m
          INNER JOIN mail_accounts ma ON ma.id = m.account_id
          WHERE ma.user_id = ${request.user.id}
            AND m.folder = ${folder}
            ${query.account_id ? sql`AND m.account_id = ${query.account_id}` : sql``}
          ORDER BY m.thread_id, m.date DESC
        ) t
        JOIN (
          SELECT
            m2.thread_id,
            COUNT(*)::int AS message_count,
            COUNT(*) FILTER (WHERE NOT ('\\Seen' = ANY(m2.flags)))::int AS unread_count
          FROM messages m2
          INNER JOIN mail_accounts ma2 ON ma2.id = m2.account_id
          WHERE ma2.user_id = ${request.user.id}
            AND m2.folder = ${folder}
            ${query.account_id ? sql`AND m2.account_id = ${query.account_id}` : sql``}
          GROUP BY m2.thread_id
        ) c ON c.thread_id = t.thread_id
        ORDER BY t.date DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const threads = (rawResult.rows ?? rawResult) as ThreadRow[];
      return { threads, page, limit };
    }
  );

  // Get all messages in a thread
  fastify.get(
    '/api/messages/thread/:threadId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { threadId } = request.params as { threadId: string };

      const msgs = await db
        .select({
          id: messages.id,
          thread_id: messages.thread_id,
          folder: messages.folder,
          from_addr: messages.from_addr,
          to_addr: messages.to_addr,
          cc_addr: messages.cc_addr,
          subject: messages.subject,
          body_preview: messages.body_preview,
          text_body: messages.text_body,
          html_body: messages.html_body,
          flags: messages.flags,
          date: messages.date,
          message_id: messages.message_id,
          in_reply_to: messages.in_reply_to,
          account_id: messages.account_id,
        })
        .from(messages)
        .innerJoin(mail_accounts, eq(messages.account_id, mail_accounts.id))
        .where(
          and(
            eq(messages.thread_id, threadId),
            eq(mail_accounts.user_id, request.user.id)
          )
        )
        .orderBy(messages.date);

      if (msgs.length === 0) return reply.code(404).send({ error: 'Thread not found' });

      // Mark messages as read (remove \Seen absence — set \Seen flag)
      await db
        .update(messages)
        .set({
          flags: sql`array_append(
            array_remove(flags, '\\Seen'),
            '\\Seen'
          )`,
        })
        .where(
          and(
            eq(messages.thread_id, threadId),
            sql`NOT ('\\Seen' = ANY(flags))`
          )
        );

      return { messages: msgs };
    }
  );

  // Send an email
  fastify.post(
    '/api/messages/send',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = SendBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
      }

      const { account_id, to, cc, subject, text, html, in_reply_to, references } = parsed.data;

      // Fast JWT scope check before the credential fetch
      assertAccountScope(request.user.account_ids, account_id);

      const [account] = await db
        .select()
        .from(mail_accounts)
        .where(eq(mail_accounts.id, account_id))
        .limit(1);

      if (!account) return reply.code(404).send({ error: 'Account not found' });

      try {
        const messageId = await sendEmail(account, {
          from: account.email,
          to,
          cc,
          subject,
          text,
          html,
          inReplyTo: in_reply_to,
          references,
        });

        return reply.code(201).send({ ok: true, message_id: messageId });
      } catch (err) {
        request.log.error(err, 'SMTP send failed');
        return reply.code(500).send({ error: 'Failed to send email' });
      }
    }
  );

  // Mark a message's flags (read/unread/starred)
  fastify.patch(
    '/api/messages/:id/flags',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const flagsParsed = FlagsBody.safeParse(request.body);
      if (!flagsParsed.success) return reply.code(400).send({ error: 'Invalid input' });
      const { add, remove } = flagsParsed.data;

      const [msg] = await db
        .select({ id: messages.id, flags: messages.flags })
        .from(messages)
        .innerJoin(mail_accounts, eq(messages.account_id, mail_accounts.id))
        .where(and(eq(messages.id, id), eq(mail_accounts.user_id, request.user.id)))
        .limit(1);

      if (!msg) return reply.code(404).send({ error: 'Message not found' });

      const currentFlags = msg.flags ?? [];
      const newFlags = [...new Set([...currentFlags.filter((f) => !remove.includes(f)), ...add])];

      await db.update(messages).set({ flags: newFlags }).where(eq(messages.id, id));
      return { flags: newFlags };
    }
  );
}
