import { useEffect, useRef, useState } from 'react';
import { useMailStore } from '../../store/mail';
import { useAccountListStore } from '../../store/accounts';
import { api } from '../../lib/api';

function avatarColor(id: string): string {
  const COLORS = [
    'bg-blue-500', 'bg-purple-500', 'bg-green-500',
    'bg-orange-500', 'bg-teal-500', 'bg-pink-500',
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function AccountSwitcher() {
  const { selectedAccountId, setSelectedAccount, openAccountSetup } = useMailStore();
  const { accounts } = useAccountListStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = accounts.find((a) => a.id === selectedAccountId);
  const isAll = selectedAccountId === null;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSync = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    api.accounts.sync(id).catch(console.error);
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger — compact avatar in NavRail */}
      <button
        onClick={() => setOpen((v) => !v)}
        title={isAll ? 'All accounts' : selected?.email ?? 'Switch account'}
        className={`w-10 h-10 flex items-center justify-center rounded-xl transition
          ${open ? 'bg-blue-50 ring-2 ring-blue-200' : 'hover:bg-slate-100'}`}
      >
        {isAll ? (
          <span className="text-[11px] font-bold text-slate-500">ALL</span>
        ) : (
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${avatarColor(selectedAccountId ?? 'x')}`}>
            {(selected?.email?.[0] ?? '?').toUpperCase()}
          </div>
        )}
      </button>

      {/* Dropdown — positioned to the right of the NavRail */}
      {open && (
        <div className="absolute left-12 top-0 z-50 w-64 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Accounts</span>
          </div>

          {/* All accounts */}
          <button
            onClick={() => { setSelectedAccount(null); setOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50
              ${isAll ? 'bg-blue-50' : ''}`}
          >
            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-[10px] font-bold flex-shrink-0">
              ALL
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium truncate ${isAll ? 'text-blue-700' : 'text-slate-700'}`}>
                All accounts
              </div>
            </div>
            {isAll && <span className="text-blue-600 text-xs">✓</span>}
          </button>

          {accounts.map((account) => {
            const isSelected = account.id === selectedAccountId;
            return (
              <button
                key={account.id}
                onClick={() => { setSelectedAccount(account.id); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 group
                  ${isSelected ? 'bg-blue-50' : ''}`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${avatarColor(account.id)}`}>
                  {account.email[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                    {account.email}
                  </div>
                  <div className={`text-xs truncate ${account.status === 'active' ? 'text-slate-400' : 'text-orange-500'}`}>
                    {account.status}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isSelected && <span className="text-blue-600 text-xs">✓</span>}
                  <button
                    onClick={(e) => handleSync(e, account.id)}
                    title="Sync now"
                    className="opacity-0 group-hover:opacity-100 transition p-1 rounded hover:bg-slate-200 text-slate-500"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </button>
            );
          })}

          {/* Add account */}
          <div className="border-t border-slate-100">
            <button
              onClick={() => { openAccountSetup(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition text-slate-500 hover:text-slate-700"
            >
              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-sm">Add account</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
