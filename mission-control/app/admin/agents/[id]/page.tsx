'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n';

type Agent = {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'idle' | 'inactive';
  config: Record<string, unknown>;
  currentTask: string | null;
  lastActiveAt: string | null;
  createdAt: string;
};

async function fetchAgent(id: string): Promise<Agent> {
  const res  = await fetch(`/api/admin/agents/${id}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? 'Not found');
  return json.data;
}

const STATUS_COLORS: Record<string, string> = {
  active:   'bg-emerald-500/20 text-emerald-400',
  idle:     'bg-yellow-500/20 text-yellow-400',
  inactive: 'bg-[#2A2A3A] text-[#8B8B9E]',
};

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-[#12121A] border border-[#2A2A3A] rounded-xl p-4">
      <p className="text-xs text-[#555566] mb-1">{label}</p>
      <p className="text-sm text-white font-medium break-all">{value ?? '—'}</p>
    </div>
  );
}

export default function AgentDetailPage() {
  const t      = useT();
  const params = useParams();
  const router = useRouter();
  const qc     = useQueryClient();
  const id     = params.id as string;

  const [editConfig,   setEditConfig]   = useState(false);
  const [configDraft,  setConfigDraft]  = useState('');
  const [configError,  setConfigError]  = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const { data: agent, isLoading, error } = useQuery({
    queryKey: ['admin', 'agent', id],
    queryFn:  () => fetchAgent(id),
  });

  function openEditConfig() {
    setConfigDraft(JSON.stringify(agent!.config, null, 2));
    setConfigError('');
    setEditConfig(true);
  }

  async function saveConfig() {
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(configDraft); }
    catch { setConfigError('Invalid JSON'); return; }
    setSavingConfig(true);
    const res  = await fetch(`/api/admin/agents/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ config: parsed }),
    });
    const json = await res.json();
    setSavingConfig(false);
    if (!json.ok) { setConfigError(json.error); return; }
    qc.invalidateQueries({ queryKey: ['admin', 'agent', id] });
    setEditConfig(false);
  }

  async function handleDeactivate() {
    if (!agent || !confirm(t.adminDeactivateConfirm(agent.name))) return;
    setSavingStatus(true);
    const res  = await fetch(`/api/admin/agents/${id}`, { method: 'DELETE' });
    const json = await res.json();
    setSavingStatus(false);
    if (!json.ok) {
      alert(json.code === 'LAST_ACTIVE_AGENT' ? t.adminLastActiveAgentError : json.error);
      return;
    }
    qc.invalidateQueries({ queryKey: ['admin', 'agent', id] });
    qc.invalidateQueries({ queryKey: ['admin', 'agents'] });
  }

  async function handleActivate() {
    if (!agent || !confirm(t.adminActivateConfirm(agent.name))) return;
    setSavingStatus(true);
    const res  = await fetch(`/api/admin/agents/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: 'active' }),
    });
    const json = await res.json();
    setSavingStatus(false);
    if (!json.ok) { alert(json.error); return; }
    qc.invalidateQueries({ queryKey: ['admin', 'agent', id] });
    qc.invalidateQueries({ queryKey: ['admin', 'agents'] });
  }

  if (isLoading) {
    return <div className="min-h-screen bg-[#0A0A0F] p-6 text-sm text-[#8B8B9E]">{t.loading}</div>;
  }
  if (error || !agent) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] p-6 text-sm text-red-400">
        {(error as Error)?.message ?? 'Not found'}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-sm text-[#8B8B9E] hover:text-white transition-colors"
          >
            {t.adminBack}
          </button>
          <h1 className="text-xl font-semibold text-white flex-1">{agent.name}</h1>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[agent.status]}`}>
            {agent.status === 'active'
              ? t.adminAgentStatusActive
              : agent.status === 'idle'
              ? t.adminAgentStatusIdle
              : t.adminAgentStatusInactive}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label={t.adminAgentType}        value={agent.type} />
          <Stat label={t.adminAgentStatus}      value={agent.status} />
          <Stat
            label={t.adminAgentLastActive}
            value={agent.lastActiveAt ? new Date(agent.lastActiveAt).toLocaleString() : null}
          />
          <Stat label={t.adminAgentCurrentTask} value={agent.currentTask} />
        </div>

        <div className="bg-[#12121A] border border-[#2A2A3A] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white">{t.adminAgentConfig}</p>
            {!editConfig && (
              <button
                onClick={openEditConfig}
                className="text-xs text-[#3B82F6] hover:text-[#60A5FA] transition-colors"
              >
                {t.adminEdit}
              </button>
            )}
          </div>

          {editConfig ? (
            <div className="space-y-2">
              <textarea
                value={configDraft}
                onChange={e => setConfigDraft(e.target.value)}
                rows={10}
                className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg p-3 text-sm font-mono text-white resize-y focus:outline-none focus:border-[#3B82F6]"
              />
              {configError && <p className="text-xs text-red-400">{configError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={saveConfig}
                  disabled={savingConfig}
                  className="px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-sm text-white font-medium disabled:opacity-50 transition-colors"
                >
                  {savingConfig ? t.adminSaving : t.adminSave}
                </button>
                <button
                  onClick={() => setEditConfig(false)}
                  className="px-4 py-2 rounded-lg bg-[#1A1A24] hover:bg-[#2A2A34] text-sm text-[#8B8B9E] transition-colors"
                >
                  {t.adminCancel}
                </button>
              </div>
            </div>
          ) : (
            <pre className="text-xs font-mono text-[#8B8B9E] bg-[#0A0A0F] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(agent.config, null, 2)}
            </pre>
          )}
        </div>

        <div className="flex gap-3">
          {agent.status !== 'inactive' ? (
            <button
              onClick={handleDeactivate}
              disabled={savingStatus}
              className="px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-sm text-red-400 font-medium disabled:opacity-50 transition-colors"
            >
              {savingStatus ? t.adminSaving : t.adminAgentDeactivate}
            </button>
          ) : (
            <button
              onClick={handleActivate}
              disabled={savingStatus}
              className="px-4 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-sm text-emerald-400 font-medium disabled:opacity-50 transition-colors"
            >
              {savingStatus ? t.adminSaving : t.adminAgentActivate}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
