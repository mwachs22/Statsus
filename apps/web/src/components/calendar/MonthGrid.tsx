import type { CalendarEvent } from '../../lib/api';

interface MonthGridProps {
  year: number;
  month: number;
  events: Map<string, CalendarEvent[]>;
  selectedDate: string | null;
  onSelectDate: (dateKey: string) => void;
  onSelectEvent: (event: CalendarEvent) => void;
}

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EVENT_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-500',
  'bg-orange-500', 'bg-pink-500', 'bg-teal-500',
];

function eventColor(accountId: string): string {
  let hash = 0;
  for (let i = 0; i < accountId.length; i++) hash = (hash * 31 + accountId.charCodeAt(i)) & 0xffffffff;
  return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length];
}

function buildWeeks(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const startDow = first.getDay();

  const weeks: Date[][] = [];
  let week: Date[] = [];

  for (let i = 0; i < startDow; i++) {
    week.push(new Date(year, month, 1 - (startDow - i)));
  }
  for (let d = 1; d <= last.getDate(); d++) {
    week.push(new Date(year, month, d));
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    let next = 1;
    while (week.length < 7) week.push(new Date(year, month + 1, next++));
    weeks.push(week);
  }

  return weeks;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function MonthGrid({ year, month, events, selectedDate, onSelectDate, onSelectEvent }: MonthGridProps) {
  const today = new Date().toISOString().slice(0, 10);
  const weeks = buildWeeks(year, month);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-slate-200 flex-shrink-0">
        {DAY_HEADERS.map((h) => (
          <div key={h} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {h}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="flex-1 grid overflow-hidden" style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-slate-100 last:border-b-0">
            {week.map((day, di) => {
              const key = day.toISOString().slice(0, 10);
              const isCurrentMonth = day.getMonth() === month;
              const isToday = key === today;
              const isSelected = key === selectedDate;
              const dayEvents = events.get(key) ?? [];

              return (
                <div
                  key={di}
                  onClick={() => onSelectDate(key)}
                  className={`border-r border-slate-100 last:border-r-0 p-1.5 cursor-pointer transition min-h-0 overflow-hidden flex flex-col gap-0.5
                    ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}
                    ${!isCurrentMonth ? 'opacity-40' : ''}`}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-center mb-0.5">
                    <span
                      className={`w-6 h-6 flex items-center justify-center text-xs rounded-full
                        ${isToday ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 font-medium'}`}
                    >
                      {day.getDate()}
                    </span>
                  </div>

                  {/* Events (max 3 visible) */}
                  {dayEvents.slice(0, 3).map((event) => (
                    <button
                      key={event.id}
                      onClick={(e) => { e.stopPropagation(); onSelectEvent(event); }}
                      className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] text-white truncate ${eventColor(event.account_id)} hover:opacity-90 transition`}
                      title={event.summary}
                    >
                      {event.all_day ? '' : formatTime(event.start_time) + ' '}
                      {event.summary ?? '(no title)'}
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[10px] text-slate-500 pl-1">+{dayEvents.length - 3} more</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
