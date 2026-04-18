import { useState } from 'react';
import type { Filter, FilterRule, FilterConditionGroup, FilterAction } from '../../lib/api';

interface FilterEditorProps {
  initial?: Filter;
  onSave: (data: Omit<Filter, 'id' | 'match_count'>) => Promise<void>;
  onClose: () => void;
}

const FIELD_LABELS: Record<FilterRule['field'], string> = {
  from: 'From', to: 'To', subject: 'Subject', body: 'Body',
};
const OP_LABELS: Record<FilterRule['op'], string> = {
  contains: 'contains', not_contains: 'does not contain',
  equals: 'equals', regex: 'matches regex', is_empty: 'is empty',
};

const ACTION_LABELS: Record<FilterAction['type'], string> = {
  mark_read: 'Mark as read',
  label: 'Apply label',
  archive: 'Archive',
  delete: 'Move to trash',
  forward: 'Forward to',
  stop_processing: 'Stop processing filters',
};

function newRule(): FilterRule {
  return { field: 'from', op: 'contains', value: '' };
}

function RuleRow({
  rule, onChange, onRemove,
}: {
  rule: FilterRule;
  onChange: (r: FilterRule) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={rule.field}
        onChange={(e) => onChange({ ...rule, field: e.target.value as FilterRule['field'] })}
        className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500"
      >
        {(Object.keys(FIELD_LABELS) as FilterRule['field'][]).map((f) => (
          <option key={f} value={f}>{FIELD_LABELS[f]}</option>
        ))}
      </select>

      <select
        value={rule.op}
        onChange={(e) => onChange({ ...rule, op: e.target.value as FilterRule['op'] })}
        className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500"
      >
        {(Object.keys(OP_LABELS) as FilterRule['op'][]).map((op) => (
          <option key={op} value={op}>{OP_LABELS[op]}</option>
        ))}
      </select>

      {rule.op !== 'is_empty' && (
        <input
          type="text"
          value={rule.value}
          onChange={(e) => onChange({ ...rule, value: e.target.value })}
          placeholder="value"
          className="flex-1 min-w-[140px] text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500"
        />
      )}

      <button onClick={onRemove} className="text-slate-400 hover:text-red-500 transition text-lg leading-none px-1">×</button>
    </div>
  );
}

function ActionRow({
  action, onChange, onRemove,
}: {
  action: FilterAction;
  onChange: (a: FilterAction) => void;
  onRemove: () => void;
}) {
  const actionTypes = Object.keys(ACTION_LABELS) as FilterAction['type'][];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={action.type}
        onChange={(e) => {
          const type = e.target.value as FilterAction['type'];
          onChange(type === 'label' || type === 'forward'
            ? { type, value: '' } as FilterAction
            : { type } as FilterAction
          );
        }}
        className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500"
      >
        {actionTypes.map((t) => (
          <option key={t} value={t}>{ACTION_LABELS[t]}</option>
        ))}
      </select>

      {(action.type === 'label' || action.type === 'forward') && (
        <input
          type="text"
          value={action.value}
          onChange={(e) => onChange({ ...action, value: e.target.value } as FilterAction)}
          placeholder={action.type === 'label' ? 'label name' : 'email@example.com'}
          className="flex-1 min-w-[140px] text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500"
        />
      )}

      <button onClick={onRemove} className="text-slate-400 hover:text-red-500 transition text-lg leading-none px-1">×</button>
    </div>
  );
}

export function FilterEditor({ initial, onSave, onClose }: FilterEditorProps) {
  const [name, setName]     = useState(initial?.name ?? '');
  const [logic, setLogic]   = useState<'AND' | 'OR'>(initial?.conditions.logic ?? 'AND');
  const [rules, setRules]   = useState<FilterRule[]>(
    (initial?.conditions.rules ?? [newRule()]) as FilterRule[]
  );
  const [actions, setActions] = useState<FilterAction[]>(
    initial?.actions ?? [{ type: 'mark_read' }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const updateRule = (i: number, rule: FilterRule) =>
    setRules((prev) => prev.map((r, idx) => (idx === i ? rule : r)));
  const removeRule = (i: number) =>
    setRules((prev) => prev.filter((_, idx) => idx !== i));

  const updateAction = (i: number, action: FilterAction) =>
    setActions((prev) => prev.map((a, idx) => (idx === i ? action : a)));
  const removeAction = (i: number) =>
    setActions((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!name.trim()) { setError('Filter name is required'); return; }
    if (rules.length === 0) { setError('Add at least one condition'); return; }
    if (actions.length === 0) { setError('Add at least one action'); return; }

    setSaving(true);
    setError('');
    try {
      const conditions: FilterConditionGroup = { logic, rules };
      await onSave({
        name: name.trim(),
        conditions,
        actions,
        enabled: initial?.enabled ?? true,
        run_order: initial?.run_order ?? 0,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">{initial ? 'Edit filter' : 'New filter'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Name */}
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">Filter name</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Newsletter archiver"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Conditions</label>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-500">Match</span>
                {(['AND', 'OR'] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLogic(l)}
                    className={`px-2 py-0.5 rounded transition ${logic === l ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {l}
                  </button>
                ))}
                <span className="text-slate-500">rules</span>
              </div>
            </div>
            <div className="space-y-2">
              {rules.map((rule, i) => (
                <RuleRow key={i} rule={rule} onChange={(r) => updateRule(i, r)} onRemove={() => removeRule(i)} />
              ))}
            </div>
            <button
              onClick={() => setRules((prev) => [...prev, newRule()])}
              className="mt-2 text-xs text-blue-600 hover:text-blue-700 transition"
            >
              + Add condition
            </button>
          </div>

          {/* Actions */}
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-2">Actions</label>
            <div className="space-y-2">
              {actions.map((action, i) => (
                <ActionRow key={i} action={action} onChange={(a) => updateAction(i, a)} onRemove={() => removeAction(i)} />
              ))}
            </div>
            <button
              onClick={() => setActions((prev) => [...prev, { type: 'mark_read' }])}
              className="mt-2 text-xs text-blue-600 hover:text-blue-700 transition"
            >
              + Add action
            </button>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save filter'}
          </button>
        </div>
      </div>
    </div>
  );
}
