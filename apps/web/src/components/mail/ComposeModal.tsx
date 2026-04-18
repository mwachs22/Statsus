import { useState } from 'react';
import { X, Send, Loader2, Minus, Maximize2, Clock, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';
import type { Account } from '../../lib/api';
import { useMailStore } from '../../store/mail';
import { SnippetPicker } from '../compose/SnippetPicker';
import { SendLaterPicker } from '../compose/SendLaterPicker';
import { AIAssist } from '../compose/AIAssist';

interface ComposeModalProps {
  accounts: Account[];
}

export function ComposeModal({ accounts }: ComposeModalProps) {
  const { composeOpen, composeReplyTo, closeCompose, selectedAccountId } = useMailStore();
  const [minimized, setMinimized] = useState(false);
  const [to, setTo] = useState(composeReplyTo?.to ?? '');
  const [subject, setSubject] = useState(composeReplyTo?.subject ?? '');
  const [body, setBody] = useState('');
  const [accountId, setAccountId] = useState(selectedAccountId ?? accounts[0]?.id ?? '');
  const [sending, setSending]         = useState(false);
  const [error, setError]             = useState('');
  const [snippetOpen, setSnippetOpen] = useState(false);
  const [sendLaterOpen, setSendLaterOpen] = useState(false);
  const [aiOpen, setAiOpen]           = useState(false);

  if (!composeOpen) return null;

  const send = async () => {
    if (!to.trim() || !subject.trim() || !body.trim() || !accountId) return;
    setSending(true);
    setError('');
    try {
      await api.messages.send({
        account_id: accountId,
        to,
        subject,
        text: body,
        ...(composeReplyTo?.inReplyTo ? { in_reply_to: composeReplyTo.inReplyTo } : {}),
        ...(composeReplyTo?.threadId ? { thread_id: composeReplyTo.threadId } : {}),
      });
      closeCompose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const sendLater = async (scheduledAt: string) => {
    if (!to.trim() || !subject.trim() || !accountId) return;
    setSending(true);
    setError('');
    setSendLaterOpen(false);
    try {
      await api.scheduled.create({
        account_id:   accountId,
        scheduled_at: scheduledAt,
        to,
        subject,
        text: body,
        ...(composeReplyTo?.inReplyTo ? { in_reply_to: composeReplyTo.inReplyTo } : {}),
      });
      closeCompose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-0 right-6 z-50 w-[520px] shadow-2xl rounded-t-xl overflow-hidden border border-slate-200">
      {/* Title bar */}
      <div className="bg-slate-800 px-4 py-2.5 flex items-center justify-between">
        <span className="text-sm font-medium text-white">
          {composeReplyTo ? 'Reply' : 'New message'}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized((m) => !m)}
            className="p-1 text-slate-400 hover:text-white rounded transition"
          >
            {minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          </button>
          <button onClick={closeCompose} className="p-1 text-slate-400 hover:text-white rounded transition">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="bg-white">
          {/* From */}
          {accounts.length > 1 && (
            <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2">
              <label className="text-xs text-slate-500 w-12">From</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="flex-1 text-sm text-slate-800 bg-transparent focus:outline-none"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.email}</option>
                ))}
              </select>
            </div>
          )}

          {/* To */}
          <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2">
            <label className="text-xs text-slate-500 w-12">To</label>
            <input
              autoFocus
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="flex-1 text-sm text-slate-800 focus:outline-none placeholder-slate-400"
            />
          </div>

          {/* Subject */}
          <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2">
            <label className="text-xs text-slate-500 w-12">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 text-sm text-slate-800 focus:outline-none placeholder-slate-400"
            />
          </div>

          {/* Body */}
          <div className="relative">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { send(); return; }
                if (e.key === '/' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setSnippetOpen(true); }
              }}
              placeholder="Write your message… (⌘↵ to send, ⌘/ for snippets)"
              rows={10}
              className="w-full px-4 py-3 text-sm text-slate-800 resize-none focus:outline-none placeholder-slate-400"
            />
            {snippetOpen && (
              <SnippetPicker
                onInsert={(content) => setBody((b) => b + content)}
                onClose={() => setSnippetOpen(false)}
              />
            )}
            {aiOpen && (
              <AIAssist
                body={body}
                onReplace={(text) => setBody(text)}
                onClose={() => setAiOpen(false)}
              />
            )}
            {sendLaterOpen && (
              <SendLaterPicker
                onSchedule={sendLater}
                onClose={() => setSendLaterOpen(false)}
              />
            )}
          </div>

          {/* Footer */}
          {error && (
            <p className="px-4 text-xs text-red-500 pb-1">{error}</p>
          )}
          <div className="px-4 pb-3 pt-1 flex items-center justify-between border-t border-slate-100">
            <div className="flex items-center gap-2">
              <button
                onClick={closeCompose}
                className="text-sm text-slate-500 hover:text-slate-800 transition"
              >
                Discard
              </button>
              <button
                onClick={() => setSnippetOpen((v) => !v)}
                title="Insert snippet (⌘/)"
                className="text-xs text-slate-400 hover:text-blue-600 transition px-2 py-1 rounded hover:bg-blue-50"
              >
                Snippets
              </button>
              <button
                onClick={() => { setAiOpen((v) => !v); setSendLaterOpen(false); }}
                title="AI Assist"
                className="text-xs text-slate-400 hover:text-blue-600 transition px-2 py-1 rounded hover:bg-blue-50 flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                AI
              </button>
            </div>
            <div className="flex items-center gap-1.5 relative">
              <button
                onClick={send}
                disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-l-lg transition"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </button>
              <button
                onClick={() => { setSendLaterOpen((v) => !v); setAiOpen(false); }}
                title="Send later"
                disabled={sending || !to.trim() || !subject.trim()}
                className="flex items-center bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-2 py-2 rounded-r-lg border-l border-blue-500 transition"
              >
                <Clock className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
