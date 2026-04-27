import { useState, useEffect, useCallback } from 'react';
import { getQueue, dequeue, queueSize } from '../lib/sync-queue';
import { useNetworkStatus } from './useNetworkStatus';

/**
 * Watches network status and drains the offline mutation queue when
 * connectivity is restored. Returns the current pending count so
 * OfflineBanner can show "3 changes pending sync".
 */
export function useSyncQueue() {
  const online  = useNetworkStatus();
  const [pending, setPending] = useState(0);

  // Load initial queue size
  useEffect(() => {
    queueSize().then(setPending).catch(() => setPending(0));
  }, []);

  const drain = useCallback(async () => {
    const queue = await getQueue();
    if (queue.length === 0) return;

    for (const item of queue) {
      try {
        const res = await fetch(item.url, {
          method:      item.method,
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        item.body,
        });
        if (res.ok) {
          await dequeue(item.id);
          setPending((n) => Math.max(0, n - 1));
        }
      } catch {
        break;
      }
    }
    const remaining = await queueSize();
    setPending(remaining);
  }, []);

  // Drain immediately when we come back online
  useEffect(() => {
    if (online) {
      drain().catch(console.error);
    }
  }, [online, drain]);

  return pending;
}
