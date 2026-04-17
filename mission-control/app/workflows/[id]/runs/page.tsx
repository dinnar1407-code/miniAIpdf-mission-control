"use client";

import { Header } from "@/components/layout/header";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Play, CheckCircle, XCircle, Clock, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface RunRecord {
  id: string;
  workflowId: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
    running:   { icon: <Loader2 size={12} className="animate-spin" />, label: "Running",   cls: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
    completed: { icon: <CheckCircle size={12} />,                      label: "Completed", cls: "text-green-400 bg-green-400/10 border-green-400/20" },
    failed:    { icon: <XCircle size={12} />,                          label: "Failed",    cls: "text-red-400 bg-red-400/10 border-red-400/20" },
    pending:   { icon: <Clock size={12} />,                            label: "Pending",   cls: "text-[#8B8B9E] bg-[#8B8B9E]/10 border-[#8B8B9E]/20" },
  };
  const s = map[status] || map.pending;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium", s.cls)}>
      {s.icon}{s.label}
    </span>
  );
}

function formatDuration(start: string | null, end: string | null) {
  if (!start) return "—";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const ms = e - s;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatTime(t: string | null) {
  if (!t) return "—";
  return new Date(t).toLocaleString();
}

export default function RunsPage({ params }: { params: { id: string } }) {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [workflowName, setWorkflowName] = useState("Workflow");
  const [loading, setLoading] = useState(true);

  const fetchRuns = async () => {
    try {
      const [runsRes, wfRes] = await Promise.all([
        fetch(`/api/workflows/${params.id}/runs`),
        fetch(`/api/workflows/${params.id}`),
      ]);
      if (runsRes.ok) setRuns(await runsRes.json());
      if (wfRes.ok) {
        const wf = await wfRes.json();
        setWorkflowName(wf.name || "Workflow");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
    // Poll every 3s if there are running runs
    const interval = setInterval(() => {
      setRuns(prev => {
        if (prev.some(r => r.status === "running")) fetchRuns();
        return prev;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [params.id]);

  const handleRun = async () => {
    const res = await fetch(`/api/workflows/${params.id}/run`, { method: "POST" });
    if (res.ok) {
      await fetchRuns();
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header
        title="Run History"
        subtitle={
          <span className="flex items-center gap-1 text-sm text-[#8B8B9E]">
            <Link href="/workflows" className="hover:text-white transition-colors">Workflows</Link>
            <ChevronRight size={13} />
            <Link href={`/workflows/${params.id}`} className="hover:text-white transition-colors">{workflowName}</Link>
            <ChevronRight size={13} />
            <span>Runs</span>
          </span>
        }
      />

      <div className="p-6 max-w-5xl mx-auto space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#8B8B9E] text-sm">{runs.length} run{runs.length !== 1 ? "s" : ""} total</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchRuns}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#2A2A3A] bg-[#12121A] text-[#8B8B9E] hover:text-white text-sm transition-colors"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              onClick={handleRun}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
              <Play size={14} /> Run Now
            </button>
          </div>
        </div>

        {/* Runs table */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#5A5A6E] text-sm">
            <Loader2 size={16} className="animate-spin mr-2" /> Loading runs…
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-[#2A2A3A] rounded-xl">
            <Play size={32} className="mx-auto mb-3 text-[#5A5A6E]" />
            <p className="text-[#8B8B9E]">No runs yet</p>
            <p className="text-[#5A5A6E] text-sm mt-1">Click "Run Now" to trigger this workflow</p>
          </div>
        ) : (
          <div className="border border-[#2A2A3A] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2A2A3A] bg-[#12121A]">
                  <th className="text-left px-4 py-3 text-[#8B8B9E] font-medium">Run ID</th>
                  <th className="text-left px-4 py-3 text-[#8B8B9E] font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-[#8B8B9E] font-medium">Progress</th>
                  <th className="text-left px-4 py-3 text-[#8B8B9E] font-medium">Started</th>
                  <th className="text-left px-4 py-3 text-[#8B8B9E] font-medium">Duration</th>
                  <th className="text-left px-4 py-3 text-[#8B8B9E] font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run, i) => (
                  <tr key={run.id} className={cn("border-b border-[#2A2A3A] hover:bg-[#12121A] transition-colors", i === runs.length - 1 && "border-b-0")}>
                    <td className="px-4 py-3 text-[#E0E0F0] font-mono text-xs">{run.id.slice(0, 12)}…</td>
                    <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-[#2A2A3A] rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", run.status === "completed" ? "bg-green-500" : run.status === "failed" ? "bg-red-500" : "bg-blue-500")}
                            style={{ width: run.totalSteps > 0 ? `${(run.currentStep / run.totalSteps) * 100}%` : "0%" }}
                          />
                        </div>
                        <span className="text-[#8B8B9E] text-xs">{run.currentStep}/{run.totalSteps}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#8B8B9E] text-xs">{formatTime(run.startedAt || run.createdAt)}</td>
                    <td className="px-4 py-3 text-[#8B8B9E] text-xs">{formatDuration(run.startedAt || run.createdAt, run.completedAt)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/workflows/${params.id}/runs/${run.id}`}
                        className="text-blue-400 hover:text-blue-300 text-xs transition-colors"
                      >
                        View logs →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
