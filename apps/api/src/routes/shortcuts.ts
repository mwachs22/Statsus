import { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../lib/db';
import { user_shortcuts } from '../db/schema';

const ShortcutBody = z.object({
  key_combination: z.string().min(1).max(20),
  scope: z.enum(['global', 'compose', 'list']).default('global'),
});

export async function shortcutRoutes(fastify: FastifyInstance) {
  // Get all custom shortcut overrides for the current user
  fastify.get(
    '/api/shortcuts',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const overrides = await db
        .select()
        .from(user_shortcuts)
        .where(eq(user_shortcuts.user_id, request.user.id));

      return { shortcuts: overrides };
    }
  );

  // Set / update a shortcut override for a specific action
  fastify.put(
    '/api/shortcuts/:action',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { action } = request.params as { action: string };
      const parsed = ShortcutBody.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid input' });

      const [shortcut] = await db
        .insert(user_shortcuts)
        .values({
          user_id:         request.user.id,
          action,
          key_combination: parsed.data.key_combination,
          scope:           parsed.data.scope,
        })
        .onConflictDoUpdate({
          target: [user_shortcuts.user_id, user_shortcuts.action, user_shortcuts.scope],
          set: { key_combination: parsed.data.key_combination },
        })
        .returning();

      return { shortcut };
    }
  );

  // Delete a shortcut override (revert to default)
  fastify.delete(
    '/api/shortcuts/:action',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { action } = request.params as { action: string };
      const deleted = await db
        .delete(user_shortcuts)
        .where(
          and(
            eq(user_shortcuts.user_id, request.user.id),
            eq(user_shortcuts.action, action)
          )
        )
        .returning({ id: user_shortcuts.id });

      if (!deleted.length) return reply.code(404).send({ error: 'Override not found' });
      return { ok: true };
    }
  );
}
