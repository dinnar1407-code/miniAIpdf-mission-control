"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import {
  AlertTriangle, TrendingUp, Zap, Trophy, Loader2,
  CheckCircle2, XCircle, Clock, Radio, MessageSquare, Rocket,
} from "lucide-react";

// ── 类型 ────────────────────────────────────────────────────────
interface InsightRow {
  id: string;
  type: string;
  severity: string;
  title: string;
  summary: string;
  status: string;
  observedAt: string;
  createdAt: string;
  project: { name: string; emoji: string; color: string } | null;
}

interface MissionRow {
  id: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  plan: { id: string; objective: string; status: string } | null;
  project: { name: string; emoji: string; color: string } | null;
}

// ── 常量 ────────────────────────────────────────────────────────
const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const SEVERITY_COLOR: Record<string, string> = {
  critical: "#EF4444",
  high:     "#F97316",
  medium:   "#EAB308",
  low:      "#6B7280",
};
const SEVERITY_BG: Record<string, string> = {
  critical: "bg-red-500/10",
  high:     "bg-orange-500/10",
  medium:   "bg-yellow-500/10",
  low:      "bg-gray-500/10",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  anomaly:     <AlertTriangle className="w-3 h-3" />,
  risk:        <Zap          className="w-3 h-3" />,
  opportunity: <TrendingUp   className="w-3 h-3" />,
  trend:       <TrendingUp   className="w-3 h-3" />,
  milestone:   <Trophy       className="w-3 h-3" />,
};

// ── 小组件 ──────────────────────────────────────────────────────
function ColumnHeader({
  icon,
  title,
  count,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  href: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="text-[#8B8B9E]">{icon}</span>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {count !== undefined && (
          <span className="text-xs text-[#555566] bg-[#1E1E2E] px-1.5 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </div>
      <Link href={href} className="text-xs text-[#555566] hover:text-[#8B8B9E] transition-colors">
        全部 →
      </Link>
    </div>
  );
}

function InsightCard({ insight }: { insight: InsightRow }) {
  const color = SEVERITY_COLOR[insight.severity] ?? "#6B7280";
  const bg    = SEVERITY_BG[insight.severity]    ?? "bg-gray-500/10";
  return (
    <Link
      href={`/autopilot/insights/${insight.id}`}
      className="block bg-[#12121A] border border-[#2A2A3A] rounded-lg p-3 space-y-2 hover:border-[#4A4A5A] transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span style={{ color }} className="flex-shrink-0">
            {TYPE_ICONS[insight.type] ?? <AlertTriangle className="w-3 h-3" />}
          </span>
          <p className="text-xs font-medium text-white leading-tight line-clamp-2">
            {insight.title}
          </p>
        </div>
        <span
          className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${bg}`}
          style={{ color }}
        >
          {insight.severity}
        </span>
      </div>
      <p className="text-[11px] text-[#8B8B9E] leading-relaxed line-clamp-2">
        {insight.summary}
      </p>
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-[#555566]">
          {insight.project?.emoji} {insight.project?.name ?? "—"}
        </span>
        <span className="text-[10px] text-[#555566]">
          {new Date(insight.observedAt).toLocaleDateString("zh-CN", {
            month: "short", day: "numeric",
          })}
        </span>
      </div>
    </Link>
  );
}

function MissionStatusIcon({ status }: { status: string }) {
  if (status === "executing") return <Loader2      className="w-3.5 h-3.5 text-[#8B5CF6] animate-spin" />;
  if (status === "queued")    return <Clock        className="w-3.5 h-3.5 text-[#EAB308]" />;
  if (status === "succeeded") return <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />;
  return                             <XCircle      className="w-3.5 h-3.5 text-[#EF4444]" />;
}

function ActiveMissionCard({ mission }: { mission: MissionRow }) {
  const isExecuting = mission.status === "executing";
  return (
    <Link
      href={`/autopilot/missions/${mission.id}`}
      className={`block bg-[#12121A] border rounded-lg p-3 space-y-2 transition-colors
        ${isExecuting
          ? "border-[#8B5CF6]/40 hover:border-[#8B5CF6]/60"
          : "border-[#2A2A3A] hover:border-[#4A4A5A]"
        }`}
    >
      <div className="flex items-center gap-2">
        <MissionStatusIcon status={mission.status} />
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full
          ${isExecuting
            ? "text-[#8B5CF6] bg-[#8B5CF6]/10"
            : "text-[#EAB308] bg-[#EAB308]/10"
          }`}>
          {isExecuting ? "执行中" : "排队中"}
        </span>
        {mission.project && (
          <span className="text-[10px] text-[#555566] ml-auto flex-shrink-0">
            {mission.project.emoji} {mission.project.name}
          </span>
        )}
      </div>
      {mission.plan && (
        <p className="text-xs text-white leading-snug line-clamp-2">
          {mission.plan.objective}
        </p>
      )}
      <p className="text-[10px] text-[#555566] font-mono">{mission.id.slice(0, 12)}…</p>
    </Link>
  );
}

// ── 三栏列组件 ───────────────────────────────────────────────────
function InsightsColumn() {
  const { data, isLoading } = useQuery({
    queryKey: ["overview-insights"],
    queryFn: async () => {
      const res = await fetch("/api/autopilot/insights");
      return res.json() as Promise<{ insights: InsightRow[]; total: number }>;
    },
    refetchInterval: 60_000,
  });

  const sorted = [...(data?.insights ?? [])].sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
  );

  return (
    <div className="flex flex-col">
      <ColumnHeader
        icon={<Radio className="w-4 h-4" />}
        title="洞察流"
        count={data?.total}
        href="/autopilot/insights"
      />
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-[#12121A] border border-[#2A2A3A] animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-[#555566]">
          <Radio className="w-6 h-6 mb-2" />
          <p className="text-xs">暂无 Insights</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActiveMissionsColumn() {
  const { data, isLoading } = useQuery({
    queryKey: ["overview-missions-active"],
    queryFn: async () => {
      const res = await fetch("/api/autopilot/missions");
      return res.json() as Promise<{ missions: MissionRow[]; total: number }>;
    },
    refetchInterval: 10_000,
  });

  const active = (data?.missions ?? []).filter(
    (m) => m.status === "executing" || m.status === "queued"
  );

  return (
    <div className="flex flex-col">
      <ColumnHeader
        icon={<Rocket className="w-4 h-4" />}
        title="当前任务"
        count={active.length}
        href="/autopilot/missions"
      />
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-[#12121A] border border-[#2A2A3A] animate-pulse" />
          ))}
        </div>
      ) : active.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-[#555566]">
          <Rocket className="w-6 h-6 mb-2" />
          <p className="text-xs">无进行中任务</p>
          <Link href="/autopilot/missions" className="mt-2 text-[10px] text-[#3A3A4A] hover:text-[#555566]">
            查看历史 →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {active.map((m) => (
            <ActiveMissionCard key={m.id} mission={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedbackColumn() {
  return (
    <div className="flex flex-col">
      <ColumnHeader
        icon={<MessageSquare className="w-4 h-4" />}
        title="反馈库"
        count={0}
        href="/autopilot/plans"
      />
      <div className="flex flex-col items-center justify-center py-12 text-[#555566]">
        <MessageSquare className="w-6 h-6 mb-3 opacity-40" />
        <p className="text-xs text-center leading-relaxed px-4 text-[#3A3A4A]">
          No feedback yet —<br />will populate after Phase 3
        </p>
      </div>
    </div>
  );
}

// ── 主页 ────────────────────────────────────────────────────────
export default function AutopilotOverviewPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header
        title="Autopilot"
        subtitle="自动驾驶总览"
      />

      {/* 快捷入口 */}
      <div className="px-4 md:px-6 pt-4 flex items-center gap-2 flex-wrap">
        {[
          { href: "/autopilot/insights", label: "📡 Insights" },
          { href: "/autopilot/plans",    label: "🎯 Plans"    },
          { href: "/autopilot/missions", label: "🚀 Missions" },
        ].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="text-xs px-3 py-1.5 rounded-full bg-[#12121A] border border-[#2A2A3A] text-[#8B8B9E] hover:text-white hover:border-[#4A4A5A] transition-colors"
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* 三栏：xl=三栏 / lg=两栏 / <lg=单栏 */}
      <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 xl:gap-6 items-start">
        <InsightsColumn />
        <ActiveMissionsColumn />
        <FeedbackColumn />
      </div>
    </div>
  );
}
