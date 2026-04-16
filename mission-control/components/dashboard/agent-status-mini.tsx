"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";

const AGENTS = [
  { id: "playfish", name: "Playfish", emoji: "🌾", status: "active", currentTask: "Reviewing growth metrics" },
  { id: "pm01", name: "PM01", emoji: "📝", status: "active", currentTask: "Publishing Twitter thread" },
  { id: "pm01b", name: "PM01-B", emoji: "📝", status: "idle", currentTask: null },
  { id: "admin01", name: "Admin01", emoji: "🔧", status: "active", currentTask: "Processing NIW reminders" },
  { id: "dfm", name: "DFM", emoji: "📊", status: "idle", currentTask: null },
];

export function AgentStatusMini() {
  return (
    <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg">
      <div className="p-4 border-b border-[#2A2A3A] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Agent Status</h3>
        <span className="text-xs text-[#8B8B9E]">
          {AGENTS.filter((a) => a.status === "active").length} active
        </span>
      </div>
      <div className="p-3 space-y-2">
        {AGENTS.map((agent) => (
          <div
            key={agent.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#1A1A24] transition-colors"
          >
            <div className="text-lg leading-none">{agent.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{agent.name}</span>
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
              {agent.currentTask ? (
                <div className="text-xs text-[#8B8B9E] truncate">{agent.currentTask}</div>
              ) : (
                <div className="text-xs text-[#5A5A6E]">Idle</div>
              )}
            </div>
            <div
              className={cn(
                "w-2 h-2 rounded-full flex-shrink-0",
                agent.status === "active" ? "bg-[#10B981] animate-pulse" : "bg-[#5A5A6E]"
              )}
            />
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-[#2A2A3A]">
        <Link
          href="/agents"
          className="text-xs text-[#3B82F6] hover:text-blue-400 transition-colors w-full text-center block"
        >
          Manage agents →
        </Link>
      </div>
    </div>
  );
}
