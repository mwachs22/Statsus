import { Inbox, Send, FileText, Trash2, Plus } from 'lucide-react';

type Folder = 'INBOX' | 'Sent' | 'Drafts' | 'Trash';

interface SidebarProps {
  selectedFolder: Folder;
  onSelectFolder: (folder: Folder) => void;
  onCompose: () => void;
  unreadCounts: Record<string, number>; // folder -> count
}

const FOLDERS: { key: Folder; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { key: 'INBOX', label: 'Inbox', Icon: Inbox },
  { key: 'Sent', label: 'Sent', Icon: Send },
  { key: 'Drafts', label: 'Drafts', Icon: FileText },
  { key: 'Trash', label: 'Trash', Icon: Trash2 },
];

export function Sidebar({ selectedFolder, onSelectFolder, onCompose, unreadCounts }: SidebarProps) {
  return (
    <aside className="w-52 flex-shrink-0 bg-slate-900 flex flex-col h-full">
      <div className="flex-1 flex flex-col overflow-y-auto py-3">
        {/* Compose */}
        <div className="px-3 mb-4">
          <button
            onClick={onCompose}
            className="w-full flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg px-3 py-2.5 transition"
          >
            <Plus className="w-4 h-4" />
            Compose
          </button>
        </div>

        {/* Folders */}
        <nav className="px-2">
          {FOLDERS.map(({ key, label, Icon }) => {
            const isActive = selectedFolder === key;
            const count = unreadCounts[key] ?? 0;
            return (
              <button
                key={key}
                onClick={() => onSelectFolder(key)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition mb-0.5 ${
                  isActive
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">{label}</span>
                {count > 0 && (
                  <span className="text-xs bg-blue-600 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

      </div>
    </aside>
  );
}
