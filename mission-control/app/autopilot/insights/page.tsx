"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { AlertTriangle, TrendingUp, Zap, Target, Flag, Lightbulb } from "lucide-react";

// ── 类型 ────────────────────────────────────────────────────────
interface InsightRow {
  id: string;
  title: string;
  summary: string;
  type: string;
  severity: string;
  status: string;
  suggestedAction: string | null;
  observedAt: string;
  createdAt: string;
  project: { name: string; emoji: string; color: string } | null;
}

// ── 常量 ────────────────────────────────────────────────────────
const SEVERITY_COLORS: Record<string, string> = {
  low:      "#3B82F6",
  medium:   "#EAB308",
  high:     "#F97316",
  critical: "#EF4444",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  anomaly:     <AlertTriangle className="w-3 h-3" />,
  opportunity: <Zap className="w-3 h-3" />,
  risk:        <Flag className="w-3 h-3" />,
  trend:       <TrendingUp className="w-3 h-3" />,
  milestone:   <Target className="w-3 h-3" />,
};

const SEVERITIES = ["all", "low", "medium", "high", "critical"];
const TYPES      = ["all", "anomaly", "opportunity", "risk", "trend", "milestone"];
const STATUSES   = ["all", "new", "acknowledged", "planned", "dismissed"];

function FilterChips({
  options,
  value,
  onChange,
  colorMap,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  colorMap?: Record<string, string>;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      {options.map((opt) => {
        const active = value === opt;
        const color  = colorMap?.[opt];
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 capitalize
              ${active
                ? "text-white"
                : "bg-[#12121A] border border-[#2A2A3A] text-[#8B8B9E] hover:text-white hover:border-[#3A3A4A]"
              }`}
            style={active ? { backgroundColor: color ?? "#6366F1" } : {}}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function InsightCard({ insight }: { insight: InsightRow }) {
  const severityColor = SEVERITY_COLORS[insight.severity] ?? "#6366F1";
  const icon          = TYPE_ICONS[insight.type] ?? <AlertTriangle className="w-3 h-3" />;
  const ago           = new Date(insight.observedAt).toLocaleDateString("zh-CN", {
    month:  "short",
    day:    "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });

  return (
    <Link href={`/autopilot/insights/${insight.id}`} className="block bg-[#12121A] border border-[#2A2A3A] rounded-xl p-4 hover:border-[#3A3A4A] transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {insight.project && (
            <span className="text-sm">{insight.project.emoji}</span>
          )}
          <span className="text-xs text-[#8B8B9E]">
            {insight.project?.name ?? "—"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1A1A28] text-[#8B8B9E] text-xs capitalize">
            {icon}
            {insight.type}
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize text-white"
            style={{ backgroundColor: severityColor }}
          >
            {insight.severity}
          </span>
        </div>
      </div>

      <p className="text-sm font-semibold text-white mb-1">{insight.title}</p>
      <p className="text-xs text-[#8B8B9E] leading-relaxed mb-3">{insight.summary}</p>

      {insight.suggestedAction && (
        <div className="flex items-start gap-1.5 bg-[#1A1A28] rounded-lg px-3 py-2 mb-3">
          <Lightbulb className="w-3 h-3 text-yellow-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-[#C0C0D0]">{insight.suggestedAction}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#555566]">{ago}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1A1A28] text-[#8B8B9E] capitalize">
          {insight.status}
        </span>
      </div>
    </Link>
  );
}

export default function InsightsPage() {
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [severity, setSeverity] = useState("all");
  const [type, setType]         = useState("all");
  const [status, setStatus]     = useState("all");

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (severity !== "all") params.set("severity", severity);
    if (type     !== "all") params.set("type",     type);
    if (status   !== "all") params.set("status",   status);

    const res  = await fetch(`/api/autopilot/insights?${params.toString()}`);
    const data = await res.json();
    setInsights(data.insights ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [severity, type, status]);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header title="Insights" subtitle={`自动观测 · ${total} 条`} />

      <div className="p-4 md:p-6 space-y-4">
        <div className="space-y-2">
          <FilterChips options={SEVERITIES} value={severity} onChange={setSeverity} colorMap={SEVERITY_COLORS} />
          <FilterChips options={TYPES}      value={type}     onChange={setType} />
          <FilterChips options={STATUSES}   value={status}   onChange={setStatus} />
        </div>

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-[#12121A] border border-[#2A2A3A] animate-pulse" />
            ))}
          </div>
        ) : insights.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#555566]">
            <AlertTriangle className="w-8 h-8 mb-3" />
            <p className="text-sm">暂无 Insights</p>
            <p className="text-xs mt-1">Observer 扫描后自动生成</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
