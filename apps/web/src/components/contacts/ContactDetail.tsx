import type { Contact } from '../../lib/api';

interface ContactDetailProps {
  contact: Contact;
  onDelete: (id: string) => void;
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

function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

interface FieldRowProps {
  label: string;
  value: string;
  href?: string;
}

function FieldRow({ label, value, href }: FieldRowProps) {
  return (
    <div className="py-3 border-b border-slate-100 last:border-b-0">
      <div className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">{label}</div>
      {href ? (
        <a href={href} className="text-sm text-blue-600 hover:underline break-all">{value}</a>
      ) : (
        <div className="text-sm text-slate-800 break-all">{value}</div>
      )}
    </div>
  );
}

export function ContactDetail({ contact, onDelete }: ContactDetailProps) {
  const handleDelete = async () => {
    if (!confirm(`Delete ${contact.full_name ?? 'this contact'}?`)) return;
    onDelete(contact.id);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Avatar + name header */}
      <div className="flex flex-col items-center py-8 px-6 border-b border-slate-200 bg-white">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-3 ${avatarColor(contact.id)}`}>
          {initials(contact.full_name)}
        </div>
        <h2 className="text-xl font-semibold text-slate-900 text-center">
          {contact.full_name ?? '(No name)'}
        </h2>
        {contact.title && (
          <p className="text-sm text-slate-500 mt-0.5">{contact.title}</p>
        )}
        {contact.organization && (
          <p className="text-sm text-slate-500">{contact.organization}</p>
        )}
      </div>

      {/* Fields */}
      <div className="px-6 py-2 flex-1">
        {contact.emails?.map((email, i) => (
          <FieldRow
            key={i}
            label={`Email${email.type ? ` · ${email.type}` : ''}`}
            value={email.value}
            href={`mailto:${email.value}`}
          />
        ))}
        {contact.phones?.map((phone, i) => (
          <FieldRow
            key={i}
            label={`Phone${phone.type ? ` · ${phone.type}` : ''}`}
            value={phone.value}
            href={`tel:${phone.value}`}
          />
        ))}
        {contact.notes && (
          <FieldRow label="Note" value={contact.notes} />
        )}
        {contact.uid && !contact.uid.startsWith('statsus-') && (
          <p className="text-xs text-slate-400 mt-4">Synced from CardDAV</p>
        )}
      </div>

      {/* Delete */}
      {contact.uid?.startsWith('statsus-') && (
        <div className="px-6 py-4 border-t border-slate-100">
          <button
            onClick={handleDelete}
            className="text-sm text-red-500 hover:text-red-700 transition"
          >
            Delete contact
          </button>
        </div>
      )}
    </div>
  );
}
