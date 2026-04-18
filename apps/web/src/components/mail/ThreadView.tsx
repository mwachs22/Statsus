import { useState } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import { useThread } from '../../hooks/useMessages';
import { useAccounts } from '../../hooks/useAccounts';
import { MessageBubble } from './MessageBubble';
import { api, type Message } from '../../lib/api';
import { useMailStore } from '../../store/mail';

interface ThreadViewProps {
  threadId: string;
}

interface ReplyState {
  inReplyTo?: string;
  to: string;
  subject: string;
  text: string;
  accountId: string;
  references?: string;
}

export function ThreadView({ threadId }: ThreadViewProps) {
  const { messages, loading } = useThread(threadId);
  const { accounts } = useAccounts();
  const { selectedAccountId } = useMailStore();
  const [reply, setReply] = useState<ReplyState | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const openReply = (message: Message) => {
    const account = accounts.find((a) => a.id === (selectedAccountId ?? message.account_id));
    setReply({
      inReplyTo: message.message_id,
      to: message.from_addr ?? '',
      subject: message.subject?.startsWith('Re:') ? (message.subject ?? '') : `Re: ${message.subject ?? ''}`,
      text: '',
      accountId: account?.id ?? message.account_id,
      references: [message.in_reply_to, message.message_id].filter(Boolean).join(' '),
    });
  };

  const sendReply = async () => {
    if (!reply || !reply.text.trim()) return;
    setSending(true);
    setSendError('');
    try {
      await api.messages.send({
        account_id: reply.accountId,
        to: reply.to,
        subject: reply.subject,
        text: reply.text,
        in_reply_to: reply.inReplyTo,
        references: reply.references,
        thread_id: threadId,
      });
      setReply(null);
    } catch (err) {
      setSendError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (messages.length === 0) return null;

  const subject = messages[0].subject ?? '(no subject)';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Thread header */}
      <div className="px-6 h-14 flex items-center gap-3 border-b border-slate-200 flex-shrink-0">
        <h2 className="text-base font-semibold text-slate-900 flex-1 truncate">{subject}</h2>
        <span className="text-xs text-slate-400 flex-shrink-0">
          {messages.length} message{messages.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin">
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            defaultExpanded={i === messages.length - 1}
            onReply={openReply}
          />
        ))}
      </div>

      {/* Reply composer */}
      {reply && (
        <div className="border-t border-slate-200 p-4 flex-shrink-0 bg-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-slate-500">
              <span className="font-medium">To:</span> {reply.to}
            </div>
            <button onClick={() => setReply(null)} className="text-slate-400 hover:text-slate-700 p-1 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
          <textarea
            autoFocus
            value={reply.text}
            onChange={(e) => setReply((r) => r ? { ...r, text: e.target.value } : r)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply();
            }}
            placeholder="Write a reply... (⌘↵ to send)"
            rows={4}
            className="w-full text-sm resize-none border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-slate-800 placeholder-slate-400"
          />
          {sendError && <p className="text-xs text-red-500 mt-1">{sendError}</p>}
          <div className="flex justify-end mt-2">
            <button
              onClick={sendReply}
              disabled={sending || !reply.text.trim()}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
