import { WifiOff, RefreshCw } from 'lucide-react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

interface OfflineBannerProps {
  pendingCount: number;
}

export function OfflineBanner({ pendingCount }: OfflineBannerProps) {
  const online = useNetworkStatus();

  if (online && pendingCount === 0) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 py-2 text-xs font-medium transition-all
        ${online ? 'bg-blue-600 text-white' : 'bg-amber-500 text-white'}`}
    >
      {online ? (
        <>
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Syncing {pendingCount} pending change{pendingCount !== 1 ? 's' : ''}…
        </>
      ) : (
        <>
          <WifiOff className="w-3.5 h-3.5" />
          You&rsquo;re offline — changes will sync when reconnected
          {pendingCount > 0 && <span className="opacity-75">({pendingCount} pending)</span>}
        </>
      )}
    </div>
  );
}
