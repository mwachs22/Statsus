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
  const [pending, setPending] = useState(() => queueSize());

  const drain = useCallback(async () => {
    const queue = getQueue();
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
          dequeue(item.id);
          setPending((n) => Math.max(0, n - 1));
        }
      } catch {
        // Still offline or server error — leave in queue, try again next reconnect
        break;
      }
    }
    setPending(queueSize());
  }, []);

  // Drain immediately when we come back online
  useEffect(() => {
    if (online) {
      drain().catch(console.error);
    }
  }, [online, drain]);

  return pending;
}
