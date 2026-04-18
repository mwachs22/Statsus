import { useEffect, useRef, useState } from 'react';
import { useSnippets } from '../../hooks/useSnippets';
import { api } from '../../lib/api';
import type { Snippet } from '../../lib/api';

interface SnippetPickerProps {
  onInsert: (content: string) => void;
  onClose: () => void;
}

/** Replace {{variable}} placeholders in snippet content */
function expandVariables(content: string): string {
  const now = new Date();
  return content
    .replace(/\{\{date\}\}/gi, now.toLocaleDateString())
    .replace(/\{\{time\}\}/gi, now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))
    .replace(/\{\{datetime\}\}/gi, now.toLocaleString());
}

export function SnippetPicker({ onInsert, onClose }: SnippetPickerProps) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { snippets, loading } = useSnippets(search);

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSelect = (snippet: Snippet) => {
    onInsert(expandVariables(snippet.content));
    api.snippets.use(snippet.id).catch(console.error);
    onClose();
  };

  return (
    <div
      className="absolute bottom-full mb-1 left-0 right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
        <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search snippets…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 text-sm focus:outline-none"
        />
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
      </div>

      {/* Snippet list */}
      <div className="max-h-48 overflow-y-auto">
        {loading && (
          <div className="px-4 py-4 text-xs text-slate-400 text-center">Loading…</div>
        )}
        {!loading && snippets.length === 0 && (
          <div className="px-4 py-4 text-xs text-slate-400 text-center">
            {search ? 'No snippets match' : 'No snippets yet — create them in Filters & Settings'}
          </div>
        )}
        {snippets.map((snippet) => (
          <button
            key={snippet.id}
            onClick={() => handleSelect(snippet)}
            className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition border-b border-slate-50 last:border-b-0"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-800 truncate">{snippet.title}</div>
              <div className="text-xs text-slate-500 truncate mt-0.5">
                {snippet.content.slice(0, 80).replace(/\n/g, ' ')}
              </div>
            </div>
            {snippet.usage_count > 0 && (
              <span className="text-[10px] text-slate-400 flex-shrink-0 mt-0.5">{snippet.usage_count}×</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
