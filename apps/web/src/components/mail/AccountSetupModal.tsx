import { useState } from 'react';
import { X, Loader2, ChevronDown } from 'lucide-react';
import { useMailStore } from '../../store/mail';
import { useAccounts } from '../../hooks/useAccounts';

const PRESETS: Record<string, { imap_host: string; imap_port: number; smtp_host: string; smtp_port: number }> = {
  Gmail: { imap_host: 'imap.gmail.com', imap_port: 993, smtp_host: 'smtp.gmail.com', smtp_port: 587 },
  Outlook: { imap_host: 'outlook.office365.com', imap_port: 993, smtp_host: 'smtp.office365.com', smtp_port: 587 },
  iCloud: { imap_host: 'imap.mail.me.com', imap_port: 993, smtp_host: 'smtp.mail.me.com', smtp_port: 587 },
  Fastmail: { imap_host: 'imap.fastmail.com', imap_port: 993, smtp_host: 'smtp.fastmail.com', smtp_port: 587 },
  Yahoo: { imap_host: 'imap.mail.yahoo.com', imap_port: 993, smtp_host: 'smtp.mail.yahoo.com', smtp_port: 587 },
};

export function AccountSetupModal() {
  const { accountSetupOpen, closeAccountSetup } = useMailStore();
  const { addAccount } = useAccounts();

  const [form, setForm] = useState({
    email: '',
    imap_host: '',
    imap_port: 993,
    smtp_host: '',
    smtp_port: 587,
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!accountSetupOpen) return null;

  const applyPreset = (name: string) => {
    const p = PRESETS[name];
    if (p) setForm((f) => ({ ...f, ...p, username: f.email }));
  };

  const set = (key: keyof typeof form, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleEmailChange = (email: string) => {
    setForm((f) => ({ ...f, email, username: email }));
  };

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      await addAccount({
        ...form,
        imap_port: Number(form.imap_port),
        smtp_port: Number(form.smtp_port),
      });
      closeAccountSetup();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Add mail account</h2>
          <button onClick={closeAccountSetup} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Provider presets */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">Quick setup</label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(PRESETS).map((name) => (
                <button
                  key={name}
                  onClick={() => applyPreset(name)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:text-blue-600 transition"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Email address</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Password / App password
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder="Use an App Password for Gmail/Outlook"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {/* IMAP / SMTP row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">IMAP host</label>
              <input
                type="text"
                value={form.imap_host}
                onChange={(e) => set('imap_host', e.target.value)}
                placeholder="imap.example.com"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">IMAP port</label>
              <input
                type="number"
                value={form.imap_port}
                onChange={(e) => set('imap_port', parseInt(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">SMTP host</label>
              <input
                type="text"
                value={form.smtp_host}
                onChange={(e) => set('smtp_host', e.target.value)}
                placeholder="smtp.example.com"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">SMTP port</label>
              <input
                type="number"
                value={form.smtp_port}
                onChange={(e) => set('smtp_port', parseInt(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>

          {/* Username override */}
          <details>
            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700 flex items-center gap-1">
              <ChevronDown className="w-3 h-3" /> Advanced: custom username
            </summary>
            <div className="mt-2">
              <input
                type="text"
                value={form.username}
                onChange={(e) => set('username', e.target.value)}
                placeholder="Login username (defaults to email)"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </details>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={closeAccountSetup}
            className="text-sm text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading || !form.email || !form.password || !form.imap_host || !form.smtp_host}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Connecting...' : 'Add account'}
          </button>
        </div>
      </div>
    </div>
  );
}
