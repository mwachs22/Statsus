import { useAuth } from './hooks/useAuth';
import AuthPage from './pages/AuthPage';
import { AppShell } from './components/layout/AppShell';
import { OfflineBanner } from './components/layout/OfflineBanner';
import { useSyncQueue } from './hooks/useSyncQueue';

function AppWithSync() {
  const pending = useSyncQueue();
  return (
    <>
      <OfflineBanner pendingCount={pending} />
      <AppShell />
    </>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return user ? <AppWithSync /> : <AuthPage />;
}
