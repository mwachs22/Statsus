import { useState, useRef } from 'react';
import { X, Check, Trash2, Flag, Plus, ExternalLink } from 'lucide-react';
import { useTodos } from '../../hooks/useTodos';
import { useMailStore } from '../../store/mail';
import { useNavigationStore } from '../../store/navigation';
import type { Todo } from '../../lib/api';

interface TodoOverlayProps {
  onClose: () => void;
}

const PRIORITY_LABEL: Record<Todo['priority'], string> = {
  high:   'High',
  normal: 'Normal',
  low:    'Low',
};

const PRIORITY_COLOR: Record<Todo['priority'], string> = {
  high:   'text-red-500',
  normal: 'text-slate-400',
  low:    'text-slate-300',
};

function TodoItem({
  todo,
  onToggle,
  onRemove,
  onNavigate,
}: {
  todo: Todo;
  onToggle: () => void;
  onRemove: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className={`flex items-start gap-2 py-2 px-3 rounded-lg group hover:bg-slate-50 transition ${todo.completed ? 'opacity-50' : ''}`}>
      <button
        onClick={onToggle}
        className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded border transition
          ${todo.completed ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 hover:border-blue-400'}`}
      >
        {todo.completed && <Check className="w-3 h-3" />}
      </button>

      <div className="flex-1 min-w-0">
        <span className={`text-sm ${todo.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
          {todo.text}
        </span>
        {todo.due_date && (
          <span className="block text-xs text-slate-400 mt-0.5">
            Due {new Date(todo.due_date).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
        <Flag className={`w-3.5 h-3.5 ${PRIORITY_COLOR[todo.priority]}`} title={PRIORITY_LABEL[todo.priority]} />
        {todo.linked_message_id && onNavigate && (
          <button onClick={onNavigate} className="text-slate-400 hover:text-blue-500 transition" title="Go to message">
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={onRemove} className="text-slate-400 hover:text-red-500 transition">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function TodoOverlay({ onClose }: TodoOverlayProps) {
  const { todos, loading, addTodo, toggleTodo, removeTodo } = useTodos();
  const { setSelectedThread } = useMailStore();
  const { setSection } = useNavigationStore();

  const [newText, setNewText]     = useState('');
  const [priority, setPriority]   = useState<Todo['priority']>('normal');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = async () => {
    const text = newText.trim();
    if (!text) return;
    await addTodo(text, priority);
    setNewText('');
    inputRef.current?.focus();
  };

  const active    = todos.filter((t) => !t.completed);
  const completed = todos.filter((t) => t.completed);

  const navigateToMessage = (messageId: string) => {
    setSelectedThread(messageId);
    setSection('mail');
    onClose();
  };

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800">Todos</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick-add */}
      <div className="px-3 py-2 border-b border-slate-100 space-y-1.5">
        <div className="flex gap-1.5">
          <input
            ref={inputRef}
            autoFocus
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="Add a todo…"
            className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAdd}
            disabled={!newText.trim()}
            className="p-1.5 bg-blue-600 disabled:opacity-40 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-1 text-xs">
          {(['high', 'normal', 'low'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={`px-2 py-0.5 rounded-md border transition capitalize
                ${priority === p ? 'border-blue-500 text-blue-600 bg-blue-50' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Todo list */}
      <div className="flex-1 overflow-y-auto py-2">
        {loading && (
          <p className="text-xs text-slate-400 text-center py-4">Loading…</p>
        )}

        {!loading && active.length === 0 && completed.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-8">No todos yet</p>
        )}

        {active.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onToggle={() => toggleTodo(todo.id)}
            onRemove={() => removeTodo(todo.id)}
            onNavigate={todo.linked_message_id ? () => navigateToMessage(todo.linked_message_id!) : undefined}
          />
        ))}

        {completed.length > 0 && (
          <>
            <p className="text-xs text-slate-400 px-3 pt-3 pb-1 font-medium">Completed</p>
            {completed.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onToggle={() => toggleTodo(todo.id)}
                onRemove={() => removeTodo(todo.id)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
