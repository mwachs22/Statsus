import { useState, useEffect, useCallback } from 'react';
import { api, type CalendarEvent } from '../lib/api';

export function useCalendarEvents(accountId: string | null, year: number, month: number) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const start = new Date(year, month, 1).toISOString();
    const end   = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    try {
      const { events } = await api.calendar.events({
        account_id: accountId ?? undefined,
        start,
        end,
      });
      setEvents(events);
    } catch (err) {
      console.error('Calendar fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [accountId, year, month]);

  useEffect(() => { load(); }, [load]);

  const addEvent = async (data: Parameters<typeof api.calendar.create>[0]) => {
    const { event } = await api.calendar.create(data);
    setEvents((prev) => [...prev, event].sort((a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    ));
    return event;
  };

  const removeEvent = async (id: string) => {
    await api.calendar.remove(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  return { events, loading, reload: load, addEvent, removeEvent };
}

/** Group events by YYYY-MM-DD key */
export function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = new Date(event.start_time).toISOString().slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(event);
  }
  return map;
}
