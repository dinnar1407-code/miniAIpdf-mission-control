"use client";

import { useT } from "@/lib/i18n";
import { formatRelativeTime } from "@/lib/utils";

export interface ActivityItem {
  id: string;
  agentName: string;
  agentEmoji: string;
  action: string;
  target?: string;
  result?: string;
  projectName: string;
  projectColor: string;
  timestamp: Date | string;
}

interface ActivityFeedProps {
  items?: ActivityItem[];
}

export function ActivityFeed({ items = [] }: ActivityFeedProps) {
  const t = useT();

  return (
    <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg">
      <div className="p-4 border-b border-[#2A2A3A] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{t.dashCrossProjectActivity}</h3>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
          <span className="text-xs text-[#8B8B9E]">{t.dashLive}</span>
        </div>
      </div>

      <div className="divide-y divide-[#2A2A3A]">
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[#5A5A6E]">
            {t.dashNoActivityData}
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="px-4 py-3 hover:bg-[#1A1A24] transition-colors cursor-default"
            >
              <div className="flex items-start gap-3">
                <div className="text-base mt-0.5 leading-none">{item.agentEmoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-xs font-medium px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${item.projectColor}20`,
                        color: item.projectColor,
                      }}
                    >
                      {item.projectName}
                    </span>
                    <span className="text-xs text-[#8B8B9E]">
                      <span className="text-white font-medium">{item.agentName}</span>{" "}
                      {item.action}
                      {item.target && (
                        <>{" "}<span className="text-white">{item.target}</span></>
                      )}
                    </span>
                  </div>
                  {item.result && (
                    <div className="text-xs text-[#5A5A6E] mt-0.5">{item.result}</div>
                  )}
                </div>
                <div className="text-xs text-[#5A5A6E] flex-shrink-0">
                  {formatRelativeTime(
                    typeof item.timestamp === "string"
                      ? new Date(item.timestamp)
                      : item.timestamp
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-[#2A2A3A]">
        <button className="text-xs text-[#3B82F6] hover:text-blue-400 transition-colors w-full text-center">
          {t.dashViewAllActivity}
        </button>
      </div>
    </div>
  );
}
