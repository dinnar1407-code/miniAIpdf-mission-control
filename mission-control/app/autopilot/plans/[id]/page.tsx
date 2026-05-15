"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { useT } from "@/lib/i18n";
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, Zap,
  AlertTriangle, Shield, ChevronRight, Loader2,
} from "lucide-react";

// ── 类型 ────────────────────────────────────────────────────────
interface PlanStep {
  id: string;
  order: number;
  action: string;
  agentId: string | null;
  expectedOutput: string | null;
}

interface MissionRef {
  id: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

interface PlanDetail {
  id: string;
  objective: string;
  rationale: string;
  status: string;
  priority: number;
  riskLevel: number;
  reversibility: string;
  blastRadius: string | null;
  estimatedKpi: string | null;
  estimatedDelta: number | null;
  estimatedHorizon: number | null;
  generatedBy: string;
  createdAt: string;
  project: { name: string; emoji: string; color: string } | null;
  insight: { id: string; title: string; type: string; severity: string; summary: string } | null;
  planApproval: {
    riskLevel: number;
    reversibility: string;
    blastRadius: string | null;
    estimatedCost: number | null;
    decision: string;
    decidedBy: string | null;
    decidedAt: string | null;
    notes: string | null;
  } | null;
  steps: PlanStep[];
  missions: MissionRef[];
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

const MISSION_COLORS: Record<string, string> = {
  queued:    "#EAB308",
  executing: "#8B5CF6",
  succeeded: "#10B981",
  failed:    "#EF4444",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "#5A5A6E";
  return (
    <span
      className="px-2.5 py-1 rounded-full text-xs font-semibold capitalize text-white"
      style={{ backgroundColor: color }}
    >
      {status}
    </span>
  );
}

function RiskBar({ level }: { level: number }) {
  const colors = ["#10B981", "#3B82F6", "#EAB308", "#F97316", "#EF4444"];
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className="w-4 h-1.5 rounded-full"
          style={{ backgroundColor: i < level ? colors[level - 1] : "#2A2A3A" }}
        />
      ))}
      <span className="text-xs text-[#8B8B9E] ml-1">{level}/5</span>
    </div>
  );
}

export default function PlanDetailPage() {
  const t      = useT();
  const params = useParams();
  const id     = params.id as string;

  const [plan, setPlan]             = useState<PlanDetail | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [acting, setActing]         = useState<"approve" | "reject" | null>(null);
  const [notes, setNotes]           = useState("");
  const [showReject, setShowReject] = useState(false);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/autopilot/plans/${id}`);
    if (!res.ok) { setError("Plan not found"); setLoading(false); return; }
    const data = await res.json() as { plan: PlanDetail };
    setPlan(data.plan);
    setLoading(false);
  }, [id]);

  useEffect(() => { void fetchPlan(); }, [fetchPlan]);

  async function handleApprove() {
    setError(null);
    setActing("approve");
    const res = await fetch(`/api/autopilot/plans/${id}/approve`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ decidedBy: "user", notes: notes || undefined }),
    });
    if (res.ok) {
      await fetchPlan();
    } else {
      const body = await res.json() as { error?: string };
      setError(body.error ?? "Approve failed");
    }
    setActing(null);
  }

  async function handleReject() {
    if (!notes.trim()) { setError(t.planRejectRequired); return; }
    setError(null);
    setActing("reject");
    const res = await fetch(`/api/autopilot/plans/${id}/reject`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ decidedBy: "user", notes }),
    });
    if (res.ok) {
      await fetchPlan();
      setShowReject(false);
      setNotes("");
    } else {
      const body = await res.json() as { error?: string };
      setError(body.error ?? "Reject failed");
    }
    setActing(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#8B8B9E] animate-spin" />
      </div>
    );
  }

  if (error && !plan) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center gap-3">
        <AlertTriangle className="w-8 h-8 text-[#EF4444]" />
        <p className="text-[#8B8B9E] text-sm">{error}</p>
        <Link href="/autopilot/plans" className="text-xs text-[#3B82F6] hover:underline">← {t.planBack}</Link>
      </div>
    );
  }

  if (!plan) return null;

  const isPending  = plan.status === "pending";
  const isTerminal = ["completed", "failed", "rejected"].includes(plan.status);

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header
        title={plan.project ? `${plan.project.emoji} ${plan.project.name}` : "Plan"}
        subtitle={t.planSubtitle}
      />

      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
        {/* Back */}
        <Link
          href="/autopilot/plans"
          className="inline-flex items-center gap-1.5 text-xs text-[#8B8B9E] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Plans
        </Link>

        {/* Header card */}
        <div className="bg-[#12121A] border border-[#2A2A3A] rounded-xl p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-base font-semibold text-white leading-snug flex-1">
              {plan.objective}
            </p>
            <StatusBadge status={plan.status} />
          </div>

          <p className="text-sm text-[#8B8B9E] leading-relaxed">{plan.rationale}</p>

          {plan.insight && (
            <div className="flex items-start gap-2 bg-[#1A1A28] rounded-lg px-3 py-2">
              <Zap className="w-3.5 h-3.5 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-white">{plan.insight.title}</p>
                <p className="text-xs text-[#8B8B9E] mt-0.5">{plan.insight.summary}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <p className="text-[10px] text-[#555566] mb-1">Risk Level</p>
              <RiskBar level={plan.riskLevel} />
            </div>
            <div>
              <p className="text-[10px] text-[#555566] mb-1">Reversibility</p>
              <p className="text-xs text-[#8B8B9E] capitalize">{plan.reversibility}</p>
            </div>
            {plan.estimatedKpi && (
              <div>
                <p className="text-[10px] text-[#555566] mb-1">KPI Target</p>
                <p className="text-xs text-[#8B8B9E]">{plan.estimatedKpi}</p>
              </div>
            )}
            {plan.blastRadius && (
              <div>
                <p className="text-[10px] text-[#555566] mb-1">Blast Radius</p>
                <p className="text-xs text-[#8B8B9E]">{plan.blastRadius}</p>
              </div>
            )}
          </div>

          <p className="text-[10px] text-[#555566]">
            Generated by {plan.generatedBy} ·{" "}
            {new Date(plan.createdAt).toLocaleDateString("zh-CN", {
              year: "numeric", month: "short", day: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
        </div>

        {/* Steps */}
        <div className="bg-[#12121A] border border-[#2A2A3A] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2A2A3A]">
            <p className="text-xs font-semibold text-white">{t.planStepsSection(plan.steps.length)}</p>
          </div>
          {plan.steps.length === 0 ? (
            <p className="text-xs text-[#555566] text-center py-6">{t.planNoSteps}</p>
          ) : (
            <div className="divide-y divide-[#1E1E2E]">
              {plan.steps.map((step, idx) => (
                <div key={step.id} className="px-4 py-3 flex items-start gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#1A1A28] border border-[#2A2A3A] text-[10px] text-[#8B8B9E] flex items-center justify-center font-mono">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white">{step.action}</p>
                    {step.agentId && (
                      <p className="text-[10px] text-[#555566] mt-0.5">agent: {step.agentId}</p>
                    )}
                    {step.expectedOutput && (
                      <p className="text-[10px] text-[#8B8B9E] mt-0.5 italic">{step.expectedOutput}</p>
                    )}
                  </div>
                  <ChevronRight className="w-3 h-3 text-[#555566] flex-shrink-0 mt-0.5" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Missions */}
        {plan.missions.length > 0 && (
          <div className="bg-[#12121A] border border-[#2A2A3A] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2A2A3A]">
              <p className="text-xs font-semibold text-white">{t.planMissionsSection(plan.missions.length)}</p>
            </div>
            <div className="divide-y divide-[#1E1E2E]">
              {plan.missions.map((m) => (
                <Link
                  key={m.id}
                  href={`/autopilot/missions/${m.id}`}
                  className="px-4 py-3 flex items-center gap-3 hover:bg-[#1A1A28] transition-colors"
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: MISSION_COLORS[m.status] ?? "#5A5A6E" }}
                  />
                  <span className="text-xs text-[#8B8B9E] font-mono flex-1 truncate">
                    {m.id.slice(0, 16)}…
                  </span>
                  <span className="text-xs capitalize text-[#8B8B9E]">{m.status}</span>
                  {m.completedAt && (
                    <span className="text-[10px] text-[#555566]">
                      {new Date(m.completedAt).toLocaleDateString("zh-CN", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  )}
                  <ChevronRight className="w-3 h-3 text-[#555566] flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Pending approval panel */}
        {isPending && (
          <div className="bg-[#12121A] border border-yellow-500/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              <p className="text-sm font-semibold text-white">{t.planAwaitingApproval}</p>
            </div>

            {plan.planApproval && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                {plan.planApproval.estimatedCost !== null && (
                  <div className="bg-[#1A1A28] rounded-lg px-3 py-2">
                    <p className="text-[10px] text-[#555566]">{t.planEstCost}</p>
                    <p className="text-white">${plan.planApproval.estimatedCost?.toFixed(2)}</p>
                  </div>
                )}
                <div className="bg-[#1A1A28] rounded-lg px-3 py-2">
                  <p className="text-[10px] text-[#555566]">{t.planReversibility}</p>
                  <p className="text-white capitalize">{plan.planApproval.reversibility}</p>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}

            {showReject ? (
              <div className="space-y-2">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t.planRejectPlaceholder}
                  rows={3}
                  className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg px-3 py-2 text-xs text-white placeholder-[#555566] resize-none focus:outline-none focus:border-[#3A3A4A]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowReject(false); setNotes(""); setError(null); }}
                    className="flex-1 px-3 py-2 rounded-lg bg-[#1A1A28] text-xs text-[#8B8B9E] hover:text-white transition-colors"
                  >
                    {t.planCancel}
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={!!acting}
                    className="flex-1 px-3 py-2 rounded-lg bg-[#EF4444] text-xs text-white font-medium hover:bg-[#DC2626] disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    {acting === "reject"
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <XCircle className="w-3 h-3" />}
                    {t.planConfirmReject}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowReject(true)}
                  className="flex-1 px-3 py-2 rounded-lg bg-[#1A1A28] border border-[#2A2A3A] text-xs text-[#8B8B9E] hover:text-white hover:border-[#EF4444] transition-colors flex items-center justify-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  {t.planReject}
                </button>
                <button
                  onClick={handleApprove}
                  disabled={!!acting}
                  className="flex-1 px-3 py-2 rounded-lg bg-[#3B82F6] text-xs text-white font-medium hover:bg-[#2563EB] disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  {acting === "approve"
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {t.planApprove}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Decision record for terminal states */}
        {isTerminal && plan.planApproval?.decidedBy && (
          <div className="bg-[#12121A] border border-[#2A2A3A] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-3.5 h-3.5 text-[#8B8B9E]" />
              <p className="text-xs text-[#8B8B9E]">
                {t.planDecisionBy(plan.planApproval.decidedBy)}{" "}
                {plan.planApproval.decidedAt
                  ? new Date(plan.planApproval.decidedAt).toLocaleDateString(undefined, {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })
                  : "—"}{" "}
                <span className="capitalize">{plan.planApproval.decision}</span>
              </p>
            </div>
            {plan.planApproval.notes && (
              <p className="text-xs text-[#555566] italic">{plan.planApproval.notes}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
