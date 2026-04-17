"use client";

import { Header } from "@/components/layout/header";
import { useEffect, useState } from "react";
import { Play, Plus, Edit2, ChevronRight, Loader2, Clock, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface WorkflowRun {
  id: string;
  status: string;
  createdAt: string;
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  triggerType: string;
  triggerConfig: string;
  status: string;
  steps: string;
  createdAt: string;
  updatedAt: string;
  runs: WorkflowRun[];
}

const triggerIcons: Record<string, string> = {
  manual: "🖱", schedule: "⏰", webhook: "🌐", event: "⚡",
};

const statusConfig: Record<string, { color: string; bg: string }> = {
  active:   { color: "#10B981", bg: "#10B98115" },
  draft:    { color: "#8B8B9E", bg: "#2A2A3A" },
  paused:   { color: "#F59E0B", bg: "#F59E0B15" },
  archived: { color: "#EF4444", bg: "#EF444415" },
};

function RunStatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle size={12} className="text-green-400" />;
  if (status === "failed")    return <XCircle size={12} className="text-red-400" />;
  if (status === "running")   return <Loader2 size={12} className="text-blue-400 animate-spin" />;
  return <Clock size={12} className="text-[#5A5A6E]" />;
}

export default function WorkflowsPage() {
  const router = useRouter();
  const [workflows, setWorkflows]       = useState<Workflow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [runningId, setRunningId]       = useState<string | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/workflows")
      .then(r => r.ok ? r.json() : [])
      .then(data => { setWorkflows(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleRun = async (wf: Workflow) => {
    setRunningId(wf.id);
    try {
      const res = await fetch(`/api/workflows/${wf.id}/run`, { method: "POST" });
      if (res.ok) {
        const run = await res.json();
        router.push(`/workflows/${wf.id}/runs/${run.id}`);
      }
    } catch {}
    finally { setRunningId(null); }
  };

  const handleCreate = async () => {
    const res = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Workflow", status: "draft", triggerType: "manual" }),
    });
    if (res.ok) {
      const wf = await res.json();
      router.push(`/workflows/${wf.id}`);
    } else {
      router.push("/workflows/new");
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/workflows/${id}`, { method: "DELETE" });
      if (res.ok) {
        setWorkflows(prev => prev.filter(w => w.id !== id));
      }
    } catch {}
    finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  const stepCount = (wf: Workflow) => {
    try { return (JSON.parse(wf.steps) as unknown[]).length; } catch { return 0; }
  };

  const lastRun = (wf: Workflow) => {
    if (!wf.runs?.length) return "Never";
    return new Date(wf.runs[0].createdAt).toLocaleDateString();
  };

  const successRate = (wf: Workflow) => {
    if (!wf.runs?.length) return "—";
    const done = wf.runs.filter(r => r.status === "completed").length;
    return `${Math.round((done / wf.runs.length) * 100)}%`;
  };

  const activeCount = workflows.filter(w => w.status === "active").length;
  const draftCount  = workflows.filter(w => w.status === "draft").length;
  const totalRuns   = workflows.reduce((a, w) => a + (w.runs?.length || 0), 0);

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header title="Workflows" subtitle="Automation engine · J.A.R.V.I.S. protocols" />

      <div className="p-4 md:p-6 space-y-4">

        {/* Stats grid — 2×2 on mobile, 4×1 on desktop */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          {[
            { label: "Active",     count: activeCount,      color: "#10B981" },
            { label: "Draft",      count: draftCount,       color: "#8B8B9E" },
            { label: "Total Runs", count: totalRuns,        color: "#3B82F6" },
            { label: "Workflows",  count: workflows.length, color: "#8B5CF6" },
          ].map(s => (
            <div key={s.label} className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-3 text-center">
              <div className="text-xl font-bold" style={{ color: s.color }}>{s.count}</div>
              <div className="text-xs text-[#8B8B9E] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* New Workflow button — full width on mobile */}
        <button
          onClick={handleCreate}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#3B82F6] hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus size={16} /> New Workflow
        </button>

        {/* Workflow list */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#5A5A6E]">
            <Loader2 size={18} className="animate-spin mr-2" /> Loading workflows…
          </div>
        ) : workflows.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-[#2A2A3A] rounded-xl">
            <p className="text-[#8B8B9E] mb-3">No workflows yet</p>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-[#3B82F6] hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
            >
              Create your first workflow
            </button>
          </div>
        ) : (
          workflows.map((wf) => {
            const cfg           = statusConfig[wf.status] || statusConfig.draft;
            const isRunning     = runningId === wf.id;
            const isDeleting    = deletingId === wf.id;
            const isConfirming  = confirmDelete === wf.id;
            const lastRunStatus = wf.runs?.[0]?.status;

            return (
              <div key={wf.id} className="bg-[#12121A] border border-[#2A2A3A] rounded-xl p-4 hover:border-[#3A3A4A] transition-colors">
                {/* Top row: name + status + trigger */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="font-semibold text-white text-sm truncate max-w-[180px] sm:max-w-none">{wf.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: cfg.color, backgroundColor: cfg.bg }}>
                      {wf.status}
                    </span>
                    <span className="text-xs text-[#5A5A6E] flex-shrink-0">
                      {triggerIcons[wf.triggerType] || "🖱"} {wf.triggerType}
                    </span>
                  </div>
                </div>

                {/* Description — clamped to 2 lines */}
                {wf.description && (
                  <div className="text-xs text-[#8B8B9E] mb-2 leading-relaxed line-clamp-2">{wf.description}</div>
                )}

                {/* Stats row */}
                <div className="flex items-center gap-3 text-xs text-[#5A5A6E] flex-wrap mb-3">
                  <span>⚡ {stepCount(wf)} steps</span>
                  <span className="flex items-center gap-1">
                    {lastRunStatus && <RunStatusIcon status={lastRunStatus} />}
                    {lastRun(wf)}
                  </span>
                  <span>✅ {successRate(wf)}</span>
                  <span>🔄 {wf.runs?.length || 0} runs</span>
                </div>

                {/* Action buttons */}
                {isConfirming ? (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <span className="text-xs text-red-400 flex-1">Delete &ldquo;{wf.name}&rdquo;?</span>
                    <button
                      onClick={() => handleDelete(wf.id)}
                      disabled={isDeleting}
                      className="text-xs px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors flex items-center gap-1"
                    >
                      {isDeleting ? <Loader2 size={10} className="animate-spin" /> : null}
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="text-xs px-2.5 py-1 bg-[#2A2A3A] hover:bg-[#3A3A4A] text-[#8B8B9E] rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/workflows/${wf.id}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-[#8B8B9E] hover:text-white hover:bg-[#1A1A24] transition-colors"
                    >
                      <Edit2 size={12} /> Edit
                    </Link>
                    <Link
                      href={`/workflows/${wf.id}/runs`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-[#8B8B9E] hover:text-white hover:bg-[#1A1A24] transition-colors"
                    >
                      Runs <ChevronRight size={12} />
                    </Link>
                    <button
                      onClick={() => handleRun(wf)}
                      disabled={isRunning}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                        isRunning
                          ? "bg-blue-500/10 text-blue-400 cursor-default"
                          : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                      )}
                    >
                      {isRunning
                        ? <><Loader2 size={11} className="animate-spin" /> Running…</>
                        : <><Play size={11} /> Run</>}
                    </button>
                    {/* Delete — push to right */}
                    <button
                      onClick={() => setConfirmDelete(wf.id)}
                      className="ml-auto flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-[#5A5A6E] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete workflow"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
