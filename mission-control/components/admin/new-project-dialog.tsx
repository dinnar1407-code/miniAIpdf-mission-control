'use client';

import { useState, useEffect } from 'react';
import { useT } from '@/lib/i18n';

type Unit = 'usd' | 'count' | 'percent';
type Cadence = 'daily' | 'weekly' | 'monthly' | 'quarterly';

interface Props {
  onSuccess: (project: unknown) => void;
  onClose: () => void;
}

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function NewProjectDialog({ onSuccess, onClose }: Props) {
  const t = useT();

  const [name,        setName]        = useState('');
  const [slug,        setSlug]        = useState('');
  const [slugManual,  setSlugManual]  = useState(false);
  const [description, setDescription] = useState('');

  // single required initial goal
  const [kpi,      setKpi]      = useState('');
  const [unit,     setUnit]     = useState<Unit>('usd');
  const [baseline, setBaseline] = useState('');
  const [target,   setTarget]   = useState('');
  const [deadline, setDeadline] = useState('');
  const [cadence,  setCadence]  = useState<Cadence>('monthly');

  const [creating, setCreating] = useState(false);
  const [error,    setError]    = useState('');

  // auto-derive slug from name unless user has manually edited it
  useEffect(() => {
    if (!slugManual) setSlug(toSlug(name));
  }, [name, slugManual]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      const res = await fetch('/api/admin/projects', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name,
          slug,
          description: description || null,
          goals: [{
            kpi,
            unit,
            baseline: parseFloat(baseline),
            target:   parseFloat(target),
            deadline: new Date(deadline).toISOString(),
            cadence,
          }],
        }),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error ?? 'Error'); setCreating(false); return; }
      onSuccess(json.data);
    } catch {
      setError('Network error');
      setCreating(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg text-sm text-white placeholder-[#555566] focus:outline-none focus:border-[#3B82F6]';
  const labelCls = 'text-xs text-[#8B8B9E]';

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full md:max-w-lg h-full md:h-auto md:max-h-[90vh] bg-[#12121A] md:border md:border-[#2A2A3A] md:rounded-xl shadow-2xl flex flex-col">

        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A3A] shrink-0">
          <h2 className="text-sm font-semibold text-white">{t.adminNewProjectTitle}</h2>
          <button onClick={onClose} className="text-[#8B8B9E] hover:text-white transition-colors text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="space-y-3">
            <div className="space-y-1">
              <label className={labelCls}>{t.adminProjectName}</label>
              <input value={name} onChange={e => setName(e.target.value)} required
                className={inputCls} placeholder="My Project" />
            </div>

            <div className="space-y-1">
              <label className={labelCls}>{t.adminProjectSlug}</label>
              <input value={slug}
                onChange={e => { setSlug(e.target.value); setSlugManual(true); }}
                required pattern="[a-z0-9-]+"
                className={`${inputCls} font-mono`}
                placeholder="my-project" />
              <p className="text-[10px] text-[#555566]">{t.adminProjectSlugHint}</p>
            </div>

            <div className="space-y-1">
              <label className={labelCls}>{t.adminProjectDescription}</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                className={`${inputCls} resize-none`} />
            </div>
          </div>

          {/* Initial goal — required by the API */}
          <div className="border border-[#2A2A3A] rounded-lg p-4 space-y-3">
            <p className="text-xs font-medium text-[#8B8B9E] uppercase tracking-wider">{t.adminGoals}</p>

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

            <div className="space-y-1">
              <label className={labelCls}>{t.adminGoalDeadline}</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                required className={inputCls} />
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pb-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-[#2A2A3A] text-sm text-[#8B8B9E] hover:text-white hover:border-[#3B3B4A] transition-colors">
              {t.cancel}
            </button>
            <button type="submit" disabled={creating}
              className="flex-1 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 text-sm text-white font-medium transition-colors">
              {creating ? t.adminCreating : t.adminCreate}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
