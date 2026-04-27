import { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../lib/db';

export async function searchRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/search',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { q } = request.query as { q?: string };
      if (!q || q.trim().length < 2) {
        return reply.code(400).send({ error: 'Query must be at least 2 characters' });
      }
      if (q.length > 200) {
        return reply.code(400).send({ error: 'Query must be 200 characters or fewer' });
      }

      const term = q.trim();
      const like = `%${term}%`;
      const userId = request.user.id;

      // Run all three searches in parallel
      const [messageRows, contactRows, eventRows] = await Promise.all([
        // Messages: subject + from + preview
        db.execute<{
          id: string;
          thread_id: string;
          subject: string;
          from_addr: string;
          body_preview: string;
          date: string;
          account_id: string;
        }>(sql`
          SELECT m.id, m.thread_id, m.subject, m.from_addr, m.body_preview, m.date, m.account_id
          FROM messages m
          INNER JOIN mail_accounts ma ON ma.id = m.account_id
          WHERE ma.user_id = ${userId}
            AND m.folder = 'INBOX'
            AND (
              m.subject ILIKE ${like}
              OR m.from_addr ILIKE ${like}
              OR m.body_preview ILIKE ${like}
            )
          ORDER BY m.date DESC
          LIMIT 10
        `),

        // Contacts: name + email + org
        db.execute<{
          id: string;
          full_name: string;
          emails: unknown;
          organization: string;
          account_id: string;
        }>(sql`
          SELECT c.id, c.full_name, c.emails, c.organization, c.account_id
          FROM contacts c
          INNER JOIN mail_accounts ma ON ma.id = c.account_id
          WHERE ma.user_id = ${userId}
            AND (
              c.full_name ILIKE ${like}
              OR c.organization ILIKE ${like}
              OR c.emails::text ILIKE ${like}
            )
          ORDER BY c.full_name ASC
          LIMIT 5
        `),

        // Calendar events: summary + description + location
        db.execute<{
          id: string;
          summary: string;
          start_time: string;
          location: string;
          account_id: string;
        }>(sql`
          SELECT ce.id, ce.summary, ce.start_time, ce.location, ce.account_id
          FROM calendar_events ce
          INNER JOIN mail_accounts ma ON ma.id = ce.account_id
          WHERE ma.user_id = ${userId}
            AND (
              ce.summary ILIKE ${like}
              OR ce.description ILIKE ${like}
              OR ce.location ILIKE ${like}
            )
          ORDER BY ce.start_time DESC
          LIMIT 5
        `),
      ]);

      return {
        query: term,
        results: {
          messages: messageRows.rows ?? [],
          contacts: contactRows.rows ?? [],
          events: eventRows.rows ?? [],
        },
        total:
          (messageRows.rows?.length ?? 0) +
          (contactRows.rows?.length ?? 0) +
          (eventRows.rows?.length ?? 0),
      };
    }
  );
}
