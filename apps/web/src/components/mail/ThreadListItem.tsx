import type { ThreadSummary } from '../../lib/api';

interface ThreadListItemProps {
  thread: ThreadSummary;
  isSelected: boolean;
  onClick: () => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getInitial(addr: string): string {
  // Try to get name from "Name <email>" format
  const match = addr.match(/^(.+?)\s*</);
  if (match) return match[1].trim()[0].toUpperCase();
  return addr[0]?.toUpperCase() ?? '?';
}

function senderName(addr: string): string {
  const match = addr.match(/^(.+?)\s*</);
  if (match) return match[1].trim();
  return addr.split('@')[0];
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-rose-500', 'bg-indigo-500',
];

function avatarColor(addr: string): string {
  let hash = 0;
  for (let i = 0; i < addr.length; i++) hash = (hash * 31 + addr.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function ThreadListItem({ thread, isSelected, onClick }: ThreadListItemProps) {
  const isUnread = thread.unread_count > 0;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-4 py-3 border-b border-slate-100 text-left transition ${
        isSelected
          ? 'bg-blue-50 border-l-2 border-l-blue-500'
          : 'hover:bg-slate-50 border-l-2 border-l-transparent'
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-semibold mt-0.5 ${avatarColor(thread.from_addr)}`}
      >
        {getInitial(thread.from_addr)}
      </div>

      <div className="flex-1 min-w-0">
        {/* Row 1: sender + date */}
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span
            className={`text-sm truncate ${
              isUnread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'
            }`}
          >
            {senderName(thread.from_addr)}
            {thread.message_count > 1 && (
              <span className="ml-1 text-xs text-slate-400 font-normal">
                {thread.message_count}
              </span>
            )}
          </span>
          <span className={`text-xs flex-shrink-0 ${isUnread ? 'text-blue-600 font-medium' : 'text-slate-400'}`}>
            {formatDate(thread.date)}
          </span>
        </div>

        {/* Row 2: subject */}
        <p
          className={`text-sm truncate ${
            isUnread ? 'font-semibold text-slate-900' : 'text-slate-600'
          }`}
        >
          {thread.subject}
        </p>

        {/* Row 3: preview */}
        <p className="text-xs text-slate-400 truncate mt-0.5">{thread.body_preview}</p>
      </div>

      {/* Unread dot */}
      {isUnread && (
        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
      )}
    </button>
  );
}
