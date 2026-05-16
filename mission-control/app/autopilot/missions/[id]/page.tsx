"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { useT } from "@/lib/i18n";
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, Loader2,
  AlertTriangle, ChevronDown, ChevronRight, Bot,
} from "lucide-react";

// ── 类型 ────────────────────────────────────────────────────────
interface StepResult {
  stepIndex: number;
  stepId?: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  output?: string;
  error?: string;
}

interface WorkflowStep {
  id: string;
  type: string;
  label: string;
  agent?: string;
  action?: string;
}

interface PlanStep {
  id: string;
  order: number;
  action: string;
  agentId: string | null;
}

interface MissionDetail {
  id: string;
  planId: string;
  projectId: string;
  workflowId: string;
  workflowRunId: string | null;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  resultSummary: string | null;
  errorMessage: string | null;
  createdAt: string;
  plan: {
    id: string;
    objective: string;
    status: string;
    steps: PlanStep[];
  } | null;
  project: { name: string; emoji: string; color: string } | null;
}

interface WorkflowDetail {
  id: string;
  name: string;
  steps: string;
}

interface WorkflowRunDetail {
  id: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  stepResults: string;
  result: string | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface ApiResponse {
  mission: MissionDetail;
  workflow: WorkflowDetail | null;
  workflowRun: WorkflowRunDetail | null;
}

// ── 常量 ────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  queued:            "#EAB308",
  executing:         "#8B5CF6",
  succeeded:         "#10B981",
  failed:            "#EF4444",
  cancelled:         "#6B7280",
  awaiting_feedback: "#3B82F6",
};

const AGENT_COLORS: Record<string, string> = {
  playfish: "#3B82F6",
  pm01:     "#8B5CF6",
  dfm:      "#10B981",
  admin01:  "#F59E0B",
};

// ── 工具函数 ─────────────────────────────────────────────────────
function calcDuration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const ms = new Date(end ?? Date.now()).getTime() - new Date(start).getTime();
  if (ms < 1000)      return `${ms}ms`;
  if (ms < 60_000)    return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
  return `${Math.round(ms / 3_600_000)}h`;
}

function relativeTime(iso: string | null, ago: (n: number, unit: string) => string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)     return ago(Math.round(diff / 1000), "s");
  if (diff < 3_600_000)  return ago(Math.round(diff / 60_000), "m");
  if (diff < 86_400_000) return ago(Math.round(diff / 3_600_000), "h");
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ── 单步渲染 ─────────────────────────────────────────────────────
function StepCard({
  index,
  total,
  wfStep,
  result,
  missionStatus,
}: {
  index: number;
  total: number;
  wfStep: WorkflowStep | undefined;
  result: StepResult | undefined;
  missionStatus: string;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const status    = result?.status ?? "pending";
  const isRunning = status === "running" && missionStatus === "executing";

  let borderColor = "#2A2A3A";
  let icon: React.ReactNode;
  let statusLabel: string;
  let statusClass: string;

  if (status === "completed") {
    borderColor  = "#10B98133";
    icon         = <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />;
    statusLabel  = "done";
    statusClass  = "bg-[#10B98120] text-[#10B981]";
  } else if (status === "failed") {
    borderColor  = "#EF444433";
    icon         = <XCircle className="w-4 h-4 text-[#EF4444] flex-shrink-0" />;
    statusLabel  = "failed";
    statusClass  = "bg-[#EF444420] text-[#EF4444]";
  } else if (isRunning) {
    borderColor  = "#8B5CF633";
    icon         = <Loader2 className="w-4 h-4 text-[#8B5CF6] animate-spin flex-shrink-0" />;
    statusLabel  = "running";
    statusClass  = "bg-[#8B5CF620] text-[#8B5CF6]";
  } else if (status === "skipped") {
    icon         = <span className="w-4 h-4 text-[#5A5A6E] flex-shrink-0 text-xs font-mono leading-4">↷</span>;
    statusLabel  = "skipped";
    statusClass  = "bg-[#1A1A28] text-[#555566]";
  } else {
    icon         = <Clock className="w-4 h-4 text-[#555566] flex-shrink-0" />;
    statusLabel  = "pending";
    statusClass  = "bg-[#1A1A28] text-[#555566]";
  }

  const agentId    = wfStep?.agent;
  const agentColor = agentId ? (AGENT_COLORS[agentId] ?? "#6366F1") : "#5A5A6E";
  const action     = wfStep?.action ?? wfStep?.label ?? `Step ${index + 1}`;
  const dur        = result?.startedAt
    ? calcDuration(result.startedAt, result.completedAt ?? null)
    : null;
  const hasOutput  = !!(result?.output || result?.error);

  return (
    <div
      className="rounded-xl border p-4 space-y-2 transition-colors"
      style={{ borderColor }}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-[10px] text-[#555566]">
              Step {index + 1} of {total}
            </span>
            {agentId && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white flex items-center gap-1"
                style={{ backgroundColor: agentColor }}
              >
                <Bot className="w-2.5 h-2.5" />
                {agentId}
              </span>
            )}
            <span className={`text-[10px] capitalize px-1.5 py-0.5 rounded font-medium ${statusClass}`}>
              {statusLabel}
            </span>
            {dur && status !== "pending" && (
              <span className="text-[10px] text-[#555566]">⏱ {dur}</span>
            )}
          </div>
          <p className="text-xs text-white leading-relaxed">{action}</p>
        </div>
      </div>

      {hasOutput && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] text-[#8B8B9E] hover:text-white transition-colors mt-1"
          >
            {expanded
              ? <ChevronDown  className="w-3 h-3" />
              : <ChevronRight className="w-3 h-3" />}
            {expanded ? t.missionStepCollapseOutput : t.missionStepExpandOutput}
          </button>
          {expanded && (
            <div className="mt-2 bg-[#0A0A0F] rounded-lg p-3 max-h-64 overflow-y-auto">
              {result?.error ? (
                <p className="text-xs text-red-300 whitespace-pre-wrap font-mono leading-relaxed">
                  {result.error}
                </p>
              ) : (
                <p className="text-xs text-[#C0C0D0] whitespace-pre-wrap leading-relaxed">
                  {result?.output}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 主页面 ───────────────────────────────────────────────────────
export default function MissionDetailPage() {
  const t                    = useT();
  const { id }               = useParams() as { id: string };
  const [rawOpen, setRawOpen] = useState(false);

  const { data, isLoading, error } = useQuery<ApiResponse>({
    queryKey: ["mission", id],
    queryFn:  async () => {
      const res = await fetch(`/api/autopilot/missions/${id}`);
      if (!res.ok) throw new Error("Mission not found");
      return res.json() as Promise<ApiResponse>;
    },
    refetchInterval: (query) => {
      const d = query.state.data as ApiResponse | undefined;
      return d?.mission?.status === "executing" ? 5000 : false;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#8B8B9E] animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center gap-3">
        <AlertTriangle className="w-8 h-8 text-[#EF4444]" />
        <p className="text-[#8B8B9E] text-sm">{t.missionNotFound}</p>
        <Link href="/autopilot/plans" className="text-xs text-[#3B82F6] hover:underline">
          {t.missionBackToPlans}
        </Link>
      </div>
    );
  }

  const { mission, workflow, workflowRun } = data;

  let stepResults: StepResult[] = [];
  try {
    if (workflowRun?.stepResults) {
      stepResults = JSON.parse(workflowRun.stepResults) as StepResult[];
    }
  } catch { /* ignore */ }

  let wfSteps: WorkflowStep[] = [];
  try {
    if (workflow?.steps) {
      wfSteps = JSON.parse(workflow.steps) as WorkflowStep[];
    }
  } catch { /* ignore */ }

  const totalSteps  = workflowRun?.totalSteps ?? wfSteps.length;
  const statusColor = STATUS_COLORS[mission.status] ?? "#5A5A6E";
  const dur         = calcDuration(mission.startedAt, mission.completedAt);
  const doneCount   = stepResults.filter(r => r.status === "completed").length;

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header
        title="Mission"
        subtitle={mission.project ? `${mission.project.emoji} ${mission.project.name}` : t.missionSubtitle}
      />

      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
        {/* Back to Plan */}
        {mission.plan && (
          <Link
            href={`/autopilot/plans/${mission.plan.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-[#8B8B9E] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t.missionBackToPlan}
          </Link>
        )}

        {/* Header card */}
        <div className="bg-[#12121A] border border-[#2A2A3A] rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            {mission.project && (
              <span
                className="px-2.5 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: mission.project.color + "22",
                  color:           mission.project.color,
                }}
              >
                {mission.project.emoji} {mission.project.name}
              </span>
            )}
            <span
              className="px-2.5 py-1 rounded-full text-xs font-semibold capitalize text-white"
              style={{ backgroundColor: statusColor }}
            >
              {mission.status}
            </span>
          </div>

          {mission.plan && (
            <p className="text-sm font-semibold text-white leading-snug">
              {mission.plan.objective}
            </p>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-[#555566] mb-0.5">{t.missionStarted}</p>
              <p className="text-xs text-[#8B8B9E]">{mission.startedAt ? t.timeAgo(Date.now() - new Date(mission.startedAt).getTime()) : '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#555566] mb-0.5">{t.missionCompleted}</p>
              <p className="text-xs text-[#8B8B9E]">{mission.completedAt ? t.timeAgo(Date.now() - new Date(mission.completedAt).getTime()) : '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#555566] mb-0.5">{t.missionDuration}</p>
              <p className="text-xs text-[#8B8B9E]">{dur}</p>
            </div>
          </div>

          <p className="text-[10px] text-[#555566] font-mono">{mission.id}</p>
        </div>

        {/* Steps Execution */}
        {totalSteps > 0 && (
          <div className="bg-[#12121A] border border-[#2A2A3A] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2A2A3A] flex items-center justify-between">
              <p className="text-xs font-semibold text-white">{t.missionStepsExecution}</p>
              <span className="text-[10px] text-[#555566]">
                {t.missionStepsDone(doneCount, totalSteps)}
              </span>
            </div>
            <div className="p-4 space-y-3">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <StepCard
                  key={i}
                  index={i}
                  total={totalSteps}
                  wfStep={wfSteps[i]}
                  result={stepResults[i]}
                  missionStatus={mission.status}
                />
              ))}
            </div>
          </div>
        )}

        {/* Result Summary */}
        <div className="bg-[#12121A] border border-[#2A2A3A] rounded-xl p-4">
          <p className="text-xs font-semibold text-white mb-2">{t.missionResultSummary}</p>
          {mission.resultSummary ? (
            <p className="text-xs text-[#8B8B9E] leading-relaxed whitespace-pre-wrap">
              {mission.resultSummary}
            </p>
          ) : (
            <p className="text-xs text-[#555566] italic">{t.missionNoSummary}</p>
          )}
        </div>

        {/* Error card */}
        {mission.status === "failed" && mission.errorMessage && (
          <div className="bg-[#12121A] border border-red-500/40 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-xs font-semibold text-red-400">{t.missionError}</p>
            </div>
            <p className="text-xs text-red-300 leading-relaxed whitespace-pre-wrap font-mono">
              {mission.errorMessage}
            </p>
          </div>
        )}

        {/* Raw Data (collapsed) */}
        <div className="bg-[#12121A] border border-[#2A2A3A] rounded-xl overflow-hidden">
          <button
            onClick={() => setRawOpen(!rawOpen)}
            className="w-full px-4 py-3 flex items-center justify-between text-xs text-[#8B8B9E] hover:text-white transition-colors"
          >
            <span className="font-semibold">{t.missionRawData}</span>
            {rawOpen
              ? <ChevronDown  className="w-3.5 h-3.5" />
              : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {rawOpen && (
            <div className="border-t border-[#2A2A3A] p-4 space-y-4">
              {workflowRun && (
                <div>
                  <p className="text-[10px] text-[#555566] mb-2 uppercase tracking-wider">stepResults</p>
                  <pre className="text-[10px] text-[#8B8B9E] bg-[#0A0A0F] rounded-lg p-3 overflow-x-auto max-h-64 overflow-y-auto leading-relaxed">
                    {(() => {
                      try { return JSON.stringify(JSON.parse(workflowRun.stepResults), null, 2); }
                      catch { return workflowRun.stepResults; }
                    })()}
                  </pre>
                </div>
              )}
              <div>
                <p className="text-[10px] text-[#555566] mb-2 uppercase tracking-wider">Mission</p>
                <pre className="text-[10px] text-[#8B8B9E] bg-[#0A0A0F] rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto leading-relaxed">
                  {JSON.stringify(
                    {
                      id:            mission.id,
                      status:        mission.status,
                      workflowId:    mission.workflowId,
                      workflowRunId: mission.workflowRunId,
                      startedAt:     mission.startedAt,
                      completedAt:   mission.completedAt,
                    },
                    null, 2
                  )}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
