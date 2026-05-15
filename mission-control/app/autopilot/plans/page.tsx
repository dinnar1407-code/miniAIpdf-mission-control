"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { ClipboardList, ChevronRight, Zap, AlertTriangle } from "lucide-react";

// ── 类型 ────────────────────────────────────────────────────────
interface PlanRow {
  id: string;
  objective: string;
  status: string;
  priority: number;
  riskLevel: number;
  estimatedKpi: string | null;
  createdAt: string;
  project: { name: string; emoji: string; color: string } | null;
  insight: { title: string; type: string; severity: string } | null;
  steps: { id: string }[];
  missions: { id: string; status: string }[];
}

// ── 常量 ────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  draft:     "#5A5A6E",
  pending:   "#EAB308",
  approved:  "#3B82F6",
  executing: "#8B5CF6",
  completed: "#10B981",
  failed:    "#EF4444",
  rejected:  "#6B7280",
};

const STATUSES = ["all", "pending", "approved", "executing", "completed", "failed", "rejected"];

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "#5A5A6E";
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize text-white"
      style={{ backgroundColor: color }}
    >
      {status}
    </span>
  );
}

function PriorityDots({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: i < level ? "#F97316" : "#2A2A3A" }}
        />
      ))}
    </div>
  );
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
        const color  = STATUS_COLORS[opt];
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

function PlanCard({ plan }: { plan: PlanRow }) {
  const ago = new Date(plan.createdAt).toLocaleDateString("zh-CN", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <Link
      href={`/autopilot/plans/${plan.id}`}
      className="block bg-[#12121A] border border-[#2A2A3A] rounded-xl p-4 hover:border-[#4A4A5A] transition-colors group"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {plan.project && (
            <span className="text-sm flex-shrink-0">{plan.project.emoji}</span>
          )}
          <span className="text-xs text-[#8B8B9E] truncate">
            {plan.project?.name ?? "—"}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <PriorityDots level={plan.priority} />
          <StatusBadge status={plan.status} />
          <ChevronRight className="w-3.5 h-3.5 text-[#555566] group-hover:text-[#8B8B9E] transition-colors" />
        </div>
      </div>

      <p className="text-sm font-semibold text-white mb-1.5 line-clamp-2">
        {plan.objective}
      </p>

      {plan.insight && (
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="w-3 h-3 text-yellow-400 flex-shrink-0" />
          <p className="text-xs text-[#8B8B9E] truncate">{plan.insight.title}</p>
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1E1E2E]">
        <div className="flex items-center gap-3 text-[10px] text-[#555566]">
          <span>{plan.steps.length} steps</span>
          {plan.missions.length > 0 && (
            <span>{plan.missions.length} mission{plan.missions.length > 1 ? "s" : ""}</span>
          )}
          {plan.estimatedKpi && (
            <span className="text-[#8B8B9E]">{plan.estimatedKpi}</span>
          )}
        </div>
        <span className="text-[10px] text-[#555566]">{ago}</span>
      </div>
    </Link>
  );
}

export default function PlansPage() {
  const [plans, setPlans]     = useState<PlanRow[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus]   = useState("all");

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    const res  = await fetch(`/api/autopilot/plans?${params.toString()}`);
    const data = await res.json() as { plans: PlanRow[]; total: number };
    setPlans(data.plans ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [status]);

  useEffect(() => { void fetchPlans(); }, [fetchPlans]);

  const pendingCount = plans.filter((p) => p.status === "pending").length;

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header
        title="Plans"
        subtitle={`自动驾驶计划 · ${total} 条${pendingCount > 0 ? ` · ${pendingCount} 待审批` : ""}`}
      />

      <div className="p-4 md:p-6 space-y-4">
        <FilterChips options={STATUSES} value={status} onChange={setStatus} />

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 rounded-xl bg-[#12121A] border border-[#2A2A3A] animate-pulse" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#555566]">
            <ClipboardList className="w-8 h-8 mb-3" />
            <p className="text-sm">暂无 Plans</p>
            <p className="text-xs mt-1">Insight 触发后自动生成</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        )}

        {!loading && plans.length > 0 && status === "pending" && pendingCount > 0 && (
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            <p className="text-xs text-yellow-300">
              {pendingCount} 个计划等待审批后才能执行
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
