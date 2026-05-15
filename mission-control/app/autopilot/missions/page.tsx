"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { useT } from "@/lib/i18n";
import { Rocket, CheckCircle2, XCircle, Clock, Loader2, AlertTriangle } from "lucide-react";

// ── 类型 ────────────────────────────────────────────────────────
interface MissionRow {
  id: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  resultSummary: string | null;
  errorMessage: string | null;
  createdAt: string;
  workflowRunId: string | null;
  plan: { id: string; objective: string; status: string } | null;
  project: { name: string; emoji: string; color: string } | null;
}

// ── 常量 ────────────────────────────────────────────────────────
const STATUS_META: Record<string, { color: string; label: string }> = {
  queued:            { color: "#EAB308", label: "Queued"         },
  executing:         { color: "#8B5CF6", label: "Executing"      },
  succeeded:         { color: "#10B981", label: "Succeeded"      },
  failed:            { color: "#EF4444", label: "Failed"         },
  cancelled:         { color: "#6B7280", label: "Cancelled"      },
  awaiting_feedback: { color: "#3B82F6", label: "Needs Feedback" },
};

const STATUSES = ["all", "queued", "executing", "succeeded", "failed", "cancelled", "awaiting_feedback"];

function calcDuration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const ms = new Date(end ?? Date.now()).getTime() - new Date(start).getTime();
  if (ms < 60_000)    return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.round(ms / 3_600_000)}h`;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "succeeded") return <CheckCircle2 className="w-4 h-4 text-[#10B981]" />;
  if (status === "failed")    return <XCircle      className="w-4 h-4 text-[#EF4444]" />;
  if (status === "executing") return <Loader2      className="w-4 h-4 text-[#8B5CF6] animate-spin" />;
  return                             <Clock        className="w-4 h-4 text-[#EAB308]" />;
}

function FilterChips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      {options.map((opt) => {
        const active = value === opt;
        const meta   = STATUS_META[opt];
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0
              ${active
                ? "text-white"
                : "bg-[#12121A] border border-[#2A2A3A] text-[#8B8B9E] hover:text-white hover:border-[#3A3A4A]"
              }`}
            style={active ? { backgroundColor: meta?.color ?? "#6366F1" } : {}}
          >
            {meta?.label ?? opt}
          </button>
        );
      })}
    </div>
  );
}

function MissionCard({ mission }: { mission: MissionRow }) {
  const meta  = STATUS_META[mission.status];
  const color = meta?.color ?? "#5A5A6E";
  const dur   = calcDuration(mission.startedAt, mission.completedAt);
  const ago   = new Date(mission.createdAt).toLocaleDateString("zh-CN", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <Link
      href={`/autopilot/missions/${mission.id}`}
      className="block bg-[#12121A] border border-[#2A2A3A] rounded-xl p-4 space-y-3 hover:border-[#4A4A5A] transition-colors"
    >
      {/* 顶部：项目 + 状态 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {mission.project && (
            <span className="text-sm flex-shrink-0">{mission.project.emoji}</span>
          )}
          <span className="text-xs text-[#8B8B9E] truncate">
            {mission.project?.name ?? "—"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <StatusIcon status={mission.status} />
          <span
            className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: color }}
          >
            {meta?.label ?? mission.status}
          </span>
        </div>
      </div>

      {/* Plan objective (plain text — navigates via card link) */}
      {mission.plan && (
        <p className="text-sm font-medium text-white line-clamp-2">
          {mission.plan.objective}
        </p>
      )}

      {/* Result summary */}
      {mission.resultSummary && (
        <p className="text-xs text-[#8B8B9E] leading-relaxed line-clamp-2">
          {mission.resultSummary}
        </p>
      )}

      {/* Error */}
      {mission.errorMessage && (
        <div className="flex items-start gap-1.5 bg-red-500/10 rounded-lg px-2.5 py-2">
          <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300 line-clamp-2">{mission.errorMessage}</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-[#1E1E2E]">
        <div className="flex items-center gap-3 text-[10px] text-[#555566]">
          <span className="font-mono">{mission.id.slice(0, 12)}…</span>
          <span>⏱ {dur}</span>
        </div>
        <span className="text-[10px] text-[#555566]">{ago}</span>
      </div>
    </Link>
  );
}

export default function MissionsPage() {
  const t = useT();
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [status, setStatus]     = useState("all");

  const fetchMissions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    const res  = await fetch(`/api/autopilot/missions?${params.toString()}`);
    const data = await res.json() as { missions: MissionRow[]; total: number };
    setMissions(data.missions ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [status]);

  useEffect(() => { void fetchMissions(); }, [fetchMissions]);

  const runningCount = missions.filter((m) => m.status === "executing").length;

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header
        title="Missions"
        subtitle={t.missionsSubtitle(total, runningCount)}
      />

      <div className="p-4 md:p-6 space-y-4">
        <FilterChips options={STATUSES} value={status} onChange={setStatus} />

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 rounded-xl bg-[#12121A] border border-[#2A2A3A] animate-pulse" />
            ))}
          </div>
        ) : missions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#555566]">
            <Rocket className="w-8 h-8 mb-3" />
            <p className="text-sm">{t.missionsNone}</p>
            <p className="text-xs mt-1">{t.missionsNoneHint}</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {missions.map((m) => (
              <MissionCard key={m.id} mission={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
