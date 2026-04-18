import { useState } from 'react';
import { useFilters } from '../hooks/useFilters';
import { FilterEditor } from '../components/filters/FilterEditor';
import type { Filter } from '../lib/api';

const ACTION_SUMMARY: Record<string, string> = {
  mark_read: 'Mark as read',
  label: 'Apply label',
  archive: 'Archive',
  delete: 'Move to trash',
  forward: 'Forward',
  stop_processing: 'Stop processing',
};

function ruleCount(f: Filter): string {
  const n = f.conditions.rules.length;
  return `${n} condition${n !== 1 ? 's' : ''}`;
}

function actionSummary(f: Filter): string {
  return f.actions
    .map((a) => {
      const label = ACTION_SUMMARY[a.type] ?? a.type;
      return 'value' in a ? `${label}: ${(a as { value: string }).value}` : label;
    })
    .join(', ');
}

export function FiltersPage() {
  const { filters, loading, createFilter, updateFilter, toggleFilter, removeFilter } = useFilters();
  const [editing, setEditing] = useState<Filter | null | 'new'>(null);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Filters</h1>
          <p className="text-xs text-slate-500 mt-0.5">Rules applied automatically to incoming mail</p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          + New filter
        </button>
      </div>

      {/* Filter list */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">Loading…</div>
        )}

        {!loading && filters.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <span className="text-4xl">⚙️</span>
            <p className="text-sm">No filters yet</p>
            <button
              onClick={() => setEditing('new')}
              className="text-sm text-blue-600 hover:underline"
            >
              Create your first filter
            </button>
          </div>
        )}

        {filters.map((filter) => (
          <div
            key={filter.id}
            className={`flex items-center gap-4 px-6 py-4 border-b border-slate-100 hover:bg-slate-50 transition
              ${!filter.enabled ? 'opacity-50' : ''}`}
          >
            {/* Enable toggle */}
            <button
              onClick={() => toggleFilter(filter.id)}
              className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative ${filter.enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
              title={filter.enabled ? 'Disable' : 'Enable'}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${filter.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-800">{filter.name}</span>
                <span className="text-xs text-slate-400">{ruleCount(filter)} · {filter.conditions.logic}</span>
                {filter.match_count > 0 && (
                  <span className="text-xs text-slate-400">{filter.match_count} match{filter.match_count !== 1 ? 'es' : ''}</span>
                )}
              </div>
              <div className="text-xs text-slate-500 truncate mt-0.5">{actionSummary(filter)}</div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setEditing(filter)}
                className="text-xs text-slate-500 hover:text-blue-600 transition px-2 py-1 rounded hover:bg-blue-50"
              >
                Edit
              </button>
              <button
                onClick={() => { if (confirm(`Delete "${filter.name}"?`)) removeFilter(filter.id); }}
                className="text-xs text-slate-500 hover:text-red-600 transition px-2 py-1 rounded hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Editor modal */}
      {editing === 'new' && (
        <FilterEditor
          onSave={createFilter}
          onClose={() => setEditing(null)}
        />
      )}
      {editing && editing !== 'new' && (
        <FilterEditor
          initial={editing}
          onSave={(data) => updateFilter(editing.id, data)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
