import { useEffect, useRef } from 'react';

export interface ShortcutDef {
  action: string;
  key: string;         // e.g. 'c', 'g m', 'meta+enter'
  scope: 'global' | 'compose' | 'list';
  label: string;
  group: string;
}

export const DEFAULT_SHORTCUTS: ShortcutDef[] = [
  // Global navigation
  { action: 'compose',        key: 'c',           scope: 'global',  label: 'Compose new message',   group: 'Mail' },
  { action: 'search',         key: '/',           scope: 'global',  label: 'Open search',           group: 'Navigation' },
  { action: 'shortcuts',      key: '?',           scope: 'global',  label: 'Show keyboard shortcuts', group: 'Navigation' },
  { action: 'go_mail',        key: 'g m',         scope: 'global',  label: 'Go to Mail',            group: 'Navigation' },
  { action: 'go_calendar',    key: 'g c',         scope: 'global',  label: 'Go to Calendar',        group: 'Navigation' },
  { action: 'go_contacts',    key: 'g p',         scope: 'global',  label: 'Go to People',          group: 'Navigation' },
  { action: 'go_filters',     key: 'g f',         scope: 'global',  label: 'Go to Filters',         group: 'Navigation' },
  { action: 'go_settings',    key: 'g s',         scope: 'global',  label: 'Go to Settings',         group: 'Navigation' },
  { action: 'toggle_todos',   key: 't',           scope: 'global',  label: 'Toggle todo panel',      group: 'Navigation' },
  // Mail list
  { action: 'next_thread',    key: 'j',           scope: 'list',    label: 'Next conversation',     group: 'Mail list' },
  { action: 'prev_thread',    key: 'k',           scope: 'list',    label: 'Previous conversation', group: 'Mail list' },
  { action: 'archive',        key: 'e',           scope: 'list',    label: 'Archive selected',      group: 'Mail list' },
  { action: 'trash',          key: '#',           scope: 'list',    label: 'Move to trash',         group: 'Mail list' },
  // Compose
  { action: 'send',           key: 'meta+enter',  scope: 'compose', label: 'Send message',          group: 'Compose' },
  { action: 'close_compose',  key: 'escape',      scope: 'compose', label: 'Close compose',         group: 'Compose' },
  { action: 'snippet_picker', key: 'meta+/',      scope: 'compose', label: 'Insert snippet',        group: 'Compose' },
];

function buildKeyString(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push('meta');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey && e.key.length > 1) parts.push('shift');
  const k = e.key.toLowerCase();
  if (k !== 'meta' && k !== 'control' && k !== 'alt' && k !== 'shift') parts.push(k);
  return parts.join('+');
}

/**
 * Register global shortcut handlers. `handlers` is a map from action name → callback.
 * Handles single keys, modifier combos, and two-key sequences (e.g. 'g m').
 * Does NOT fire when the active element is an input/textarea/contenteditable.
 */
export function useShortcuts(
  handlers: Partial<Record<string, () => void>>,
  shortcuts: ShortcutDef[] = DEFAULT_SHORTCUTS
) {
  const seqRef   = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Build key→action map from shortcut definitions + handler existence
  const keyMap = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const map = new Map<string, string>();
    for (const s of shortcuts) {
      if (handlers[s.action]) map.set(s.key, s.action);
    }
    keyMap.current = map;
  }, [shortcuts, handlers]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
      if (inInput) return;

      const key = buildKeyString(e);

      // Check pending two-key sequence
      if (seqRef.current !== null) {
        const seq = `${seqRef.current} ${key}`;
        const action = keyMap.current.get(seq);
        seqRef.current = null;
        clearTimeout(timerRef.current);
        if (action && handlers[action]) {
          e.preventDefault();
          handlers[action]!();
          return;
        }
      }

      const action = keyMap.current.get(key);
      if (action && handlers[action]) {
        e.preventDefault();
        handlers[action]!();
        return;
      }

      // Start sequence if 'g' is a prefix for any registered shortcut
      if (key === 'g' && [...keyMap.current.keys()].some((k) => k.startsWith('g '))) {
        seqRef.current = 'g';
        timerRef.current = setTimeout(() => { seqRef.current = null; }, 1200);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(timerRef.current);
    };
  }, [handlers]);
}
