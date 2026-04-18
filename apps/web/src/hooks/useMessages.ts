import { useState, useEffect, useCallback } from 'react';
import { api, type ThreadSummary, type Message } from '../lib/api';

export function useThreads(accountId: string | null, folder: string) {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accountId) { setThreads([]); return; }
    setLoading(true);
    setError(null);
    try {
      const { threads } = await api.messages.threads({ account_id: accountId, folder });
      setThreads(threads);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [accountId, folder]);

  useEffect(() => { load(); }, [load]);

  // Update a thread's unread count locally when user opens it
  const markThreadRead = (threadId: string) => {
    setThreads((prev) =>
      prev.map((t) => (t.thread_id === threadId ? { ...t, unread_count: 0 } : t))
    );
  };

  return { threads, loading, error, reload: load, markThreadRead };
}

export function useThread(threadId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!threadId) { setMessages([]); return; }
    setLoading(true);
    setError(null);
    api.messages
      .thread(threadId)
      .then(({ messages }) => setMessages(messages))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [threadId]);

  return { messages, loading, error };
}
