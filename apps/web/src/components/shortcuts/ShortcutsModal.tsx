import { useEffect } from 'react';
import { DEFAULT_SHORTCUTS } from '../../hooks/useShortcuts';

interface ShortcutsModalProps {
  onClose: () => void;
}

function KeyBadge({ combo }: { combo: string }) {
  const parts = combo.split('+');
  return (
    <span className="inline-flex items-center gap-0.5">
      {parts.map((part, i) => (
        <kbd
          key={i}
          className="inline-block px-1.5 py-0.5 text-[11px] font-mono bg-slate-100 border border-slate-300 rounded shadow-sm text-slate-700"
        >
          {part === 'meta' ? '⌘' : part === 'escape' ? 'Esc' : part === 'enter' ? '↵' : part}
        </kbd>
      ))}
    </span>
  );
}

function SeqBadge({ seq }: { seq: string }) {
  const parts = seq.split(' ');
  return (
    <span className="inline-flex items-center gap-1">
      {parts.map((part, i) => (
        <span key={i} className="inline-flex items-center gap-0.5">
          {i > 0 && <span className="text-slate-400 text-xs">then</span>}
          <KeyBadge combo={part} />
        </span>
      ))}
    </span>
  );
}

export function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Group shortcuts by group label
  const groups = DEFAULT_SHORTCUTS.reduce<Record<string, typeof DEFAULT_SHORTCUTS>>((acc, s) => {
    (acc[s.group] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Keyboard shortcuts</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {Object.entries(groups).map(([group, shortcuts]) => (
            <div key={group}>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{group}</h3>
              <div className="space-y-1">
                {shortcuts.map((s) => (
                  <div key={s.action} className="flex items-center justify-between py-1">
                    <span className="text-sm text-slate-700">{s.label}</span>
                    <SeqBadge seq={s.key} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-400 text-center">
          Press <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded text-slate-600">?</kbd> to toggle this panel
        </div>
      </div>
    </div>
  );
}
