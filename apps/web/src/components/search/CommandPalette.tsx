import { useEffect, useRef } from 'react';
import { useSearch } from '../../hooks/useSearch';
import type { SearchResults } from '../../lib/api';
import { useNavigationStore } from '../../store/navigation';

interface CommandPaletteProps {
  onClose: () => void;
  onSelectThread?: (threadId: string) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function CommandPalette({ onClose, onSelectThread }: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { results, loading, search, clear } = useSearch();
  const setSection = useNavigationStore((s) => s.setSection);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hits = results?.results;
  const total = hits
    ? hits.messages.length + hits.contacts.length + hits.events.length
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search messages, contacts, events…"
            onChange={(e) => search(e.target.value)}
            className="flex-1 text-sm focus:outline-none placeholder-slate-400"
          />
          {loading && <span className="text-xs text-slate-400">Searching…</span>}
          <kbd className="text-xs text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">esc</kbd>
        </div>

        {/* Results */}
        {hits && total === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-400">No results</div>
        )}

        {hits && total > 0 && (
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {/* Messages */}
            {hits.messages.length > 0 && (
              <section>
                <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">
                  Messages
                </div>
                {hits.messages.map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => {
                      setSection('mail');
                      onSelectThread?.(msg.thread_id);
                      onClose();
                    }}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-800 truncate">{msg.subject ?? '(no subject)'}</span>
                        <span className="text-xs text-slate-400 flex-shrink-0">{formatDate(msg.date)}</span>
                      </div>
                      <div className="text-xs text-slate-500 truncate">{msg.from_addr}</div>
                    </div>
                  </button>
                ))}
              </section>
            )}

            {/* Contacts */}
            {hits.contacts.length > 0 && (
              <section>
                <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">
                  Contacts
                </div>
                {hits.contacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => {
                      setSection('contacts');
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{contact.full_name ?? '(No name)'}</div>
                      {contact.organization && (
                        <div className="text-xs text-slate-500 truncate">{contact.organization}</div>
                      )}
                    </div>
                  </button>
                ))}
              </section>
            )}

            {/* Events */}
            {hits.events.length > 0 && (
              <section>
                <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">
                  Events
                </div>
                {hits.events.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => {
                      setSection('calendar');
                      onClose();
                    }}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-800 truncate">{event.summary ?? '(no title)'}</span>
                        <span className="text-xs text-slate-400 flex-shrink-0">{formatDate(event.start_time)}</span>
                      </div>
                      {event.location && (
                        <div className="text-xs text-slate-500 truncate">{event.location}</div>
                      )}
                    </div>
                  </button>
                ))}
              </section>
            )}
          </div>
        )}

        {/* Footer hint */}
        {!results && (
          <div className="px-4 py-6 text-center text-sm text-slate-400">
            Type at least 2 characters to search
          </div>
        )}
      </div>
    </div>
  );
}
