/**
 * Lightweight localStorage-backed mutation queue for offline support.
 *
 * When the app detects a network error on a write (POST/PUT/PATCH/DELETE),
 * it can enqueue the operation here. When connectivity resumes, useSyncQueue
 * drains the queue by replaying each request.
 *
 * Intentionally simple: no IndexedDB, no service-worker BackgroundSync.
 * Trade-off: queue is lost if the tab is closed before reconnect. Acceptable
 * for a webmail app where most writes are low-stakes (todo toggles, flag changes).
 */

export interface QueuedMutation {
  id:        string;
  url:       string;
  method:    'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?:     string;          // JSON string
  label:     string;          // Human-readable, shown in OfflineBanner
  timestamp: number;
}

const STORAGE_KEY = 'statsus:sync_queue';

function read(): QueuedMutation[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function write(items: QueuedMutation[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function enqueue(item: Omit<QueuedMutation, 'id' | 'timestamp'>): void {
  const queue = read();
  queue.push({ ...item, id: crypto.randomUUID(), timestamp: Date.now() });
  write(queue);
}

export function dequeue(id: string): void {
  write(read().filter((item) => item.id !== id));
}

export function getQueue(): QueuedMutation[] {
  return read();
}

export function clearQueue(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function queueSize(): number {
  return read().length;
}
