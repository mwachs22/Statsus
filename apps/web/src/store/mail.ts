import { create } from 'zustand';

type Folder = 'INBOX' | 'Sent' | 'Drafts' | 'Trash';

interface MailState {
  selectedAccountId: string | null;
  selectedFolder: Folder;
  selectedThreadId: string | null;
  composeOpen: boolean;
  composeReplyTo: { threadId: string; inReplyTo?: string; to?: string; subject?: string } | null;
  accountSetupOpen: boolean;

  setSelectedAccount: (id: string | null) => void;
  setSelectedFolder: (folder: Folder) => void;
  setSelectedThread: (threadId: string | null) => void;
  openCompose: (replyTo?: MailState['composeReplyTo']) => void;
  closeCompose: () => void;
  openAccountSetup: () => void;
  closeAccountSetup: () => void;
}

export const useMailStore = create<MailState>((set) => ({
  selectedAccountId: null,
  selectedFolder: 'INBOX',
  selectedThreadId: null,
  composeOpen: false,
  composeReplyTo: null,
  accountSetupOpen: false,

  setSelectedAccount: (id) => set({ selectedAccountId: id, selectedThreadId: null }),
  setSelectedFolder: (folder) => set({ selectedFolder: folder, selectedThreadId: null }),
  setSelectedThread: (threadId) => set({ selectedThreadId: threadId }),
  openCompose: (replyTo = null) => set({ composeOpen: true, composeReplyTo: replyTo }),
  closeCompose: () => set({ composeOpen: false, composeReplyTo: null }),
  openAccountSetup: () => set({ accountSetupOpen: true }),
  closeAccountSetup: () => set({ accountSetupOpen: false }),
}));
