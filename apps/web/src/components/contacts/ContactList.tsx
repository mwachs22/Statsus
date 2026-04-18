import type { Contact } from '../../lib/api';

interface ContactListProps {
  contacts: Contact[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (contact: Contact) => void;
}

function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function avatarColor(id: string): string {
  const COLORS = [
    'bg-blue-500', 'bg-purple-500', 'bg-green-500',
    'bg-orange-500', 'bg-pink-500', 'bg-teal-500', 'bg-indigo-500',
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function ContactList({ contacts, loading, selectedId, onSelect }: ContactListProps) {
  if (loading && contacts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
        Loading contacts…
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400 px-4 text-center">
        <span className="text-3xl">👤</span>
        <p className="text-sm">No contacts found</p>
      </div>
    );
  }

  // Group alphabetically
  const groups = new Map<string, Contact[]>();
  for (const contact of contacts) {
    const letter = (contact.full_name?.[0] ?? '#').toUpperCase();
    const key = /[A-Z]/.test(letter) ? letter : '#';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(contact);
  }
  const sortedKeys = [...groups.keys()].sort((a, b) => {
    if (a === '#') return 1;
    if (b === '#') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="flex-1 overflow-y-auto">
      {sortedKeys.map((letter) => (
        <div key={letter}>
          <div className="px-4 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-100 sticky top-0">
            {letter}
          </div>
          {groups.get(letter)!.map((contact) => {
            const isSelected = contact.id === selectedId;
            return (
              <button
                key={contact.id}
                onClick={() => onSelect(contact)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition border-b border-slate-50
                  ${isSelected ? 'bg-blue-50 hover:bg-blue-50' : ''}`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 ${avatarColor(contact.id)}`}>
                  {initials(contact.full_name)}
                </div>
                <div className="min-w-0">
                  <div className={`text-sm font-medium truncate ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
                    {contact.full_name ?? '(No name)'}
                  </div>
                  {contact.organization && (
                    <div className="text-xs text-slate-500 truncate">{contact.organization}</div>
                  )}
                  {!contact.organization && contact.emails?.[0] && (
                    <div className="text-xs text-slate-500 truncate">{contact.emails[0].value}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
