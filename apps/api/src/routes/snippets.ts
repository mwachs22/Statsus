import { FastifyInstance } from 'fastify';
import { eq, and, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../lib/db';
import { snippets } from '../db/schema';

const SnippetBody = z.object({
  title:     z.string().min(1).max(100),
  content:   z.string().min(1),
  format:    z.enum(['html', 'plain']).default('plain'),
  folder:    z.string().max(50).optional(),
  tags:      z.array(z.string()).default([]),
  variables: z.record(z.string()).default({}),
  is_global: z.boolean().default(true),
});

export async function snippetRoutes(fastify: FastifyInstance) {
  // List snippets (optional search/folder filter)
  fastify.get(
    '/api/snippets',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const q = request.query as { search?: string; folder?: string };

      const conditions = [eq(snippets.user_id, request.user.id)];
      if (q.folder) conditions.push(eq(snippets.folder, q.folder));
      if (q.search) {
        const term = `%${q.search}%`;
        conditions.push(
          or(ilike(snippets.title, term), sql`${snippets.content} ILIKE ${term}`)!
        );
      }

      const rows = await db
        .select()
        .from(snippets)
        .where(and(...conditions))
        .orderBy(snippets.title);

      return { snippets: rows };
    }
  );

  // Create a snippet
  fastify.post(
    '/api/snippets',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const parsed = SnippetBody.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });

      const [snippet] = await db
        .insert(snippets)
        .values({
          user_id:   request.user.id,
          title:     parsed.data.title,
          content:   parsed.data.content,
          format:    parsed.data.format,
          folder:    parsed.data.folder ?? null,
          tags:      parsed.data.tags,
          variables: parsed.data.variables as Record<string, string>,
          is_global: parsed.data.is_global,
        })
        .returning();

      return reply.code(201).send({ snippet });
    }
  );

  // Update a snippet
  fastify.put(
    '/api/snippets/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = SnippetBody.partial().safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid input' });

      const [updated] = await db
        .update(snippets)
        .set({ ...parsed.data } as Partial<typeof snippets.$inferInsert>)
        .where(and(eq(snippets.id, id), eq(snippets.user_id, request.user.id)))
        .returning();

      if (!updated) return reply.code(404).send({ error: 'Snippet not found' });
      return { snippet: updated };
    }
  );

  // Record usage (increment counter)
  fastify.post(
    '/api/snippets/:id/use',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const [updated] = await db
        .update(snippets)
        .set({ usage_count: sql`${snippets.usage_count} + 1` })
        .where(and(eq(snippets.id, id), eq(snippets.user_id, request.user.id)))
        .returning({ usage_count: snippets.usage_count });

      if (!updated) return reply.code(404).send({ error: 'Snippet not found' });
      return { usage_count: updated.usage_count };
    }
  );

  // Delete a snippet
  fastify.delete(
    '/api/snippets/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const deleted = await db
        .delete(snippets)
        .where(and(eq(snippets.id, id), eq(snippets.user_id, request.user.id)))
        .returning({ id: snippets.id });

      if (!deleted.length) return reply.code(404).send({ error: 'Snippet not found' });
      return { ok: true };
    }
  );
}
