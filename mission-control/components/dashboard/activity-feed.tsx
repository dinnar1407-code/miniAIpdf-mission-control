"use client";

import { formatRelativeTime } from "@/lib/utils";

interface ActivityItem {
  id: string;
  agentName: string;
  agentEmoji: string;
  action: string;
  target: string;
  result?: string;
  projectName: string;
  projectColor: string;
  timestamp: Date;
}

const MOCK_ACTIVITY: ActivityItem[] = [
  {
    id: "1",
    agentName: "PM01",
    agentEmoji: "📝",
    action: "published",
    target: "Twitter thread",
    result: "12 retweets, 45 likes",
    projectName: "MiniAIPDF",
    projectColor: "#3B82F6",
    timestamp: new Date(Date.now() - 2 * 60 * 1000),
  },
  {
    id: "2",
    agentName: "Playfish",
    agentEmoji: "🌾",
    action: "replied to",
    target: "customer email",
    result: "Upgrade offer sent",
    projectName: "FurMates",
    projectColor: "#10B981",
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
  },
  {
    id: "3",
    agentName: "Admin01",
    agentEmoji: "🔧",
    action: "sent reminder to",
    target: "Terry",
    result: "NIW deadline approaching",
    projectName: "NIW",
    projectColor: "#F59E0B",
    timestamp: new Date(Date.now() - 60 * 60 * 1000),
  },
  {
    id: "4",
    agentName: "DFM",
    agentEmoji: "📊",
    action: "updated",
    target: "SDK docs v2.1.0",
    result: "Release notes published",
    projectName: "wheatcoin",
    projectColor: "#F97316",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: "5",
    agentName: "Playfish",
    agentEmoji: "🌾",
    action: "drafted",
    target: "CFO report",
    result: "Q1 summary ready",
    projectName: "Dinnar",
    projectColor: "#EF4444",
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
  },
];

export function ActivityFeed() {
  return (
    <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg">
      <div className="p-4 border-b border-[#2A2A3A] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Cross-Project Activity</h3>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
          <span className="text-xs text-[#8B8B9E]">Live</span>
        </div>
      </div>
      <div className="divide-y divide-[#2A2A3A]">
        {MOCK_ACTIVITY.map((item) => (
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
                    {item.action}{" "}
                    <span className="text-white">{item.target}</span>
                  </span>
                </div>
                {item.result && (
                  <div className="text-xs text-[#5A5A6E] mt-0.5">{item.result}</div>
                )}
              </div>
              <div className="text-xs text-[#5A5A6E] flex-shrink-0">
                {formatRelativeTime(item.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-[#2A2A3A]">
        <button className="text-xs text-[#3B82F6] hover:text-blue-400 transition-colors w-full text-center">
          View all activity →
        </button>
      </div>
    </div>
  );
}
