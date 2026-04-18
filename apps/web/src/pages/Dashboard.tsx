import { LogOut, Mail } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-accent-600" />
          <span className="font-semibold text-slate-900 dark:text-slate-50">Statsus</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</span>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </header>

      {/* Placeholder content */}
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-accent-50 dark:bg-accent-950 rounded-2xl flex items-center justify-center mx-auto">
            <Mail className="w-8 h-8 text-accent-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
            Phase 1 complete
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
            Auth works. Mail sync, thread UI, and calendar are coming in Phase 2.
          </p>
        </div>
      </main>
    </div>
  );
}
