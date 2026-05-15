"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { useT } from "@/lib/i18n";
import {
  AlertTriangle, TrendingUp, Zap, Trophy,
  Lightbulb, ArrowLeft, ChevronRight, TrendingDown, Loader2,
} from "lucide-react";

// ── 类型 ────────────────────────────────────────────────────────
interface Evidence {
  metric?:     string;
  source?:     string;
  current?:    number;
  baseline?:   number;
  delta7d?:    number;
  deltaPct7d?: number;
  target?:     number;
  unit?:       string;
  window?:     string;
  [key: string]: unknown;
}

interface InsightDetail {
  id: string;
  type: string;
  severity: string;
  title: string;
  summary: string;
  evidence: Evidence;
  suggestedAction: string | null;
  status: string;
  observedAt: string;
  createdAt: string;
  project: { id: string; name: string; emoji: string; color: string } | null;
  plans: { id: string; objective: string; status: string; createdAt: string }[];
}

// ── 常量 ────────────────────────────────────────────────────────
const SEVERITY_COLOR: Record<string, string> = {
  critical: "#EF4444",
  high:     "#F97316",
  medium:   "#EAB308",
  low:      "#6B7280",
};
const SEVERITY_BG: Record<string, string> = {
  critical: "border-red-500/20",
  high:     "border-orange-500/20",
  medium:   "border-yellow-500/20",
  low:      "border-gray-500/20",
};
const TYPE_ICONS: Record<string, React.ReactNode> = {
  anomaly:     <AlertTriangle className="w-4 h-4" />,
  risk:        <Zap          className="w-4 h-4" />,
  opportunity: <TrendingUp   className="w-4 h-4" />,
  trend:       <TrendingUp   className="w-4 h-4" />,
  milestone:   <Trophy       className="w-4 h-4" />,
};
const PLAN_STATUS_COLOR: Record<string, string> = {
  pending:   "#EAB308",
  approved:  "#3B82F6",
  executing: "#8B5CF6",
  completed: "#10B981",
  failed:    "#EF4444",
  rejected:  "#6B7280",
};

function fmtPct(val: number | undefined | null): string {
  if (val === undefined || val === null) return "—";
  const pct = val * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function fmtNum(val: number | undefined | null): string {
  if (val === undefined || val === null) return "—";
  return val.toLocaleString();
}

// ── Evidence 区域 ────────────────────────────────────────────────
function EvidenceSection({ evidence }: { evidence: Evidence }) {
  const t = useT();
  const isDown = (evidence.delta7d ?? 0) < 0;

  const stats: { label: string; value: string; mono?: boolean }[] = [
    { label: t.insightEvidenceCurrent,  value: fmtNum(evidence.current),    mono: true },
    { label: t.insightEvidenceBaseline, value: fmtNum(evidence.baseline),   mono: true },
    { label: t.insightEvidence7d,       value: fmtNum(evidence.delta7d),    mono: true },
    { label: t.insightEvidenceDelta,    value: fmtPct(evidence.deltaPct7d), mono: true },
    { label: t.insightEvidenceMetric,   value: evidence.metric ?? "—"                  },
    { label: t.insightEvidenceSource,   value: evidence.source ?? "—"                  },
    { label: t.insightEvidenceWindow,   value: evidence.window ?? "—"                  },
    { label: t.insightEvidenceUnit,     value: evidence.unit   ?? "—"                  },
  ];

  return (
    <div className="bg-[#12121A] border border-[#2A2A3A] rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        {isDown
          ? <TrendingDown className="w-4 h-4 text-[#EF4444]" />
          : <TrendingUp   className="w-4 h-4 text-[#10B981]" />
        }
        <h3 className="text-sm font-semibold text-white">Evidence</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-[#0A0A0F] rounded-lg p-2.5">
            <p className="text-[10px] text-[#555566] uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-sm font-semibold ${s.mono ? "font-mono" : ""} text-white`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>
      <details className="mt-1">
        <summary className="text-[11px] text-[#555566] cursor-pointer hover:text-[#8B8B9E] select-none">
          {t.insightRawData}
        </summary>
        <pre className="mt-2 text-[10px] text-[#6B6B8E] bg-[#0A0A0F] rounded-lg p-3 overflow-x-auto leading-relaxed">
          {JSON.stringify(evidence, null, 2)}
        </pre>
      </details>
    </div>
  );
}

// ── Toast ──────────────────────────────────────────────────────
function InlineToast({ msg, type, onDone }: { msg: string; type: "success" | "error"; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm text-white shadow-lg
      ${type === "success" ? "bg-[#10B981]" : "bg-[#EF4444]"}`}>
      {msg}
    </div>
  );
}

// ── Plan 卡 ────────────────────────────────────────────────────
function PlanCard({ insight, onGenerated }: { insight: InsightDetail; onGenerated: () => void }) {
  const t = useT();
  const router = useRouter();
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/autopilot/plans/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ insightId: insight.id }),
      });
      const data = await res.json() as { plan?: { id: string }; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to generate plan");
      return data as { plan: { id: string } };
    },
    onSuccess: (data) => {
      setToast({ msg: "Plan generated", type: "success" });
      setTimeout(() => router.push(`/autopilot/plans/${data.plan.id}`), 800);
      onGenerated();
    },
    onError: (err) => {
      setToast({ msg: err instanceof Error ? err.message : "Failed to generate plan", type: "error" });
    },
  });

  let body: React.ReactNode;

  if (insight.status === "new") {
    body = (
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#555566]">{t.insightPlanNone}</p>
        <button
          onClick={() => mutate()}
          disabled={isPending}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#6366F1] text-white font-medium hover:bg-[#5254CC] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending
            ? <><Loader2 className="w-3 h-3 animate-spin" />{t.insightPlanGenerating}</>
            : t.insightPlanGenerate
          }
        </button>
      </div>
    );
  } else if (insight.status === "planned") {
    body = (
      <div className="space-y-2">
        {insight.plans.map((plan) => (
          <Link
            key={plan.id}
            href={`/autopilot/plans/${plan.id}`}
            className="flex items-center justify-between gap-3 bg-[#0A0A0F] rounded-lg px-3 py-2.5 hover:bg-[#1E1E2E] transition-colors"
          >
            <p className="text-xs text-white line-clamp-1 flex-1">{plan.objective}</p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white capitalize"
                style={{ backgroundColor: PLAN_STATUS_COLOR[plan.status] ?? "#6B7280" }}
              >
                {plan.status}
              </span>
              <ChevronRight className="w-3 h-3 text-[#555566]" />
            </div>
          </Link>
        ))}
      </div>
    );
  } else if (insight.status === "dismissed") {
    body = <p className="text-xs text-[#555566]">{t.insightPlanDismissed}</p>;
  } else {
    body = <p className="text-xs text-[#555566] capitalize">{insight.status}</p>;
  }

  return (
    <>
      {toast && <InlineToast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <div className="bg-[#12121A] border border-[#2A2A3A] rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-white">{t.insightPlanGenerated}</h3>
        {body}
      </div>
    </>
  );
}

// ── 主页 ────────────────────────────────────────────────────────
export default function InsightDetailPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["insight", id],
    queryFn: async () => {
      const res = await fetch(`/api/autopilot/insights/${id}`);
      if (!res.ok) throw new Error("not found");
      return res.json() as Promise<{ insight: InsightDetail }>;
    },
  });

  const insight = data?.insight;
  const severityColor = SEVERITY_COLOR[insight?.severity ?? ""] ?? "#6B7280";
  const severityBorder = SEVERITY_BG[insight?.severity ?? ""]   ?? "border-gray-500/20";

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header
        title={insight?.title ?? "Insight"}
        subtitle={
          insight
            ? `${insight.project?.emoji ?? ""} ${insight.project?.name ?? "—"} · ${new Date(insight.observedAt).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}`
            : t.insightLoading
        }
      />

      <div className="p-4 md:p-6 max-w-3xl space-y-4">
        <Link
          href="/autopilot/insights"
          className="inline-flex items-center gap-1 text-xs text-[#555566] hover:text-[#8B8B9E] transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          {t.insightBack}
        </Link>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-[#12121A] border border-[#2A2A3A] animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center py-20 text-[#555566]">
            <AlertTriangle className="w-8 h-8 mb-3 text-[#EF4444]" />
            <p className="text-sm">{t.insightNotFound}</p>
          </div>
        )}

        {insight && (
          <>
            {/* Title card */}
            <div className={`bg-[#12121A] border ${severityBorder} rounded-xl p-4 space-y-3`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[#1E1E2E] text-[#8B8B9E] capitalize">
                  {TYPE_ICONS[insight.type] ?? <AlertTriangle className="w-3.5 h-3.5" />}
                  {insight.type}
                </span>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full text-white capitalize"
                  style={{ backgroundColor: severityColor }}
                >
                  {insight.severity}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-[#1E1E2E] text-[#8B8B9E] capitalize ml-auto">
                  {insight.status}
                </span>
              </div>
              <h1 className="text-base font-semibold text-white leading-snug">
                {insight.title}
              </h1>
              <p className="text-sm text-[#8B8B9E] leading-relaxed">
                {insight.summary}
              </p>
            </div>

            {/* Suggested action */}
            {insight.suggestedAction && (
              <div className="bg-[#12121A] border border-[#2A2A3A] rounded-xl p-4 flex items-start gap-3">
                <Lightbulb className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-[#8B8B9E] mb-1 uppercase tracking-wide">
                    {t.insightSuggestedAction}
                  </p>
                  <p className="text-sm text-white leading-relaxed">{insight.suggestedAction}</p>
                </div>
              </div>
            )}

            {/* Evidence */}
            <EvidenceSection evidence={insight.evidence} />

            {/* Generated Plan */}
            <PlanCard insight={insight} onGenerated={() => refetch()} />

            {/* Meta */}
            <div className="text-[11px] text-[#555566] space-y-1 pt-1 pb-4">
              <p>ID：<span className="font-mono">{insight.id}</span></p>
              <p>{t.insightObservedAt}{new Date(insight.observedAt).toLocaleString()}</p>
              <p>{t.insightCreatedAt}{new Date(insight.createdAt).toLocaleString()}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
