import { FastifyInstance } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../lib/db';
import { scheduled_emails } from '../db/schema';
import { assertAccountScope } from '../lib/assert-account';

const ScheduleBody = z.object({
  account_id:   z.string().uuid(),
  scheduled_at: z.string().datetime(),
  timezone:     z.string().default('UTC'),
  to:           z.string().min(1),
  cc:           z.string().optional(),
  subject:      z.string().min(1),
  text:         z.string().optional(),
  html:         z.string().optional(),
  in_reply_to:  z.string().optional(),
  references:   z.string().optional(),
});

export async function scheduledRoutes(fastify: FastifyInstance) {
  // List scheduled emails for the current user
  fastify.get(
    '/api/scheduled',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const rows = await db
        .select()
        .from(scheduled_emails)
        .where(eq(scheduled_emails.user_id, request.user.id))
        .orderBy(desc(scheduled_emails.scheduled_at));

      return { scheduled: rows };
    }
  );

  // Schedule a new email
  fastify.post(
    '/api/scheduled',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const parsed = ScheduleBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
      }

      assertAccountScope(request.user.account_ids, parsed.data.account_id);

      const { account_id, scheduled_at, timezone, to, cc, subject, text, html, in_reply_to, references } = parsed.data;

      const [row] = await db
        .insert(scheduled_emails)
        .values({
          user_id:      request.user.id,
          account_id,
          scheduled_at: new Date(scheduled_at),
          timezone,
          raw_message: { to, cc, subject, text, html, in_reply_to, references },
          status: 'queued',
        })
        .returning();

      return reply.code(201).send({ scheduled: row });
    }
  );

  // Cancel a scheduled email
  fastify.delete(
    '/api/scheduled/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const deleted = await db
        .delete(scheduled_emails)
        .where(
          and(
            eq(scheduled_emails.id, id),
            eq(scheduled_emails.user_id, request.user.id),
            eq(scheduled_emails.status, 'queued')
          )
        )
        .returning({ id: scheduled_emails.id });

      if (!deleted.length) {
        return reply.code(404).send({ error: 'Scheduled email not found or already sent' });
      }

      return { ok: true };
    }
  );
}
