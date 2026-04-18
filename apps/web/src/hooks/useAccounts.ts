import { useEffect, useCallback } from 'react';
import { api, type Account } from '../lib/api';
import { useMailStore } from '../store/mail';
import { useAccountListStore } from '../store/accounts';

export function useAccounts() {
  const { selectedAccountId, setSelectedAccount } = useMailStore();
  const { accounts, loaded, setAccounts, setLoaded } = useAccountListStore();

  const load = useCallback(async () => {
    try {
      const { accounts: fetched } = await api.accounts.list();
      setAccounts(fetched);
      setLoaded(true);
      // Auto-select default account if nothing is selected
      if (!selectedAccountId && fetched.length > 0) {
        const def = fetched.find((a) => a.is_default) ?? fetched[0];
        setSelectedAccount(def.id);
      }
    } catch (err) {
      console.error('Accounts fetch failed:', err);
    }
  }, [selectedAccountId, setSelectedAccount, setAccounts, setLoaded]);

  // Only load once; consumers that need fresh data call reload() explicitly
  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  const addAccount = async (data: Parameters<typeof api.accounts.add>[0]) => {
    const { account } = await api.accounts.add(data);
    const updated = [...accounts, account];
    setAccounts(updated);
    if (!selectedAccountId) setSelectedAccount(account.id);
    // Refresh JWT so the new account enters the scope
    api.auth.refresh().catch(console.error);
    return account;
  };

  const removeAccount = async (id: string) => {
    await api.accounts.remove(id);
    const updated = accounts.filter((a) => a.id !== id);
    setAccounts(updated);
    if (selectedAccountId === id) {
      setSelectedAccount(updated[0]?.id ?? null);
    }
    // Refresh JWT to remove the account from scope
    api.auth.refresh().catch(console.error);
  };

  return {
    accounts,
    loading: !loaded,
    addAccount,
    removeAccount,
    reload: load,
  };
}
