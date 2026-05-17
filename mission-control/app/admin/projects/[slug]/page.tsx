'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n';
import GoalFormDialog, { type GoalShape } from '@/components/admin/goal-form-dialog';

type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  emoji: string;
  status: string;
  createdAt: string;
  goals: GoalShape[];
};

async function fetchProject(slug: string): Promise<Project> {
  const res  = await fetch(`/api/admin/projects/${slug}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? 'Not found');
  return json.data;
}

const UNIT_LABELS:    Record<string, string> = { usd: 'USD', count: '#', percent: '%' };
const CADENCE_LABELS: Record<string, string> = {
  daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly',
};

export default function ProjectDetailPage() {
  const t      = useT();
  const params = useParams();
  const router = useRouter();
  const qc     = useQueryClient();
  const slug   = params.slug as string;

  const [goalDialog, setGoalDialog] = useState<
    { mode: 'create' } | { mode: 'edit'; goal: GoalShape } | null
  >(null);

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['admin', 'project', slug],
    queryFn:  () => fetchProject(slug),
  });

  async function handleDeleteGoal(goal: GoalShape) {
    if (!confirm(t.adminDeleteGoalConfirm)) return;
    const res  = await fetch(`/api/admin/goals/${goal.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.ok) { alert(json.error); return; }
    qc.invalidateQueries({ queryKey: ['admin', 'project', slug] });
  }

  function handleGoalSuccess() {
    qc.invalidateQueries({ queryKey: ['admin', 'project', slug] });
    setGoalDialog(null);
  }

  if (isLoading) return (
    <div className="min-h-screen bg-[#0A0A0F] p-6">
      <p className="text-sm text-[#8B8B9E]">{t.loading}</p>
    </div>
  );

  if (error || !project) return (
    <div className="min-h-screen bg-[#0A0A0F] p-6">
      <p className="text-sm text-red-400">{error ? (error as Error).message : 'Not found'}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0F] p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        <button
          onClick={() => router.push('/admin/projects')}
          className="text-xs text-[#8B8B9E] hover:text-white transition-colors"
        >
          {t.adminBack}
        </button>

        {/* Project header */}
        <div className="flex items-start gap-3">
          <span className="text-3xl leading-none mt-1">{project.emoji}</span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-white">{project.name}</h1>
            <p className="text-xs text-[#555566] font-mono">{project.slug}</p>
            {project.description && (
              <p className="text-sm text-[#8B8B9E] mt-1">{project.description}</p>
            )}
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
            project.status === 'active'
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-[#2A2A3A] text-[#8B8B9E]'
          }`}>
            {project.status === 'active' ? t.adminStatusActive : t.adminStatusArchived}
          </span>
        </div>

        {/* Goals */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white">{t.adminGoals}</h2>
            {project.status === 'active' && (
              <button
                onClick={() => setGoalDialog({ mode: 'create' })}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#1A1A24] border border-[#2A2A3A] text-[#8B8B9E] hover:text-white hover:border-[#3B3B4A] transition-colors"
              >
                + {t.adminAddGoal}
              </button>
            )}
          </div>

          {project.goals.length === 0 && (
            <p className="text-sm text-[#8B8B9E]">{t.adminNoGoals}</p>
          )}

          <div className="space-y-2">
            {project.goals.map(goal => (
              <div key={goal.id} className="bg-[#12121A] border border-[#2A2A3A] rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{goal.kpi}</p>
                    <p className="text-xs text-[#555566] mt-0.5">
                      {CADENCE_LABELS[goal.cadence] ?? goal.cadence} · {UNIT_LABELS[goal.unit] ?? goal.unit}
                    </p>
                  </div>
                  {project.status === 'active' && (
                    <div className="flex gap-3 shrink-0">
                      <button
                        onClick={() => setGoalDialog({ mode: 'edit', goal })}
                        className="text-xs text-[#8B8B9E] hover:text-white transition-colors"
                      >
                        {t.adminEditGoal}
                      </button>
                      <button
                        onClick={() => handleDeleteGoal(goal)}
                        className="text-xs text-[#8B8B9E] hover:text-red-400 transition-colors"
                      >
                        {t.adminDeleteGoal}
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat label={t.adminBaseline} value={fmtVal(goal.baseline, goal.unit)} />
                  <Stat label={t.adminTarget}   value={fmtVal(goal.target,   goal.unit)} />
                  <Stat label={t.adminCurrent}  value={goal.current != null ? fmtVal(goal.current, goal.unit) : '—'} />
                  <Stat label={t.adminDeadline} value={goal.deadline.slice(0, 10)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {goalDialog && (
        <GoalFormDialog
          projectSlug={slug}
          goal={goalDialog.mode === 'edit' ? goalDialog.goal : undefined}
          onSuccess={handleGoalSuccess}
          onClose={() => setGoalDialog(null)}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-[#555566] uppercase tracking-wider">{label}</p>
      <p className="text-sm text-white font-medium">{value}</p>
    </div>
  );
}

function fmtVal(n: number, unit: string): string {
  if (unit === 'usd')     return `$${n.toLocaleString()}`;
  if (unit === 'percent') return `${n}%`;
  return n.toLocaleString();
}
