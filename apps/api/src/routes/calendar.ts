import { FastifyInstance } from 'fastify';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../lib/db';
import { calendar_events, mail_accounts } from '../db/schema';
import { assertAccountScope } from '../lib/assert-account';

const CreateEventBody = z.object({
  account_id: z.string().uuid(),
  summary: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime().optional(),
  all_day: z.boolean().default(false),
});

const UpdateEventBody = CreateEventBody.partial().omit({ account_id: true });

export async function calendarRoutes(fastify: FastifyInstance) {
  // List events in a date range
  fastify.get(
    '/api/calendar/events',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const q = request.query as {
        account_id?: string;
        start?: string;
        end?: string;
      };

      const startDate = q.start ? new Date(q.start) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const endDate   = q.end   ? new Date(q.end)   : new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0);

      const conditions = [
        eq(mail_accounts.user_id, request.user.id),
        gte(calendar_events.start_time, startDate),
        lte(calendar_events.start_time, endDate),
      ];

      if (q.account_id) {
        conditions.push(eq(calendar_events.account_id, q.account_id));
      }

      const events = await db
        .select({
          id: calendar_events.id,
          account_id: calendar_events.account_id,
          calendar_uid: calendar_events.calendar_uid,
          summary: calendar_events.summary,
          description: calendar_events.description,
          location: calendar_events.location,
          organizer: calendar_events.organizer,
          attendees: calendar_events.attendees,
          start_time: calendar_events.start_time,
          end_time: calendar_events.end_time,
          all_day: calendar_events.all_day,
          recurrence_rule: calendar_events.recurrence_rule,
          status: calendar_events.status,
        })
        .from(calendar_events)
        .innerJoin(mail_accounts, eq(calendar_events.account_id, mail_accounts.id))
        .where(and(...conditions))
        .orderBy(calendar_events.start_time);

      return { events };
    }
  );

  // Get a single event
  fastify.get(
    '/api/calendar/events/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const [event] = await db
        .select()
        .from(calendar_events)
        .innerJoin(mail_accounts, eq(calendar_events.account_id, mail_accounts.id))
        .where(and(eq(calendar_events.id, id), eq(mail_accounts.user_id, request.user.id)))
        .limit(1);

      if (!event) return reply.code(404).send({ error: 'Event not found' });
      return { event: event.calendar_events };
    }
  );

  // Create a local event (not pushed to CalDAV in Phase 3 — stored locally only)
  fastify.post(
    '/api/calendar/events',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const parsed = CreateEventBody.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });

      assertAccountScope(request.user.account_ids, parsed.data.account_id);

      const uid = `statsus-${crypto.randomUUID()}@local`;
      const [event] = await db
        .insert(calendar_events)
        .values({
          account_id: parsed.data.account_id,
          calendar_uid: uid,
          summary: parsed.data.summary,
          description: parsed.data.description ?? null,
          location: parsed.data.location ?? null,
          start_time: new Date(parsed.data.start_time),
          end_time: parsed.data.end_time ? new Date(parsed.data.end_time) : null,
          all_day: parsed.data.all_day,
        })
        .returning();

      return reply.code(201).send({ event });
    }
  );

  // Update an event
  fastify.put(
    '/api/calendar/events/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = UpdateEventBody.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid input' });

      const existing = await db
        .select({ id: calendar_events.id })
        .from(calendar_events)
        .innerJoin(mail_accounts, eq(calendar_events.account_id, mail_accounts.id))
        .where(and(eq(calendar_events.id, id), eq(mail_accounts.user_id, request.user.id)))
        .limit(1);

      if (!existing.length) return reply.code(404).send({ error: 'Event not found' });

      const update: Partial<typeof calendar_events.$inferInsert> = {};
      if (parsed.data.summary)     update.summary     = parsed.data.summary;
      if (parsed.data.description !== undefined) update.description = parsed.data.description;
      if (parsed.data.location !== undefined)    update.location    = parsed.data.location;
      if (parsed.data.start_time)  update.start_time  = new Date(parsed.data.start_time);
      if (parsed.data.end_time)    update.end_time    = new Date(parsed.data.end_time);
      if (parsed.data.all_day !== undefined) update.all_day = parsed.data.all_day;

      const [updated] = await db.update(calendar_events).set(update).where(eq(calendar_events.id, id)).returning();
      return { event: updated };
    }
  );

  // Delete an event
  fastify.delete(
    '/api/calendar/events/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const deleted = await db
        .delete(calendar_events)
        .where(
          and(
            eq(calendar_events.id, id),
            sql`${calendar_events.account_id} IN (
              SELECT id FROM mail_accounts WHERE user_id = ${request.user.id}
            )`
          )
        )
        .returning({ id: calendar_events.id });

      if (!deleted.length) return reply.code(404).send({ error: 'Event not found' });
      return { ok: true };
    }
  );
}
