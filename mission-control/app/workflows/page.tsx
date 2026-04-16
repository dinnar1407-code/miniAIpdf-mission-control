"use client";

import { Header } from "@/components/layout/header";
import { useState } from "react";
import { Play, Plus, Clock, CheckCircle, XCircle, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

const WORKFLOWS = [
  {
    id: "1",
    name: "MiniAIPDF Daily Growth",
    description: "Publish SEO blog → share on Twitter → monitor engagement → report",
    triggerType: "scheduled",
    schedule: "Daily at 9am",
    status: "active",
    steps: ["Write blog post", "Publish to blog", "Tweet thread", "Monitor 2h", "Report metrics"],
    lastRun: "Today 9:01 AM",
    successRate: "94%",
    totalRuns: 47,
    project: "MiniAIPDF",
    projectColor: "#3B82F6",
  },
  {
    id: "2",
    name: "FurMates Cart Recovery",
    description: "Detect abandoned cart → send recovery email → follow up after 24h",
    triggerType: "event",
    schedule: "On: cart_abandoned",
    status: "active",
    steps: ["Detect event", "Wait 1h", "Send email 1", "Wait 24h", "Send email 2"],
    lastRun: "2h ago",
    successRate: "67%",
    totalRuns: 23,
    project: "FurMates",
    projectColor: "#10B981",
  },
  {
    id: "3",
    name: "NIW Document Tracker",
    description: "Monitor deadlines → notify Terry → draft reminder document",
    triggerType: "scheduled",
    schedule: "Weekly on Monday",
    status: "active",
    steps: ["Check deadlines", "Generate report", "Notify Terry", "Draft documents"],
    lastRun: "Monday 8:00 AM",
    successRate: "100%",
    totalRuns: 8,
    project: "NIW",
    projectColor: "#F59E0B",
  },
  {
    id: "4",
    name: "Weekly Cross-Project Report",
    description: "Aggregate metrics from all projects → generate executive summary → send to Terry",
    triggerType: "scheduled",
    schedule: "Fridays at 5pm",
    status: "draft",
    steps: ["Fetch MiniAIPDF metrics", "Fetch FurMates metrics", "Aggregate all data", "Generate summary", "Send report"],
    lastRun: "Never",
    successRate: "—",
    totalRuns: 0,
    project: "All",
    projectColor: "#8B5CF6",
  },
];

const statusConfig: Record<string, { color: string; bg: string; icon: JSX.Element }> = {
  active: { color: "#10B981", bg: "#10B98115", icon: <CheckCircle size={12} /> },
  draft: { color: "#8B8B9E", bg: "#2A2A3A", icon: <Pause size={12} /> },
  failed: { color: "#EF4444", bg: "#EF444415", icon: <XCircle size={12} /> },
};

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState(WORKFLOWS);
  const [runningId, setRunningId] = useState<string | null>(null);

  const handleRun = (id: string) => {
    setRunningId(id);
    setTimeout(() => setRunningId(null), 3000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header
        title="Workflows"
        subtitle="Automation engine"
        actions={
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6] hover:bg-blue-600 text-white text-xs rounded-md transition-colors">
            <Plus size={13} /> New Workflow
          </button>
        }
      />

      <div className="p-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-2">
          {[
            { label: "Active", count: workflows.filter(w => w.status === "active").length, color: "#10B981" },
            { label: "Total Runs", count: workflows.reduce((a, w) => a + w.totalRuns, 0), color: "#3B82F6" },
            { label: "Draft", count: workflows.filter(w => w.status === "draft").length, color: "#8B8B9E" },
          ].map((s) => (
            <div key={s.label} className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.count}</div>
              <div className="text-xs text-[#8B8B9E]">{s.label}</div>
            </div>
          ))}
        </div>

        {workflows.map((wf) => {
          const config = statusConfig[wf.status];
          const isRunning = runningId === wf.id;

          return (
            <div key={wf.id} className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-4 hover:border-[#3A3A4A] transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-white text-sm">{wf.name}</span>
                    <span
                      className={cn("text-xs px-1.5 py-0.5 rounded flex items-center gap-1")}
                      style={{ color: config.color, backgroundColor: config.bg }}
                    >
                      {config.icon} {wf.status}
                    </span>
                  </div>
                  <div className="text-xs text-[#8B8B9E] mb-3">{wf.description}</div>

                  {/* Steps */}
                  <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
                    {wf.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-1 flex-shrink-0">
                        <div className="bg-[#1A1A24] border border-[#2A2A3A] rounded px-2 py-1 text-xs text-[#8B8B9E] whitespace-nowrap">
                          {step}
                        </div>
                        {i < wf.steps.length - 1 && (
                          <div className="text-[#5A5A6E] text-xs">→</div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-[#5A5A6E]">
                    <span>
                      <Clock size={10} className="inline mr-1" />
                      {wf.schedule}
                    </span>
                    <span>Last run: {wf.lastRun}</span>
                    <span>Success: {wf.successRate}</span>
                    <span>{wf.totalRuns} runs</span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded ml-auto"
                      style={{
                        backgroundColor: `${wf.projectColor}20`,
                        color: wf.projectColor,
                      }}
                    >
                      {wf.project}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleRun(wf.id)}
                  disabled={isRunning}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all flex-shrink-0",
                    isRunning
                      ? "bg-[#10B98120] text-[#10B981] cursor-default"
                      : "bg-[#1A1A24] text-[#8B8B9E] hover:text-white hover:bg-[#2A2A3A]"
                  )}
                >
                  {isRunning ? (
                    <><span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" /> Running...</>
                  ) : (
                    <><Play size={12} /> Run</>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
