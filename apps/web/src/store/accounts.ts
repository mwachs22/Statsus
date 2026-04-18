import { create } from 'zustand';
import type { Account } from '../lib/api';

interface AccountListState {
  accounts: Account[];
  loaded: boolean;
  setAccounts: (accounts: Account[]) => void;
  setLoaded: (loaded: boolean) => void;
}

export const useAccountListStore = create<AccountListState>((set) => ({
  accounts: [],
  loaded: false,
  setAccounts: (accounts) => set({ accounts }),
  setLoaded: (loaded) => set({ loaded }),
}));
