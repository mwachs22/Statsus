import { FastifyInstance } from 'fastify';
import { eq, and, asc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../lib/db';
import { filters } from '../db/schema';
import { validateRegexSafety } from '../lib/regex-safety';

function collectRegexPatterns(group: unknown): string[] {
  const g = group as { logic?: string; rules?: unknown[]; op?: string; value?: string };
  if (g.op === 'regex') return [g.value ?? ''];
  return (g.rules ?? []).flatMap(collectRegexPatterns);
}

const RuleSchema: z.ZodType = z.lazy(() =>
  z.union([
    z.object({
      field: z.enum(['from', 'to', 'subject', 'body']),
      op: z.enum(['contains', 'not_contains', 'equals', 'regex', 'is_empty']),
      value: z.string().default(''),
    }),
    z.object({
      logic: z.enum(['AND', 'OR']),
      rules: z.array(RuleSchema),
    }),
  ])
);

const ConditionGroupSchema = z.object({
  logic: z.enum(['AND', 'OR']),
  rules: z.array(RuleSchema),
});

const ActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('label'),           value: z.string().min(1) }),
  z.object({ type: z.literal('archive') }),
  z.object({ type: z.literal('delete') }),
  z.object({ type: z.literal('mark_read') }),
  z.object({ type: z.literal('forward'),         value: z.string().email() }),
  z.object({ type: z.literal('stop_processing') }),
]);

const FilterBody = z.object({
  name:       z.string().min(1).max(100),
  conditions: ConditionGroupSchema,
  actions:    z.array(ActionSchema).min(1),
  enabled:    z.boolean().default(true),
  account_id: z.string().uuid().optional(),
});

export async function filterRoutes(fastify: FastifyInstance) {
  // List filters for the current user
  fastify.get(
    '/api/filters',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const rows = await db
        .select()
        .from(filters)
        .where(eq(filters.user_id, request.user.id))
        .orderBy(asc(filters.run_order));
      return { filters: rows };
    }
  );

  // Create a filter
  fastify.post(
    '/api/filters',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const parsed = FilterBody.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });

      for (const pat of collectRegexPatterns(parsed.data.conditions)) {
        if (!validateRegexSafety(pat)) {
          return reply.code(400).send({ error: 'Invalid or unsafe regex pattern in filter conditions' });
        }
      }

      // run_order = max existing + 1
      const existing = await db
        .select({ run_order: filters.run_order })
        .from(filters)
        .where(eq(filters.user_id, request.user.id))
        .orderBy(asc(filters.run_order));
      const nextOrder = existing.length > 0
        ? (existing[existing.length - 1].run_order ?? 0) + 1
        : 0;

      const [filter] = await db
        .insert(filters)
        .values({
          user_id:    request.user.id,
          account_id: parsed.data.account_id ?? null,
          name:       parsed.data.name,
          conditions: parsed.data.conditions as unknown as Record<string, unknown>,
          actions:    parsed.data.actions    as unknown as Record<string, unknown>[],
          enabled:    parsed.data.enabled,
          run_order:  nextOrder,
        })
        .returning();

      return reply.code(201).send({ filter });
    }
  );

  // Update a filter
  fastify.put(
    '/api/filters/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = FilterBody.partial().safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid input' });

      if (parsed.data.conditions) {
        for (const pat of collectRegexPatterns(parsed.data.conditions)) {
          if (!validateRegexSafety(pat)) {
            return reply.code(400).send({ error: 'Invalid or unsafe regex pattern in filter conditions' });
          }
        }
      }

      const update: Partial<typeof filters.$inferInsert> = {};
      if (parsed.data.name       !== undefined) update.name       = parsed.data.name;
      if (parsed.data.conditions !== undefined) update.conditions = parsed.data.conditions as unknown as Record<string, unknown>;
      if (parsed.data.actions    !== undefined) update.actions    = parsed.data.actions    as unknown as Record<string, unknown>[];
      if (parsed.data.enabled    !== undefined) update.enabled    = parsed.data.enabled;

      const [updated] = await db
        .update(filters)
        .set(update)
        .where(and(eq(filters.id, id), eq(filters.user_id, request.user.id)))
        .returning();

      if (!updated) return reply.code(404).send({ error: 'Filter not found' });
      return { filter: updated };
    }
  );

  // Toggle enabled state
  fastify.patch(
    '/api/filters/:id/toggle',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const [existing] = await db
        .select({ id: filters.id, enabled: filters.enabled })
        .from(filters)
        .where(and(eq(filters.id, id), eq(filters.user_id, request.user.id)))
        .limit(1);

      if (!existing) return reply.code(404).send({ error: 'Filter not found' });

      const [updated] = await db
        .update(filters)
        .set({ enabled: !existing.enabled })
        .where(eq(filters.id, id))
        .returning();

      return { filter: updated };
    }
  );

  // Delete a filter
  fastify.delete(
    '/api/filters/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const deleted = await db
        .delete(filters)
        .where(and(eq(filters.id, id), eq(filters.user_id, request.user.id)))
        .returning({ id: filters.id });

      if (!deleted.length) return reply.code(404).send({ error: 'Filter not found' });
      return { ok: true };
    }
  );
}
