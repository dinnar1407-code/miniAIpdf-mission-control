'use client';

import { useState, useEffect } from 'react';
import { useT } from '@/lib/i18n';

type Unit = 'usd' | 'count' | 'percent';
type Cadence = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export type GoalShape = {
  id: string;
  kpi: string;
  unit: Unit;
  baseline: number;
  target: number;
  current: number | null;
  deadline: string;
  cadence: Cadence;
};

interface Props {
  projectSlug: string;
  goal?: GoalShape;           // undefined → create mode
  onSuccess: (goal: GoalShape) => void;
  onClose: () => void;
}

export default function GoalFormDialog({ projectSlug, goal, onSuccess, onClose }: Props) {
  const t = useT();
  const isEdit = !!goal;

  const [kpi,      setKpi]      = useState(goal?.kpi ?? '');
  const [unit,     setUnit]     = useState<Unit>(goal?.unit ?? 'usd');
  const [baseline, setBaseline] = useState(goal?.baseline?.toString() ?? '');
  const [target,   setTarget]   = useState(goal?.target?.toString() ?? '');
  const [deadline, setDeadline] = useState(
    goal?.deadline ? goal.deadline.slice(0, 10) : ''
  );
  const [cadence,  setCadence]  = useState<Cadence>(goal?.cadence ?? 'monthly');
  const [current,  setCurrent]  = useState(goal?.current?.toString() ?? '');

  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [showWarning, setShowWarning] = useState(false);

  // detect baseline/target changes that need a confirmation step
  const baselineChanged = isEdit && baseline !== '' && parseFloat(baseline) !== goal!.baseline;
  const targetChanged   = isEdit && target   !== '' && parseFloat(target)   !== goal!.target;
  const needsConfirm    = (baselineChanged || targetChanged) && !showWarning;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // first submission when baseline/target changed → show warning, require re-submit
    if (needsConfirm) { setShowWarning(true); return; }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        kpi,
        unit,
        baseline: parseFloat(baseline),
        target:   parseFloat(target),
        deadline: new Date(deadline).toISOString(),
        cadence,
      };
      if (current !== '') body.current = parseFloat(current);

      const url    = isEdit ? `/api/admin/goals/${goal!.id}` : `/api/admin/projects/${projectSlug}/goals`;
      const method = isEdit ? 'PATCH' : 'POST';

      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!json.ok) { setError(json.error ?? 'Error'); setSaving(false); return; }
      onSuccess(json.data);
    } catch {
      setError('Network error');
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg text-sm text-white placeholder-[#555566] focus:outline-none focus:border-[#3B82F6]';
  const labelCls = 'text-xs text-[#8B8B9E]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-[#12121A] border border-[#2A2A3A] rounded-xl shadow-2xl">

        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A3A]">
          <h2 className="text-sm font-semibold text-white">
            {isEdit ? t.adminEditGoal : t.adminAddGoal}
          </h2>
          <button onClick={onClose} className="text-[#8B8B9E] hover:text-white transition-colors text-xl leading-none">×</button>
        </div>

        {showWarning && (
          <div className="mx-5 mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-400">
            {t.adminGoalWarning}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1">
            <label className={labelCls}>{t.adminGoalKpi}</label>
            <input value={kpi} onChange={e => setKpi(e.target.value)} required
              className={inputCls} placeholder="Monthly Recurring Revenue" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelCls}>{t.adminGoalUnit}</label>
              <select value={unit} onChange={e => setUnit(e.target.value as Unit)} className={inputCls}>
                <option value="usd">{t.adminUnitUsd}</option>
                <option value="count">{t.adminUnitCount}</option>
                <option value="percent">{t.adminUnitPercent}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelCls}>{t.adminGoalCadence}</label>
              <select value={cadence} onChange={e => setCadence(e.target.value as Cadence)} className={inputCls}>
                <option value="daily">{t.adminCadenceDaily}</option>
                <option value="weekly">{t.adminCadenceWeekly}</option>
                <option value="monthly">{t.adminCadenceMonthly}</option>
                <option value="quarterly">{t.adminCadenceQuarterly}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelCls}>{t.adminGoalBaseline}</label>
              <input type="number" value={baseline} onChange={e => setBaseline(e.target.value)}
                required step="any" min="0" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>{t.adminGoalTarget}</label>
              <input type="number" value={target} onChange={e => setTarget(e.target.value)}
                required step="any" min="0" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelCls}>{t.adminGoalDeadline}</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                required className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>{t.adminGoalCurrent}</label>
              <input type="number" value={current} onChange={e => setCurrent(e.target.value)}
                step="any" min="0" className={inputCls} />
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-[#2A2A3A] text-sm text-[#8B8B9E] hover:text-white hover:border-[#3B3B4A] transition-colors">
              {t.cancel}
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 text-sm text-white font-medium transition-colors">
              {saving ? t.adminSaving : showWarning ? t.adminGoalConfirm : t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
