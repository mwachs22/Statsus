import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Reply } from 'lucide-react';
import type { Message } from '../../lib/api';

interface MessageBubbleProps {
  message: Message;
  defaultExpanded?: boolean;
  onReply: (message: Message) => void;
}

function formatFull(dateStr: string): string {
  return new Date(dateStr).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getInitial(addr: string): string {
  const match = addr.match(/^(.+?)\s*</);
  if (match) return match[1].trim()[0].toUpperCase();
  return addr[0]?.toUpperCase() ?? '?';
}

function senderName(addr: string): string {
  const match = addr.match(/^(.+?)\s*</);
  if (match) return match[1].trim();
  return addr.split('@')[0];
}

export function MessageBubble({ message, defaultExpanded = false, onReply }: MessageBubbleProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Auto-resize iframe to content height
  useEffect(() => {
    if (!expanded || !iframeRef.current || !message.html_body) return;
    const frame = iframeRef.current;
    const onLoad = () => {
      try {
        const doc = frame.contentDocument;
        if (doc) frame.style.height = doc.documentElement.scrollHeight + 'px';
      } catch { /* cross-origin */ }
    };
    frame.addEventListener('load', onLoad);
    return () => frame.removeEventListener('load', onLoad);
  }, [expanded, message.html_body]);

  const isUnread = !message.flags?.includes('\\Seen');

  return (
    <div className={`border border-slate-200 rounded-xl mb-3 overflow-hidden ${isUnread ? 'shadow-sm' : ''}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left"
      >
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
          {getInitial(message.from_addr ?? '')}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-900 truncate">
              {senderName(message.from_addr ?? '')}
            </span>
            <span className="text-xs text-slate-400 flex-shrink-0">{formatFull(message.date)}</span>
          </div>
          {!expanded && (
            <p className="text-xs text-slate-400 truncate mt-0.5">{message.body_preview}</p>
          )}
          {expanded && (
            <p className="text-xs text-slate-500 truncate mt-0.5">
              to {message.to_addr}
              {message.cc_addr && `, cc ${message.cc_addr}`}
            </p>
          )}
        </div>

        <div className="flex-shrink-0 text-slate-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="border-t border-slate-100">
          <div className="px-4 py-4">
            {message.html_body ? (
              <iframe
                ref={iframeRef}
                srcDoc={message.html_body}
                sandbox=""
                className="w-full border-0 min-h-[100px]"
                style={{ height: '400px' }}
                title="Email content"
              />
            ) : (
              <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                {message.text_body ?? message.body_preview ?? '(empty)'}
              </pre>
            )}
          </div>

          {/* Actions */}
          <div className="px-4 pb-3 flex gap-2">
            <button
              onClick={() => onReply(message)}
              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition"
            >
              <Reply className="w-4 h-4" />
              Reply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
