import { useState } from 'react';
import { useCalendarEvents, groupEventsByDate } from '../hooks/useCalendar';
import { MonthGrid } from '../components/calendar/MonthGrid';
import { EventModal } from '../components/calendar/EventModal';

interface CalendarPageProps {
  accountId: string | null;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function CalendarPage({ accountId }: CalendarPageProps) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate]     = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent]   = useState<CalendarEvent | null>(null);
  const [showNewModal, setShowNewModal]     = useState(false);

  const { events, loading, reload } = useCalendarEvents(accountId, year, month);
  const eventMap = groupEventsByDate(events);

  const prev = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const next = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };
  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); };

  const handleDateClick = (dateKey: string) => {
    setSelectedDate(dateKey);
    setShowNewModal(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition text-slate-700"
          >
            Today
          </button>
          <div className="flex">
            <button
              onClick={prev}
              className="w-8 h-8 flex items-center justify-center rounded-l-lg border border-slate-200 hover:bg-slate-50 transition text-slate-600"
            >
              ‹
            </button>
            <button
              onClick={next}
              className="w-8 h-8 flex items-center justify-center rounded-r-lg border border-slate-200 border-l-0 hover:bg-slate-50 transition text-slate-600"
            >
              ›
            </button>
          </div>
          <h1 className="text-lg font-semibold text-slate-800">
            {MONTH_NAMES[month]} {year}
          </h1>
          {loading && <span className="text-xs text-slate-400">Syncing…</span>}
        </div>
        <button
          onClick={() => { setSelectedDate(null); setShowNewModal(true); }}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          + New event
        </button>
      </div>

      {/* Grid */}
      <MonthGrid
        year={year}
        month={month}
        events={eventMap}
        selectedDate={selectedDate}
        onSelectDate={handleDateClick}
        onSelectEvent={(ev) => { setSelectedEvent(ev); setShowNewModal(false); }}
      />

      {/* New event modal */}
      {showNewModal && (
        <EventModal
          defaultDate={selectedDate ?? undefined}
          accountId={accountId}
          onClose={() => setShowNewModal(false)}
          onCreated={() => reload()}
        />
      )}

      {/* View/delete existing event */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          accountId={accountId}
          onClose={() => setSelectedEvent(null)}
          onDeleted={() => { setSelectedEvent(null); reload(); }}
        />
      )}
    </div>
  );
}
