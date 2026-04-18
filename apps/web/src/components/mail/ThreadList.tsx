import { Search, Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { ThreadSummary } from '../../lib/api';
import { ThreadListItem } from './ThreadListItem';

interface ThreadListProps {
  threads: ThreadSummary[];
  selectedThreadId: string | null;
  loading: boolean;
  folder: string;
  onSelectThread: (threadId: string) => void;
  onReload: () => void;
}

export function ThreadList({
  threads,
  selectedThreadId,
  loading,
  folder,
  onSelectThread,
  onReload,
}: ThreadListProps) {
  const [query, setQuery] = useState('');

  const filtered = query
    ? threads.filter(
        (t) =>
          t.subject.toLowerCase().includes(query.toLowerCase()) ||
          t.from_addr.toLowerCase().includes(query.toLowerCase()) ||
          t.body_preview?.toLowerCase().includes(query.toLowerCase())
      )
    : threads;

  return (
    <div className="w-80 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white h-full">
      {/* Header */}
      <div className="px-4 h-14 flex items-center justify-between border-b border-slate-100 flex-shrink-0">
        <h2 className="text-sm font-semibold text-slate-800">{folder}</h2>
        <button
          onClick={onReload}
          disabled={loading}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2.5 border-b border-slate-100 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="search"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-100 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-blue-500/30 placeholder-slate-400"
          />
        </div>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading && threads.length === 0 ? (
          <div className="flex items-center justify-center h-32 gap-2 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <p className="text-sm">{query ? 'No results' : 'No messages'}</p>
          </div>
        ) : (
          filtered.map((thread) => (
            <ThreadListItem
              key={thread.thread_id}
              thread={thread}
              isSelected={thread.thread_id === selectedThreadId}
              onClick={() => onSelectThread(thread.thread_id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
