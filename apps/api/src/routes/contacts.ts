import { FastifyInstance } from 'fastify';
import { eq, and, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../lib/db';
import { contacts, mail_accounts } from '../db/schema';
import { assertAccountScope } from '../lib/assert-account';

const CreateContactBody = z.object({
  account_id: z.string().uuid(),
  full_name: z.string().min(1),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  emails: z.array(z.object({ type: z.string(), value: z.string().email() })).default([]),
  phones: z.array(z.object({ type: z.string(), value: z.string() })).default([]),
  organization: z.string().optional(),
  title: z.string().optional(),
  notes: z.string().optional(),
});

export async function contactRoutes(fastify: FastifyInstance) {
  // List contacts (with optional search)
  fastify.get(
    '/api/contacts',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const q = request.query as { account_id?: string; search?: string; page?: string };
      const page = Math.max(1, parseInt(q.page ?? '1', 10));
      const limit = 100;
      const offset = (page - 1) * limit;

      const conditions = [eq(mail_accounts.user_id, request.user.id)];
      if (q.account_id) conditions.push(eq(contacts.account_id, q.account_id));
      if (q.search) {
        const term = `%${q.search}%`;
        conditions.push(
          or(
            ilike(contacts.full_name, term),
            ilike(contacts.organization, term),
            sql`${contacts.emails}::text ILIKE ${term}`
          )!
        );
      }

      const rows = await db
        .select({
          id: contacts.id,
          account_id: contacts.account_id,
          uid: contacts.uid,
          full_name: contacts.full_name,
          first_name: contacts.first_name,
          last_name: contacts.last_name,
          emails: contacts.emails,
          phones: contacts.phones,
          organization: contacts.organization,
          title: contacts.title,
          photo_url: contacts.photo_url,
        })
        .from(contacts)
        .innerJoin(mail_accounts, eq(contacts.account_id, mail_accounts.id))
        .where(and(...conditions))
        .orderBy(contacts.full_name)
        .limit(limit)
        .offset(offset);

      return { contacts: rows, page };
    }
  );

  // Get a single contact (includes notes)
  fastify.get(
    '/api/contacts/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const [row] = await db
        .select()
        .from(contacts)
        .innerJoin(mail_accounts, eq(contacts.account_id, mail_accounts.id))
        .where(and(eq(contacts.id, id), eq(mail_accounts.user_id, request.user.id)))
        .limit(1);

      if (!row) return reply.code(404).send({ error: 'Contact not found' });
      return { contact: row.contacts };
    }
  );

  // Create a local contact
  fastify.post(
    '/api/contacts',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const parsed = CreateContactBody.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });

      assertAccountScope(request.user.account_ids, parsed.data.account_id);

      const uid = `statsus-${crypto.randomUUID()}@local`;
      const [contact] = await db
        .insert(contacts)
        .values({
          account_id: parsed.data.account_id,
          uid,
          full_name: parsed.data.full_name,
          first_name: parsed.data.first_name ?? null,
          last_name: parsed.data.last_name ?? null,
          emails: parsed.data.emails as unknown as Record<string, string>[],
          phones: parsed.data.phones as unknown as Record<string, string>[],
          organization: parsed.data.organization ?? null,
          title: parsed.data.title ?? null,
          notes: parsed.data.notes ?? null,
        })
        .returning();

      return reply.code(201).send({ contact });
    }
  );

  // Update a contact
  fastify.put(
    '/api/contacts/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = CreateContactBody.omit({ account_id: true }).partial().safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: 'Invalid input' });

      const existing = await db
        .select({ id: contacts.id })
        .from(contacts)
        .innerJoin(mail_accounts, eq(contacts.account_id, mail_accounts.id))
        .where(and(eq(contacts.id, id), eq(mail_accounts.user_id, request.user.id)))
        .limit(1);
      if (!existing.length) return reply.code(404).send({ error: 'Contact not found' });

      const [updated] = await db
        .update(contacts)
        .set({ ...body.data } as Partial<typeof contacts.$inferInsert>)
        .where(eq(contacts.id, id))
        .returning();

      return { contact: updated };
    }
  );

  // Delete a contact
  fastify.delete(
    '/api/contacts/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const deleted = await db
        .delete(contacts)
        .where(
          and(
            eq(contacts.id, id),
            sql`${contacts.account_id} IN (
              SELECT id FROM mail_accounts WHERE user_id = ${request.user.id}
            )`
          )
        )
        .returning({ id: contacts.id });

      if (!deleted.length) return reply.code(404).send({ error: 'Contact not found' });
      return { ok: true };
    }
  );
}
