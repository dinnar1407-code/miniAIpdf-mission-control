"use client";

import { Header } from "@/components/layout/header";
import { useState } from "react";
import { Play, Pause, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const AGENTS = [
  {
    id: "playfish",
    name: "Playfish",
    emoji: "🌾",
    type: "CEO Agent",
    status: "active",
    currentTask: "Reviewing MiniAIPDF growth metrics and preparing weekly report",
    projects: ["MiniAIPDF", "FurMates", "NIW", "Dinnar"],
    tasksCompleted: 247,
    contentPublished: 89,
    hoursThisWeek: 42,
    lastActive: "2 minutes ago",
    recentActivity: [
      { action: "Drafted CFO report for Dinnar", time: "3h ago" },
      { action: "Reviewed NIW petition draft", time: "5h ago" },
      { action: "Replied to 3 FurMates customer emails", time: "8h ago" },
    ],
  },
  {
    id: "pm01",
    name: "PM01",
    emoji: "📝",
    type: "Content Agent",
    status: "active",
    currentTask: "Publishing Twitter thread for MiniAIPDF launch",
    projects: ["MiniAIPDF", "FurMates"],
    tasksCompleted: 183,
    contentPublished: 312,
    hoursThisWeek: 38,
    lastActive: "Just now",
    recentActivity: [
      { action: "Published Twitter thread (12 retweets)", time: "2m ago" },
      { action: "Scheduled LinkedIn post", time: "2h ago" },
      { action: "Drafted 3 blog post outlines", time: "6h ago" },
    ],
  },
  {
    id: "pm01b",
    name: "PM01-B",
    emoji: "📝",
    type: "Content Agent B",
    status: "idle",
    currentTask: null,
    projects: ["MiniAIPDF"],
    tasksCompleted: 67,
    contentPublished: 145,
    hoursThisWeek: 12,
    lastActive: "4 hours ago",
    recentActivity: [
      { action: "Completed YouTube description batch", time: "4h ago" },
      { action: "Reviewed content calendar", time: "6h ago" },
    ],
  },
  {
    id: "admin01",
    name: "Admin01",
    emoji: "🔧",
    type: "Operations Agent",
    status: "active",
    currentTask: "Processing NIW document reminders and tracking deadlines",
    projects: ["MiniAIPDF", "Talengineer", "wheatcoin"],
    tasksCompleted: 156,
    contentPublished: 12,
    hoursThisWeek: 31,
    lastActive: "15 minutes ago",
    recentActivity: [
      { action: "Sent NIW deadline reminder to Terry", time: "1h ago" },
      { action: "Updated Talengineer bug tracker", time: "3h ago" },
      { action: "Processed wheatcoin support tickets", time: "5h ago" },
    ],
  },
  {
    id: "dfm",
    name: "DFM",
    emoji: "📊",
    type: "Data & Finance Agent",
    status: "idle",
    currentTask: null,
    projects: ["wheatcoin", "MiniAIPDF"],
    tasksCompleted: 94,
    contentPublished: 8,
    hoursThisWeek: 19,
    lastActive: "2 hours ago",
    recentActivity: [
      { action: "Updated wheatcoin SDK docs v2.1.0", time: "2h ago" },
      { action: "Compiled MiniAIPDF analytics report", time: "1d ago" },
    ],
  },
];

export default function AgentsPage() {
  const [agents, setAgents] = useState(AGENTS);
  const [selectedAgent, setSelectedAgent] = useState<typeof AGENTS[0] | null>(null);

  const toggleStatus = (agentId: string) => {
    setAgents(agents.map((a) =>
      a.id === agentId
        ? { ...a, status: a.status === "active" ? "idle" : "active" }
        : a
    ));
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header title="Agents" subtitle="Universal agent management" />

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent Cards */}
          <div className="lg:col-span-2 space-y-4">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className={cn(
                  "bg-[#12121A] border rounded-lg p-4 cursor-pointer transition-all duration-200",
                  selectedAgent?.id === agent.id
                    ? "border-[#3B82F6]"
                    : "border-[#2A2A3A] hover:border-[#3A3A4A]"
                )}
                onClick={() => setSelectedAgent(agent)}
              >
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 bg-[#1A1A24] rounded-xl flex items-center justify-center text-2xl">
                      {agent.emoji}
                    </div>
                    <div
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#12121A]",
                        agent.status === "active"
                          ? "bg-[#10B981] animate-pulse"
                          : "bg-[#5A5A6E]"
                      )}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{agent.name}</span>
                          <span
                            className={cn(
                              "text-xs px-1.5 py-0.5 rounded",
                              agent.status === "active"
                                ? "bg-[#10B98115] text-[#10B981]"
                                : "bg-[#2A2A3A] text-[#5A5A6E]"
                            )}
                          >
                            {agent.status}
                          </span>
                        </div>
                        <div className="text-xs text-[#8B8B9E]">{agent.type}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleStatus(agent.id); }}
                          className="p-1.5 rounded-md bg-[#1A1A24] hover:bg-[#2A2A3A] text-[#8B8B9E] hover:text-white transition-colors"
                          title={agent.status === "active" ? "Pause" : "Resume"}
                        >
                          {agent.status === "active"
                            ? <Pause size={13} />
                            : <Play size={13} />
                          }
                        </button>
                      </div>
                    </div>

                    {agent.currentTask ? (
                      <div className="mt-2 text-xs text-[#8B8B9E] bg-[#1A1A24] rounded-md px-3 py-2">
                        <span className="text-[#5A5A6E]">Current: </span>
                        {agent.currentTask}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-[#5A5A6E] bg-[#1A1A24] rounded-md px-3 py-2">
                        Idle — waiting for tasks
                      </div>
                    )}

                    <div className="mt-3 flex items-center gap-4 text-xs text-[#5A5A6E]">
                      <span>✅ {agent.tasksCompleted} tasks</span>
                      <span>📄 {agent.contentPublished} content</span>
                      <span>⏱ {agent.hoursThisWeek}h/wk</span>
                      <span className="ml-auto">{agent.lastActive}</span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {agent.projects.map((p) => (
                        <span key={p} className="text-xs bg-[#1A1A24] text-[#8B8B9E] px-2 py-0.5 rounded">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Agent Detail Panel */}
          <div>
            {selectedAgent ? (
              <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-4 sticky top-20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-3xl">{selectedAgent.emoji}</div>
                  <div>
                    <div className="font-semibold text-white">{selectedAgent.name}</div>
                    <div className="text-xs text-[#8B8B9E]">{selectedAgent.type}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-[#5A5A6E] mb-2 font-medium uppercase tracking-wider">Recent Activity</div>
                    <div className="space-y-2">
                      {selectedAgent.recentActivity.map((item, i) => (
                        <div key={i} className="flex gap-2 text-xs">
                          <span className="text-[#5A5A6E] flex-shrink-0">{item.time}</span>
                          <span className="text-[#8B8B9E]">{item.action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-8 flex items-center justify-center text-center">
                <div>
                  <div className="text-3xl mb-2">🤖</div>
                  <div className="text-sm text-[#8B8B9E]">Select an agent to view details</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
