'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useT } from '@/lib/i18n';
import NewAgentDialog from '@/components/admin/new-agent-dialog';

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

async function fetchAgents(): Promise<Agent[]> {
  const res  = await fetch('/api/admin/agents');
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? 'Failed to load agents');
  return json.data;
}

const STATUS_COLORS: Record<string, string> = {
  active:   'bg-emerald-500/20 text-emerald-400',
  idle:     'bg-yellow-500/20 text-yellow-400',
  inactive: 'bg-[#2A2A3A] text-[#8B8B9E]',
};

export default function AdminAgentsPage() {
  const t   = useT();
  const qc  = useQueryClient();
  const [tab,     setTab]     = useState<'all' | 'active' | 'idle' | 'inactive'>('all');
  const [showNew, setShowNew] = useState(false);

  const { data: agents = [], isLoading, error } = useQuery({
    queryKey: ['admin', 'agents'],
    queryFn:  fetchAgents,
  });

  const filtered = tab === 'all' ? agents : agents.filter(a => a.status === tab);

  async function handleDeactivate(a: Agent) {
    if (!confirm(t.adminDeactivateConfirm(a.name))) return;
    const res  = await fetch(`/api/admin/agents/${a.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.ok) {
      alert(json.code === 'LAST_ACTIVE_AGENT' ? t.adminLastActiveAgentError : json.error);
      return;
    }
    qc.invalidateQueries({ queryKey: ['admin', 'agents'] });
  }

  async function handleActivate(a: Agent) {
    if (!confirm(t.adminActivateConfirm(a.name))) return;
    const res  = await fetch(`/api/admin/agents/${a.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: 'active' }),
    });
    const json = await res.json();
    if (!json.ok) { alert(json.error); return; }
    qc.invalidateQueries({ queryKey: ['admin', 'agents'] });
  }

  const tabs = [
    { key: 'all'      as const, label: t.adminAgentsAll      },
    { key: 'active'   as const, label: t.adminAgentsActive   },
    { key: 'idle'     as const, label: t.adminAgentsIdle     },
    { key: 'inactive' as const, label: t.adminAgentsInactive },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0F] p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-white">{t.adminAgents}</h1>
          <button
            onClick={() => setShowNew(true)}
            className="px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-sm text-white font-medium transition-colors"
          >
            + {t.adminAgentsNew}
          </button>
        </div>

        <div className="flex gap-1 bg-[#12121A] p-1 rounded-lg w-fit">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
                tab === key
                  ? 'bg-[#1A1A24] text-white font-medium'
                  : 'text-[#8B8B9E] hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {isLoading && <p className="text-sm text-[#8B8B9E]">{t.loading}</p>}
        {error     && <p className="text-sm text-red-400">{(error as Error).message}</p>}
        {!isLoading && !error && filtered.length === 0 && (
          <p className="text-sm text-[#8B8B9E]">{t.noData}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(a => (
            <div
              key={a.id}
              className="bg-[#12121A] border border-[#2A2A3A] rounded-xl p-4 hover:border-[#3B3B4A] transition-colors flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/agents/${a.id}`}
                    className="text-sm font-medium text-white hover:text-[#3B82F6] transition-colors block truncate"
                  >
                    {a.name}
                  </Link>
                  <p className="text-xs text-[#555566] truncate">{a.type}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[a.status]}`}>
                  {a.status === 'active'
                    ? t.adminAgentStatusActive
                    : a.status === 'idle'
                    ? t.adminAgentStatusIdle
                    : t.adminAgentStatusInactive}
                </span>
              </div>

              {a.currentTask && (
                <p className="text-xs text-[#8B8B9E] line-clamp-1">
                  <span className="text-[#555566]">{t.adminAgentCurrentTask}:</span> {a.currentTask}
                </p>
              )}

              <div className="flex items-center justify-between mt-auto">
                <span className="text-xs text-[#555566]">
                  {a.lastActiveAt
                    ? new Date(a.lastActiveAt).toLocaleDateString()
                    : '—'}
                </span>
                {a.status !== 'inactive' ? (
                  <button
                    onClick={() => handleDeactivate(a)}
                    className="text-xs text-[#8B8B9E] hover:text-red-400 transition-colors"
                  >
                    {t.adminAgentDeactivate}
                  </button>
                ) : (
                  <button
                    onClick={() => handleActivate(a)}
                    className="text-xs text-[#8B8B9E] hover:text-emerald-400 transition-colors"
                  >
                    {t.adminAgentActivate}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showNew && (
        <NewAgentDialog
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['admin', 'agents'] });
            setShowNew(false);
          }}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}
