'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useT } from '@/lib/i18n';
import NewProjectDialog from '@/components/admin/new-project-dialog';

type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  emoji: string;
  status: string;
  createdAt: string;
};

async function fetchProjects(): Promise<Project[]> {
  const res  = await fetch('/api/admin/projects');
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? 'Failed to load projects');
  return json.data;
}

export default function AdminProjectsPage() {
  const t   = useT();
  const qc  = useQueryClient();
  const [tab,     setTab]     = useState<'active' | 'archived'>('active');
  const [showNew, setShowNew] = useState(false);

  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ['admin', 'projects'],
    queryFn:  fetchProjects,
  });

  const filtered = projects.filter(p => p.status === tab);

  async function handleArchive(p: Project) {
    if (!confirm(t.adminArchiveConfirm(p.name))) return;
    const res  = await fetch(`/api/admin/projects/${p.slug}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.ok) { alert(json.error); return; }
    qc.invalidateQueries({ queryKey: ['admin', 'projects'] });
  }

  async function handleRestore(p: Project) {
    const res  = await fetch(`/api/admin/projects/${p.slug}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: 'active' }),
    });
    const json = await res.json();
    if (!json.ok) { alert(json.error); return; }
    qc.invalidateQueries({ queryKey: ['admin', 'projects'] });
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-white">{t.adminProjects}</h1>
          <button
            onClick={() => setShowNew(true)}
            className="px-4 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-sm text-white font-medium transition-colors"
          >
            + {t.adminNewProject}
          </button>
        </div>

        <div className="flex gap-1 bg-[#12121A] p-1 rounded-lg w-fit">
          {(['active', 'archived'] as const).map(s => (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
                tab === s
                  ? 'bg-[#1A1A24] text-white font-medium'
                  : 'text-[#8B8B9E] hover:text-white'
              }`}
            >
              {s === 'active' ? t.adminProjectsActive : t.adminProjectsArchived}
            </button>
          ))}
        </div>

        {isLoading && <p className="text-sm text-[#8B8B9E]">{t.loading}</p>}
        {error     && <p className="text-sm text-red-400">{(error as Error).message}</p>}
        {!isLoading && !error && filtered.length === 0 && (
          <p className="text-sm text-[#8B8B9E]">{t.noData}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <div
              key={p.id}
              className="bg-[#12121A] border border-[#2A2A3A] rounded-xl p-4 hover:border-[#3B3B4A] transition-colors flex flex-col gap-3"
            >
              <div className="flex items-start gap-2">
                <span className="text-2xl leading-none mt-0.5">{p.emoji}</span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/projects/${p.slug}`}
                    className="text-sm font-medium text-white hover:text-[#3B82F6] transition-colors block truncate"
                  >
                    {p.name}
                  </Link>
                  <p className="text-xs text-[#555566] font-mono truncate">{p.slug}</p>
                </div>
              </div>

              {p.description && (
                <p className="text-xs text-[#8B8B9E] line-clamp-2">{p.description}</p>
              )}

              <div className="flex items-center justify-between mt-auto">
                <span className="text-xs text-[#555566]">
                  {new Date(p.createdAt).toLocaleDateString()}
                </span>
                {tab === 'active' ? (
                  <button
                    onClick={() => handleArchive(p)}
                    className="text-xs text-[#8B8B9E] hover:text-red-400 transition-colors"
                  >
                    {t.adminArchive}
                  </button>
                ) : (
                  <button
                    onClick={() => handleRestore(p)}
                    className="text-xs text-[#8B8B9E] hover:text-emerald-400 transition-colors"
                  >
                    {t.adminRestore}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showNew && (
        <NewProjectDialog
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['admin', 'projects'] });
            setShowNew(false);
          }}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}
