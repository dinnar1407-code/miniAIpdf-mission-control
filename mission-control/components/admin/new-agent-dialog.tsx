'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n';

type Props = {
  onSuccess: () => void;
  onClose: () => void;
};

const AGENT_TYPES = ['planner', 'executor', 'reviewer', 'analyst', 'writer', 'custom'];

export default function NewAgentDialog({ onSuccess, onClose }: Props) {
  const t = useT();

  const [name,        setName]        = useState('');
  const [type,        setType]        = useState('executor');
  const [status,      setStatus]      = useState<'active' | 'idle' | 'inactive'>('active');
  const [configText,  setConfigText]  = useState('{}');
  const [currentTask, setCurrentTask] = useState('');
  const [error,       setError]       = useState('');
  const [saving,      setSaving]      = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    let config: Record<string, unknown>;
    try { config = JSON.parse(configText || '{}'); }
    catch { setError('Config must be valid JSON'); return; }

    setSaving(true);
    const res  = await fetch('/api/admin/agents', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        name:        name.trim(),
        type,
        status,
        config,
        currentTask: currentTask.trim() || null,
      }),
    });
    const json = await res.json();
    setSaving(false);

    if (!json.ok) { setError(json.error ?? 'Failed to create agent'); return; }
    onSuccess();
  }

  const inputCls = 'w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg px-3 py-2 text-sm text-white placeholder-[#555566] focus:outline-none focus:border-[#3B82F6]';
  const labelCls = 'block text-xs text-[#8B8B9E] mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full md:max-w-lg bg-[#12121A] border border-[#2A2A3A] rounded-t-2xl md:rounded-2xl p-6 space-y-5 h-full md:h-auto overflow-y-auto">

        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">{t.adminNewAgentTitle}</h2>
          <button onClick={onClose} className="text-[#8B8B9E] hover:text-white transition-colors text-lg leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className={labelCls}>{t.adminAgentName} *</label>
            <input
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Playfish"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t.adminAgentType} *</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className={inputCls}
              >
                {AGENT_TYPES.map(agentType => (
                  <option key={agentType} value={agentType}>{agentType}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t.adminAgentStatus}</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as typeof status)}
                className={inputCls}
              >
                <option value="active">{t.adminAgentStatusActive}</option>
                <option value="idle">{t.adminAgentStatusIdle}</option>
                <option value="inactive">{t.adminAgentStatusInactive}</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>{t.adminAgentCurrentTask}</label>
            <input
              value={currentTask}
              onChange={e => setCurrentTask(e.target.value)}
              placeholder="—"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>{t.adminAgentConfig}</label>
            <textarea
              value={configText}
              onChange={e => setConfigText(e.target.value)}
              rows={4}
              placeholder="{}"
              className={`${inputCls} font-mono resize-y`}
            />
            <p className="text-xs text-[#555566] mt-1">{t.adminAgentConfigHint}</p>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-sm text-white font-medium disabled:opacity-50 transition-colors"
            >
              {saving ? t.adminCreating : t.adminCreate}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-lg bg-[#1A1A24] hover:bg-[#2A2A34] text-sm text-[#8B8B9E] transition-colors"
            >
              {t.adminCancel}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
