import { useState } from 'react';
import { useContacts } from '../hooks/useContacts';
import { ContactList } from '../components/contacts/ContactList';
import { ContactDetail } from '../components/contacts/ContactDetail';
import type { Contact } from '../lib/api';

interface ContactsPageProps {
  accountId: string | null;
}

export function ContactsPage({ accountId }: ContactsPageProps) {
  const [search, setSearch]           = useState('');
  const [selected, setSelected]       = useState<Contact | null>(null);
  const { contacts, loading, removeContact } = useContacts(accountId, search);

  const handleDelete = async (id: string) => {
    await removeContact(id);
    setSelected(null);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className="w-72 flex-shrink-0 border-r border-slate-200 flex flex-col bg-white">
        {/* Search */}
        <div className="px-3 py-3 border-b border-slate-200">
          <input
            type="text"
            placeholder="Search contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-sm bg-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400"
          />
        </div>

        <ContactList
          contacts={contacts}
          loading={loading}
          selectedId={selected?.id ?? null}
          onSelect={setSelected}
        />
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-hidden bg-white">
        {selected ? (
          <ContactDetail
            contact={selected}
            onDelete={handleDelete}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
            <span className="text-4xl">👤</span>
            <p className="text-sm">Select a contact</p>
          </div>
        )}
      </div>
    </div>
  );
}
