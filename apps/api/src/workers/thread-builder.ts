import { inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '../lib/db';
import { messages } from '../db/schema';

/**
 * Given a parsed message's headers, find or create a thread_id.
 * Checks References then In-Reply-To against existing message_ids in the DB.
 */
export async function resolveThreadId(
  inReplyTo: string | null | undefined,
  references: string[] | null | undefined
): Promise<string> {
  const toCheck = [...(references ?? []), ...(inReplyTo ? [inReplyTo] : [])]
    .map((id) => id.trim().replace(/[<>]/g, ''))
    .filter(Boolean);

  if (toCheck.length === 0) return randomUUID();

  const existing = await db
    .select({ thread_id: messages.thread_id })
    .from(messages)
    .where(inArray(messages.message_id, toCheck))
    .limit(1);

  return existing[0]?.thread_id ?? randomUUID();
}
