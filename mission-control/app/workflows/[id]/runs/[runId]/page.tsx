"use client";

import { Header } from "@/components/layout/header";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, CheckCircle, XCircle, Clock, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: string;
  runId: string;
  stepIndex: number;
  stepType: string;
  message: string;
  level: string;
  createdAt: string;
}

interface StepResult {
  stepIndex: number;
  stepId?: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: string;
  completedAt?: string;
  output?: string;
  error?: string;
}

interface RunDetail {
  id: string;
  workflowId: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  stepResults: string;
  logs: LogEntry[];
  createdAt: string;
}

function levelStyle(level: string) {
  switch (level) {
    case "success": return "text-green-400";
    case "error":   return "text-red-400";
    case "warn":    return "text-yellow-400";
    default:        return "text-[#C0C0D0]";
  }
}

function StepIcon({ status }: { status: string }) {
  switch (status) {
    case "completed": return <CheckCircle size={14} className="text-green-400 flex-shrink-0" />;
    case "failed":    return <XCircle size={14} className="text-red-400 flex-shrink-0" />;
    case "running":   return <Loader2 size={14} className="text-blue-400 animate-spin flex-shrink-0" />;
    default:          return <Circle size={14} className="text-[#5A5A6E] flex-shrink-0" />;
  }
}

function formatDuration(start: string | null, end: string | null) {
  if (!start) return null;
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const ms = e - s;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export default function RunDetailPage({ params }: { params: { id: string; runId: string } }) {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [workflowName, setWorkflowName] = useState("Workflow");
  const logBottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const fetchRun = async () => {
    const res = await fetch(`/api/workflows/${params.id}/runs/${params.runId}`);
    if (res.ok) setRun(await res.json());
  };

  useEffect(() => {
    fetch(`/api/workflows/${params.id}`).then(r => r.ok ? r.json() : null).then(d => {
      if (d) setWorkflowName(d.name || "Workflow");
    });
  }, [params.id]);

  useEffect(() => {
    fetchRun();
  }, [params.runId]);

  // Poll while running
  useEffect(() => {
    if (!run || run.status !== "running") return;
    const interval = setInterval(fetchRun, 1500);
    return () => clearInterval(interval);
  }, [run?.status]);

  // Auto-scroll logs
  useEffect(() => {
    if (autoScroll && logBottomRef.current) {
      logBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [run?.logs?.length, autoScroll]);

  const stepResults: StepResult[] = (() => {
    try {
      return run ? JSON.parse(run.stepResults) : [];
    } catch { return []; }
  })();

  const overallStatus = run?.status || "pending";
  const statusColor = {
    running:   "text-blue-400",
    completed: "text-green-400",
    failed:    "text-red-400",
    pending:   "text-[#8B8B9E]",
  }[overallStatus] || "text-[#8B8B9E]";

  if (!run) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <Loader2 size={20} className="text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header
        title="Run Detail"
        subtitle={
          <span className="flex items-center gap-1 text-sm text-[#8B8B9E]">
            <Link href="/workflows" className="hover:text-white transition-colors">Workflows</Link>
            <ChevronRight size={13} />
            <Link href={`/workflows/${params.id}`} className="hover:text-white transition-colors">{workflowName}</Link>
            <ChevronRight size={13} />
            <Link href={`/workflows/${params.id}/runs`} className="hover:text-white transition-colors">Runs</Link>
            <ChevronRight size={13} />
            <span className="font-mono text-xs">{params.runId.slice(0, 8)}…</span>
          </span>
        }
      />

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Run summary card */}
        <div className="border border-[#2A2A3A] rounded-xl bg-[#12121A] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {overallStatus === "running" && <Loader2 size={16} className="text-blue-400 animate-spin" />}
                {overallStatus === "completed" && <CheckCircle size={16} className="text-green-400" />}
                {overallStatus === "failed" && <XCircle size={16} className="text-red-400" />}
                {overallStatus === "pending" && <Clock size={16} className="text-[#8B8B9E]" />}
                <span className={cn("text-lg font-semibold capitalize", statusColor)}>{overallStatus}</span>
              </div>
              <p className="text-[#8B8B9E] text-sm font-mono">{run.id}</p>
            </div>
            <div className="text-right text-sm text-[#8B8B9E] space-y-1">
              <div>Started: {run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}</div>
              <div>Duration: {formatDuration(run.startedAt || run.createdAt, run.completedAt)}</div>
              <div>Steps: {run.currentStep} / {run.totalSteps}</div>
            </div>
          </div>

          {run.error && (
            <div className="mt-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {run.error}
            </div>
          )}

          {/* Step progress bar */}
          <div className="mt-5">
            <div className="flex gap-1.5">
              {stepResults.map((step, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-all duration-500",
                    step.status === "completed" ? "bg-green-500" :
                    step.status === "running"   ? "bg-blue-400 animate-pulse" :
                    step.status === "failed"    ? "bg-red-500" :
                    "bg-[#2A2A3A]"
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Step tracker */}
          <div className="lg:col-span-2 space-y-2">
            <h3 className="text-[#E0E0F0] font-medium text-sm mb-3">Steps</h3>
            {stepResults.length === 0 && (
              <p className="text-[#5A5A6E] text-sm">No steps recorded</p>
            )}
            {stepResults.map((step, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                  step.status === "running"   ? "border-blue-500/30 bg-blue-500/5" :
                  step.status === "completed" ? "border-green-500/20 bg-green-500/5" :
                  step.status === "failed"    ? "border-red-500/20 bg-red-500/5" :
                  "border-[#2A2A3A] bg-[#12121A]"
                )}
              >
                <StepIcon status={step.status} />
                <div className="min-w-0">
                  <div className="text-[#E0E0F0] text-xs font-medium">Step {i + 1}</div>
                  {step.output && <div className="text-[#8B8B9E] text-xs mt-0.5 truncate">{step.output}</div>}
                  {step.error  && <div className="text-red-400 text-xs mt-0.5 truncate">{step.error}</div>}
                  {(step.startedAt || step.completedAt) && (
                    <div className="text-[#5A5A6E] text-xs mt-0.5">
                      {formatDuration(step.startedAt || null, step.completedAt || null)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Log viewer */}
          <div className="lg:col-span-3 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[#E0E0F0] font-medium text-sm">Execution Logs</h3>
              <label className="flex items-center gap-2 text-xs text-[#8B8B9E] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={e => setAutoScroll(e.target.checked)}
                  className="w-3 h-3"
                />
                Auto-scroll
              </label>
            </div>
            <div className="bg-[#08080E] border border-[#2A2A3A] rounded-xl p-4 h-96 overflow-y-auto font-mono text-xs space-y-1">
              {run.logs.length === 0 && (
                <span className="text-[#5A5A6E]">No logs yet…</span>
              )}
              {run.logs.map((log) => (
                <div key={log.id} className="flex gap-2">
                  <span className="text-[#3A3A4E] flex-shrink-0 select-none">
                    {new Date(log.createdAt).toLocaleTimeString("en-US", { hour12: false })}
                  </span>
                  <span className={cn("flex-shrink-0 w-14 text-right", {
                    "text-[#5A5A6E]": log.stepIndex < 0,
                    "text-[#8B8B9E]": log.stepIndex >= 0,
                  })}>
                    {log.stepIndex >= 0 ? `step ${log.stepIndex + 1}` : "system"}
                  </span>
                  <span className={levelStyle(log.level)}>{log.message}</span>
                </div>
              ))}
              {overallStatus === "running" && (
                <div className="flex gap-2 mt-1">
                  <span className="text-[#3A3A4E] select-none">
                    {new Date().toLocaleTimeString("en-US", { hour12: false })}
                  </span>
                  <span className="text-blue-400 animate-pulse">▋</span>
                </div>
              )}
              <div ref={logBottomRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
