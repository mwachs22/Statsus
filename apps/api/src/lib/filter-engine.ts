import { eq, and, asc, sql } from 'drizzle-orm';
import { db } from './db';
import { filters, messages } from '../db/schema';

// Mirror of shared types — avoids a cross-package dep in the API build
type FilterField = 'from' | 'to' | 'subject' | 'body';
type FilterOp = 'contains' | 'not_contains' | 'equals' | 'regex' | 'is_empty';

interface FilterRule {
  field: FilterField;
  op: FilterOp;
  value: string;
}

interface FilterConditionGroup {
  logic: 'AND' | 'OR';
  rules: (FilterRule | FilterConditionGroup)[];
}

type FilterAction =
  | { type: 'label'; value: string }
  | { type: 'archive' }
  | { type: 'delete' }
  | { type: 'mark_read' }
  | { type: 'forward'; value: string }
  | { type: 'stop_processing' };

interface EvaluableMessage {
  id: string;
  from_addr: string | null;
  to_addr: string | null;
  subject: string | null;
  body_preview: string | null;
  text_body: string | null;
}

function getField(msg: EvaluableMessage, field: FilterRule['field']): string {
  switch (field) {
    case 'from':    return msg.from_addr ?? '';
    case 'to':      return msg.to_addr ?? '';
    case 'subject': return msg.subject ?? '';
    case 'body':    return msg.text_body ?? msg.body_preview ?? '';
  }
}

function matchesRule(msg: EvaluableMessage, rule: FilterRule): boolean {
  const raw   = getField(msg, rule.field);
  const field = raw.toLowerCase();
  const value = rule.value.toLowerCase();
  switch (rule.op) {
    case 'contains':     return field.includes(value);
    case 'not_contains': return !field.includes(value);
    case 'equals':       return field === value;
    case 'is_empty':     return field.trim() === '';
    case 'regex': {
      try { return new RegExp(rule.value, 'i').test(raw); } catch { return false; }
    }
    default: return false;
  }
}

function matchesGroup(msg: EvaluableMessage, group: FilterConditionGroup): boolean {
  const results = group.rules.map((r) =>
    'field' in r
      ? matchesRule(msg, r as FilterRule)
      : matchesGroup(msg, r as FilterConditionGroup)
  );
  return group.logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
}

async function applyAction(action: FilterAction, messageId: string): Promise<void> {
  switch (action.type) {
    case 'mark_read':
      await db.update(messages).set({
        flags: sql`array_append(array_remove(flags, '\\Seen'), '\\Seen')`,
      }).where(eq(messages.id, messageId));
      break;

    case 'label':
      await db.update(messages).set({
        flags: sql`array_append(flags, ${`$label:${action.value}`})`,
      }).where(eq(messages.id, messageId));
      break;

    case 'archive':
      await db.update(messages).set({ folder: 'Archived' }).where(eq(messages.id, messageId));
      break;

    case 'delete':
      await db.update(messages).set({ folder: 'Trash' }).where(eq(messages.id, messageId));
      break;

    case 'stop_processing':
    case 'forward':
      // forward is deferred; stop_processing is handled by the loop caller
      break;
  }
}

/**
 * Load the user's enabled filters once, evaluate them against every message,
 * and apply matching actions. Designed to be called after batch IMAP insert.
 */
export async function applyFiltersToMessages(
  userId: string,
  newMessages: EvaluableMessage[]
): Promise<void> {
  if (newMessages.length === 0) return;

  const userFilters = await db
    .select()
    .from(filters)
    .where(and(eq(filters.user_id, userId), eq(filters.enabled, true)))
    .orderBy(asc(filters.run_order));

  if (userFilters.length === 0) return;

  for (const msg of newMessages) {
    for (const filter of userFilters) {
      const conditions = filter.conditions as FilterConditionGroup;
      if (!matchesGroup(msg, conditions)) continue;

      // Bump match stats (fire-and-forget; don't block the sync)
      db.update(filters).set({
        match_count: sql`${filters.match_count} + 1`,
        last_matched_at: new Date(),
      }).where(eq(filters.id, filter.id)).catch(console.error);

      const actions = filter.actions as FilterAction[];
      let stop = false;
      for (const action of actions) {
        await applyAction(action, msg.id);
        if (action.type === 'stop_processing') { stop = true; break; }
      }
      if (stop) break;
    }
  }
}
