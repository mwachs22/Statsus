import { Mail } from 'lucide-react';
import { useMailStore } from '../store/mail';
import { useAccounts } from '../hooks/useAccounts';
import { useAccountListStore } from '../store/accounts';
import { useThreads } from '../hooks/useMessages';
import { Sidebar } from '../components/mail/Sidebar';
import { ThreadList } from '../components/mail/ThreadList';
import { ThreadView } from '../components/mail/ThreadView';
import { ComposeModal } from '../components/mail/ComposeModal';
import { AccountSetupModal } from '../components/mail/AccountSetupModal';

function EmptyThreadState({ hasAccounts }: { hasAccounts: boolean }) {
  const { openAccountSetup, openCompose } = useMailStore();
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <Mail className="w-8 h-8 text-slate-400" />
      </div>
      {hasAccounts ? (
        <>
          <p className="text-slate-600 font-medium">Select a conversation</p>
          <p className="text-sm text-slate-400 mt-1">or</p>
          <button
            onClick={openCompose}
            className="mt-3 text-sm text-blue-600 hover:underline"
          >
            Compose a new message
          </button>
        </>
      ) : (
        <>
          <p className="text-slate-600 font-medium">No mail accounts yet</p>
          <p className="text-sm text-slate-400 mt-1 mb-4">
            Connect your first email account to get started
          </p>
          <button
            onClick={openAccountSetup}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition"
          >
            Add account
          </button>
        </>
      )}
    </div>
  );
}

export function MailPage() {
  const {
    selectedAccountId,
    selectedFolder,
    selectedThreadId,
    setSelectedFolder,
    setSelectedThread,
    openCompose,
  } = useMailStore();

  // useAccounts is called here too — no-op after AppShell seeds the store
  const { loading: accountsLoading } = useAccounts();
  const { accounts } = useAccountListStore();

  const { threads, loading: threadsLoading, reload, markThreadRead } = useThreads(
    selectedAccountId,
    selectedFolder
  );

  const unreadCounts: Record<string, number> = {
    [selectedFolder]: threads.reduce((sum, t) => sum + (t.unread_count ?? 0), 0),
  };

  const handleSelectThread = (threadId: string) => {
    setSelectedThread(threadId);
    markThreadRead(threadId);
  };

  if (accountsLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar
        selectedFolder={selectedFolder}
        onSelectFolder={(f) => setSelectedFolder(f)}
        onCompose={() => openCompose()}
        unreadCounts={unreadCounts}
      />

      <ThreadList
        threads={threads}
        selectedThreadId={selectedThreadId}
        loading={threadsLoading}
        folder={selectedFolder}
        onSelectThread={handleSelectThread}
        onReload={reload}
      />

      {selectedThreadId ? (
        <ThreadView threadId={selectedThreadId} />
      ) : (
        <EmptyThreadState hasAccounts={accounts.length > 0} />
      )}

      {/* Overlays */}
      <ComposeModal accounts={accounts} />
      <AccountSetupModal />
    </div>
  );
}
