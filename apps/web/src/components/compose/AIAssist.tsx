import { useState } from 'react';
import { Sparkles, Loader2, X } from 'lucide-react';
import { useAI } from '../../hooks/useAI';

interface AIAssistProps {
  body: string;
  onReplace: (text: string) => void;
  onClose: () => void;
}

const IMPROVE_OPTIONS = [
  { label: 'Improve',   instruction: undefined },
  { label: 'Shorter',   instruction: 'Make this email significantly shorter while keeping all key information.' },
  { label: 'Formal',    instruction: 'Rewrite this email in a formal, professional tone.' },
  { label: 'Friendly',  instruction: 'Rewrite this email in a warm, friendly tone.' },
];

export function AIAssist({ body, onReplace, onClose }: AIAssistProps) {
  const { working, error, compose, improve } = useAI();
  const [prompt, setPrompt]   = useState('');
  const [preview, setPreview] = useState('');
  const [mode, setMode]       = useState<'improve' | 'compose'>('improve');

  const runImprove = async (instruction?: string) => {
    if (!body.trim() && mode === 'improve') return;
    const result = await improve(body, instruction);
    if (result) setPreview(result);
  };

  const runCompose = async () => {
    if (!prompt.trim()) return;
    const result = await compose(prompt);
    if (result) setPreview(result);
  };

  const accept = () => {
    if (preview) { onReplace(preview); onClose(); }
  };

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 mx-3 bg-white border border-slate-200 rounded-xl shadow-xl z-50">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
        <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <Sparkles className="w-4 h-4 text-blue-500" /> AI Assist
        </span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Mode toggle */}
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => setMode('improve')}
            className={`px-2 py-1 rounded-md transition ${mode === 'improve' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            Improve current
          </button>
          <button
            onClick={() => setMode('compose')}
            className={`px-2 py-1 rounded-md transition ${mode === 'compose' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            Compose from prompt
          </button>
        </div>

        {mode === 'improve' && (
          <div className="flex flex-wrap gap-1.5">
            {IMPROVE_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => runImprove(opt.instruction)}
                disabled={working || !body.trim()}
                className="text-xs px-2.5 py-1 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 transition"
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {mode === 'compose' && (
          <div className="flex gap-2">
            <input
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runCompose(); }}
              placeholder="Describe the email you want to write…"
              className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={runCompose}
              disabled={working || !prompt.trim()}
              className="flex items-center gap-1 bg-blue-600 disabled:opacity-40 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700 transition"
            >
              {working ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Generate
            </button>
          </div>
        )}

        {working && mode === 'improve' && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        {preview && (
          <div className="space-y-2">
            <div className="bg-slate-50 rounded-lg p-2.5 text-sm text-slate-700 max-h-40 overflow-y-auto whitespace-pre-wrap">
              {preview}
            </div>
            <div className="flex gap-2">
              <button
                onClick={accept}
                className="flex-1 bg-blue-600 text-white text-sm font-medium py-1.5 rounded-lg hover:bg-blue-700 transition"
              >
                Use this
              </button>
              <button
                onClick={() => setPreview('')}
                className="text-sm text-slate-500 hover:text-slate-700 transition px-3"
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
