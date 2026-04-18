import { useState } from 'react';
import type { CalendarEvent } from '../../lib/api';
import { api } from '../../lib/api';

interface EventModalProps {
  event?: CalendarEvent | null;
  defaultDate?: string;
  accountId: string | null;
  onClose: () => void;
  onCreated?: () => void;
  onDeleted?: () => void;
}

function formatLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toISO(local: string): string {
  return new Date(local).toISOString();
}

export function EventModal({ event, defaultDate, accountId, onClose, onCreated, onDeleted }: EventModalProps) {
  const isNew = !event;
  const defaultStart = defaultDate
    ? `${defaultDate}T09:00`
    : formatLocalDatetime(new Date().toISOString());
  const defaultEnd = defaultDate
    ? `${defaultDate}T10:00`
    : formatLocalDatetime(new Date(Date.now() + 3_600_000).toISOString());

  const [summary, setSummary]     = useState(event?.summary ?? '');
  const [location, setLocation]   = useState(event?.location ?? '');
  const [startTime, setStartTime] = useState(event ? formatLocalDatetime(event.start_time) : defaultStart);
  const [endTime, setEndTime]     = useState(event ? (event.end_time ? formatLocalDatetime(event.end_time) : defaultEnd) : defaultEnd);
  const [allDay, setAllDay]       = useState(event?.all_day ?? false);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [error, setError]         = useState('');

  const handleSave = async () => {
    if (!summary.trim()) { setError('Title is required'); return; }
    if (!accountId) { setError('Select an account first'); return; }
    setSaving(true);
    setError('');
    try {
      const data = {
        account_id: accountId,
        summary: summary.trim(),
        location: location.trim() || undefined,
        start_time: allDay ? `${startTime.slice(0, 10)}T00:00:00.000Z` : toISO(startTime),
        end_time:   allDay ? `${endTime.slice(0, 10)}T23:59:59.000Z`   : toISO(endTime),
        all_day: allDay,
      };
      await api.calendar.create(data);
      onCreated?.();
      onClose();
    } catch {
      setError('Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    setDeleting(true);
    try {
      await api.calendar.remove(event.id);
      onDeleted?.();
      onClose();
    } catch {
      setError('Failed to delete event');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">
            {isNew ? 'New Event' : 'Event'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition text-xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Title */}
          <input
            autoFocus
            type="text"
            placeholder="Title"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            disabled={!isNew}
            className="w-full text-lg font-medium border-0 border-b border-slate-200 pb-1 focus:outline-none focus:border-blue-500 transition disabled:text-slate-700 disabled:bg-transparent"
          />

          {/* All day toggle */}
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              disabled={!isNew}
              className="rounded"
            />
            All day
          </label>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Start</label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={allDay ? startTime.slice(0, 10) : startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={!isNew}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 transition disabled:bg-slate-50 disabled:text-slate-600"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">End</label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={allDay ? endTime.slice(0, 10) : endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={!isNew}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 transition disabled:bg-slate-50 disabled:text-slate-600"
              />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Location</label>
            <input
              type="text"
              placeholder="Add location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={!isNew}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 transition disabled:bg-slate-50 disabled:text-slate-600"
            />
          </div>

          {/* Synced badge */}
          {event && (
            <p className="text-xs text-slate-400">
              {event.calendar_uid?.startsWith('statsus-') ? 'Local event' : 'Synced from calendar'}
            </p>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50">
          {!isNew ? (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-red-500 hover:text-red-700 transition disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          ) : <div />}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition"
            >
              Cancel
            </button>
            {isNew && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
