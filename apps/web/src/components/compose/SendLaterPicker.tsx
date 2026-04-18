import { useState } from 'react';
import { Clock, X } from 'lucide-react';

interface SendLaterPickerProps {
  onSchedule: (isoDatetime: string) => void;
  onClose: () => void;
}

const PRESETS = [
  { label: 'In 1 hour',       hours: 1 },
  { label: 'Tomorrow morning', hours: 18 }, // rough offset; real impl: next 9am
  { label: 'In 2 hours',      hours: 2 },
  { label: 'Tonight 8pm',     hours: null, id: 'tonight' },
];

function addHours(h: number): string {
  return new Date(Date.now() + h * 3_600_000).toISOString();
}

function tonightAt8(): string {
  const d = new Date();
  d.setHours(20, 0, 0, 0);
  if (d <= new Date()) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

export function SendLaterPicker({ onSchedule, onClose }: SendLaterPickerProps) {
  const [custom, setCustom] = useState('');

  const handlePreset = (p: typeof PRESETS[number]) => {
    const iso = p.id === 'tonight' ? tonightAt8() : addHours(p.hours!);
    onSchedule(iso);
  };

  const handleCustom = () => {
    if (!custom) return;
    onSchedule(new Date(custom).toISOString());
  };

  return (
    <div className="absolute bottom-full right-0 mb-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
        <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <Clock className="w-4 h-4" /> Send later
        </span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-2 space-y-1">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => handlePreset(p)}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="px-3 pb-3 border-t border-slate-100 pt-2">
        <label className="block text-xs text-slate-500 mb-1">Custom date & time</label>
        <input
          type="datetime-local"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleCustom}
          disabled={!custom}
          className="mt-2 w-full bg-blue-600 disabled:opacity-40 text-white text-sm font-medium py-1.5 rounded-lg hover:bg-blue-700 transition"
        >
          Schedule
        </button>
      </div>
    </div>
  );
}
