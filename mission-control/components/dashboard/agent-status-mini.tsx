"use client";

import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import Link from "next/link";

export interface AgentRecord {
  id: string;
  name: string;
  emoji: string;
  status: string;
  currentTask: string | null;
}

interface AgentStatusMiniProps {
  agents?: AgentRecord[];
}

export function AgentStatusMini({ agents = [] }: AgentStatusMiniProps) {
  const t = useT();
  const activeCount = agents.filter((a) => a.status === "active").length;

  return (
    <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg">
      <div className="p-4 border-b border-[#2A2A3A] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{t.dashAgentStatusTitle}</h3>
        <span className="text-xs text-[#8B8B9E]">{t.dashAgentActiveCount(activeCount)}</span>
      </div>

      <div className="p-3 space-y-2">
        {agents.length === 0 ? (
          <div className="py-4 text-center text-sm text-[#5A5A6E]">{t.agentsNoData}</div>
        ) : (
          agents.map((agent) => (
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
                    {agent.status === "active" ? t.agentStatusActive : t.agentStatusIdle}
                  </span>
                </div>
                {agent.currentTask ? (
                  <div className="text-xs text-[#8B8B9E] truncate">{agent.currentTask}</div>
                ) : (
                  <div className="text-xs text-[#5A5A6E]">{t.dashAgentIdle}</div>
                )}
              </div>
              <div
                className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  agent.status === "active"
                    ? "bg-[#10B981] animate-pulse"
                    : "bg-[#5A5A6E]"
                )}
              />
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-[#2A2A3A]">
        <Link
          href="/agents"
          className="text-xs text-[#3B82F6] hover:text-blue-400 transition-colors w-full text-center block"
        >
          {t.dashManageAgents}
        </Link>
      </div>
    </div>
  );
}
