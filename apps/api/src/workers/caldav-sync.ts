import { createDAVClient } from 'tsdav';
import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db';
import { mail_accounts, calendar_events, dav_sync_state } from '../db/schema';
import { decrypt } from '../lib/crypto';
import { parseICS } from '../lib/ical-parser';

type AccountRow = typeof mail_accounts.$inferSelect;

const SYNC_WINDOW_PAST_DAYS  = 90;   // 3 months back
const SYNC_WINDOW_FUTURE_DAYS = 365; // 1 year forward

export async function syncCalDAV(account: AccountRow): Promise<void> {
  if (!account.caldav_url) return;

  const raw = decrypt(account.encrypted_credential as Buffer);
  const credential = JSON.parse(raw) as { username: string; password: string };

  const client = await createDAVClient({
    serverUrl: account.caldav_url,
    credentials: { username: credential.username, password: credential.password },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });

  const calendars = await client.fetchCalendars();

  const start = new Date(Date.now() - SYNC_WINDOW_PAST_DAYS * 86400_000).toISOString();
  const end   = new Date(Date.now() + SYNC_WINDOW_FUTURE_DAYS * 86400_000).toISOString();

  for (const calendar of calendars) {
    if (!calendar.url) continue;
    try {
      await syncOneCalendar(client, account, calendar, start, end);
    } catch (err) {
      console.error(`[caldav] calendar "${calendar.displayName}" failed:`, err);
    }
  }
}

async function syncOneCalendar(
  client: Awaited<ReturnType<typeof createDAVClient>>,
  account: AccountRow,
  calendar: { url: string; ctag?: string; displayName?: string },
  start: string,
  end: string
): Promise<void> {
  const [state] = await db
    .select()
    .from(dav_sync_state)
    .where(
      and(
        eq(dav_sync_state.account_id, account.id),
        eq(dav_sync_state.type, 'caldav'),
        eq(dav_sync_state.url, calendar.url)
      )
    )
    .limit(1);

  // Skip if ctag unchanged
  if (state?.ctag && state.ctag === calendar.ctag) {
    await db
      .update(dav_sync_state)
      .set({ last_synced_at: new Date() })
      .where(eq(dav_sync_state.id, state.id));
    return;
  }

  const objects = await client.fetchCalendarObjects({
    calendar: calendar as Parameters<typeof client.fetchCalendarObjects>[0]['calendar'],
    timeRange: { start, end },
  });

  const toInsert: Array<typeof calendar_events.$inferInsert> = [];

  for (const obj of objects) {
    if (!obj.data) continue;
    const parsed = parseICS(obj.data);

    for (const event of parsed) {
      toInsert.push({
        account_id: account.id,
        calendar_uid: event.uid,
        href: obj.url ?? null,
        etag: obj.etag ?? null,
        summary: event.summary ?? null,
        description: event.description ?? null,
        location: event.location ?? null,
        organizer: event.organizer ?? null,
        attendees: event.attendees as unknown as Record<string, unknown>[],
        start_time: event.start_time,
        end_time: event.end_time ?? null,
        all_day: event.all_day,
        recurrence_rule: event.recurrence_rule ?? null,
        status: event.status ?? 'CONFIRMED',
        raw_ical: obj.data,
      });
    }
  }

  // Upsert in batches
  for (let i = 0; i < toInsert.length; i += 50) {
    const batch = toInsert.slice(i, i + 50);
    if (batch.length === 0) continue;
    await db
      .insert(calendar_events)
      .values(batch)
      .onConflictDoUpdate({
        target: [calendar_events.account_id, calendar_events.calendar_uid],
        set: {
          summary: calendar_events.summary,
          description: calendar_events.description,
          location: calendar_events.location,
          start_time: calendar_events.start_time,
          end_time: calendar_events.end_time,
          all_day: calendar_events.all_day,
          attendees: calendar_events.attendees,
          status: calendar_events.status,
          etag: calendar_events.etag,
          raw_ical: calendar_events.raw_ical,
        },
      });
  }

  // Update sync state
  if (state) {
    await db
      .update(dav_sync_state)
      .set({ ctag: calendar.ctag ?? null, last_synced_at: new Date() })
      .where(eq(dav_sync_state.id, state.id));
  } else {
    await db.insert(dav_sync_state).values({
      account_id: account.id,
      type: 'caldav',
      url: calendar.url,
      ctag: calendar.ctag ?? null,
      last_synced_at: new Date(),
    });
  }
}
