import { FastifyInstance } from 'fastify';
import { eq, and, asc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../lib/db';
import { todos } from '../db/schema';

const TodoBody = z.object({
  text:               z.string().min(1).max(500),
  priority:           z.enum(['high', 'normal', 'low']).default('normal'),
  due_date:           z.string().datetime().optional(),
  linked_message_id:  z.string().uuid().optional(),
});

export async function todoRoutes(fastify: FastifyInstance) {
  // List all todos for the user
  fastify.get(
    '/api/todos',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const rows = await db
        .select()
        .from(todos)
        .where(eq(todos.user_id, request.user.id))
        .orderBy(asc(todos.completed), asc(todos.created_at));

      return { todos: rows };
    }
  );

  // Create a todo
  fastify.post(
    '/api/todos',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const parsed = TodoBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
      }

      const [todo] = await db
        .insert(todos)
        .values({
          user_id:           request.user.id,
          text:              parsed.data.text,
          priority:          parsed.data.priority,
          due_date:          parsed.data.due_date ? new Date(parsed.data.due_date) : null,
          linked_message_id: parsed.data.linked_message_id ?? null,
        })
        .returning();

      return reply.code(201).send({ todo });
    }
  );

  // Update a todo (text, completed, priority, due_date)
  fastify.put(
    '/api/todos/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const UpdateBody = TodoBody.partial().extend({ completed: z.boolean().optional() });
      const parsed = UpdateBody.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Invalid input' });

      const update: Record<string, unknown> = {};
      if (parsed.data.text      !== undefined) update.text      = parsed.data.text;
      if (parsed.data.completed !== undefined) update.completed = parsed.data.completed;
      if (parsed.data.priority  !== undefined) update.priority  = parsed.data.priority;
      if (parsed.data.due_date  !== undefined) update.due_date  = new Date(parsed.data.due_date);
      if (parsed.data.linked_message_id !== undefined) update.linked_message_id = parsed.data.linked_message_id;

      const [updated] = await db
        .update(todos)
        .set(update as Partial<typeof todos.$inferInsert>)
        .where(and(eq(todos.id, id), eq(todos.user_id, request.user.id)))
        .returning();

      if (!updated) return reply.code(404).send({ error: 'Todo not found' });
      return { todo: updated };
    }
  );

  // Delete a todo
  fastify.delete(
    '/api/todos/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const deleted = await db
        .delete(todos)
        .where(and(eq(todos.id, id), eq(todos.user_id, request.user.id)))
        .returning({ id: todos.id });

      if (!deleted.length) return reply.code(404).send({ error: 'Todo not found' });
      return { ok: true };
    }
  );
}
