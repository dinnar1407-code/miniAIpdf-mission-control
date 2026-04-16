"use client";

import Link from "next/link";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";

const MOCK_ALERTS = [
  {
    id: "1",
    severity: "critical",
    message: "Product Hunt launch detected — agents on standby",
    project: "MiniAIPDF",
    time: "2m ago",
  },
  {
    id: "2",
    severity: "warning",
    message: "API error rate elevated (2.3%)",
    project: "MiniAIPDF",
    time: "1h ago",
  },
  {
    id: "3",
    severity: "info",
    message: "NIW deadline in 3 days — review required",
    project: "NIW",
    time: "3d",
  },
];

const severityConfig = {
  critical: {
    icon: AlertCircle,
    color: "#EF4444",
    bg: "#EF444415",
    border: "#EF444430",
  },
  warning: {
    icon: AlertTriangle,
    color: "#F59E0B",
    bg: "#F59E0B15",
    border: "#F59E0B30",
  },
  info: {
    icon: Info,
    color: "#3B82F6",
    bg: "#3B82F615",
    border: "#3B82F630",
  },
};

export function AlertsPreview() {
  return (
    <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg">
      <div className="p-4 border-b border-[#2A2A3A] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Alerts</h3>
        <span className="bg-[#EF444420] text-[#EF4444] text-xs px-1.5 py-0.5 rounded font-medium">
          {MOCK_ALERTS.filter((a) => a.severity === "critical").length} critical
        </span>
      </div>
      <div className="p-3 space-y-2">
        {MOCK_ALERTS.map((alert) => {
          const config = severityConfig[alert.severity as keyof typeof severityConfig];
          const Icon = config.icon;
          return (
            <div
              key={alert.id}
              className="flex items-start gap-3 p-2.5 rounded-lg border"
              style={{ backgroundColor: config.bg, borderColor: config.border }}
            >
              <Icon size={14} style={{ color: config.color }} className="mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white">{alert.message}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-[#5A5A6E]">{alert.project}</span>
                  <span className="text-xs text-[#5A5A6E]">·</span>
                  <span className="text-xs text-[#5A5A6E]">{alert.time}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="p-3 border-t border-[#2A2A3A]">
        <Link
          href="/alerts"
          className="text-xs text-[#3B82F6] hover:text-blue-400 transition-colors w-full text-center block"
        >
          View all alerts →
        </Link>
      </div>
    </div>
  );
}
