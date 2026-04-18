import { useState, useEffect, useCallback } from 'react';
import { api, type Contact } from '../lib/api';

export function useContacts(accountId: string | null, search = '') {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { contacts } = await api.contacts.list({
        account_id: accountId ?? undefined,
        search: search || undefined,
      });
      setContacts(contacts);
    } catch (err) {
      console.error('Contacts fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [accountId, search]);

  useEffect(() => { load(); }, [load]);

  const addContact = async (data: Parameters<typeof api.contacts.create>[0]) => {
    const { contact } = await api.contacts.create(data);
    setContacts((prev) => [...prev, contact].sort((a, b) =>
      (a.full_name ?? '').localeCompare(b.full_name ?? '')
    ));
    return contact;
  };

  const removeContact = async (id: string) => {
    await api.contacts.remove(id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  return { contacts, loading, reload: load, addContact, removeContact };
}
