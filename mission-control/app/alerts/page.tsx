"use client";

import { Header } from "@/components/layout/header";
import { useState } from "react";
import { AlertCircle, AlertTriangle, Info, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const INITIAL_ALERTS = [
  {
    id: "1",
    severity: "critical",
    source: "platform",
    message: "Product Hunt launch detected — agents deployed and monitoring comments",
    project: "MiniAIPDF",
    projectColor: "#3B82F6",
    status: "new",
    time: "2m ago",
  },
  {
    id: "2",
    severity: "warning",
    source: "system",
    message: "API error rate elevated to 2.3% — investigating root cause",
    project: "MiniAIPDF",
    projectColor: "#3B82F6",
    status: "acknowledged",
    time: "1h ago",
  },
  {
    id: "3",
    severity: "warning",
    source: "platform",
    message: "3 abandoned carts in last hour — Shopify recovery emails queued",
    project: "FurMates",
    projectColor: "#10B981",
    status: "new",
    time: "45m ago",
  },
  {
    id: "4",
    severity: "info",
    source: "agent",
    message: "NIW petition deadline in 3 days — document review required from Terry",
    project: "NIW",
    projectColor: "#F59E0B",
    status: "new",
    time: "3d",
  },
  {
    id: "5",
    severity: "info",
    source: "agent",
    message: "wheatcoin SDK v2.1.0 docs published and community notified",
    project: "wheatcoin",
    projectColor: "#F97316",
    status: "resolved",
    time: "2h ago",
  },
  {
    id: "6",
    severity: "critical",
    source: "system",
    message: "Mobile checkout bug causing cart abandonment — requires developer attention",
    project: "FurMates",
    projectColor: "#10B981",
    status: "new",
    time: "3h ago",
  },
];

const severityConfig = {
  critical: { icon: AlertCircle, color: "#EF4444", bg: "#EF444408", border: "#EF444430", label: "Critical" },
  warning: { icon: AlertTriangle, color: "#F59E0B", bg: "#F59E0B08", border: "#F59E0B30", label: "Warning" },
  info: { icon: Info, color: "#3B82F6", bg: "#3B82F608", border: "#3B82F630", label: "Info" },
};

const statusStyles: Record<string, string> = {
  new: "text-[#EF4444] bg-[#EF444415]",
  acknowledged: "text-[#F59E0B] bg-[#F59E0B15]",
  resolved: "text-[#10B981] bg-[#10B98115]",
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState(INITIAL_ALERTS);
  const [filter, setFilter] = useState("all");

  const acknowledge = (id: string) => {
    setAlerts(alerts.map((a) => a.id === id ? { ...a, status: "acknowledged" } : a));
  };

  const resolve = (id: string) => {
    setAlerts(alerts.map((a) => a.id === id ? { ...a, status: "resolved" } : a));
  };

  const filtered = filter === "all" ? alerts : alerts.filter((a) => a.status === filter);
  const criticalCount = alerts.filter((a) => a.severity === "critical" && a.status === "new").length;

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header title="Alerts" subtitle={`${criticalCount} critical · ${alerts.filter(a => a.status === 'new').length} new`} />

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Critical", count: alerts.filter(a => a.severity === "critical" && a.status !== "resolved").length, color: "#EF4444" },
            { label: "Warning", count: alerts.filter(a => a.severity === "warning" && a.status !== "resolved").length, color: "#F59E0B" },
            { label: "Resolved", count: alerts.filter(a => a.status === "resolved").length, color: "#10B981" },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.count}</div>
              <div className="text-xs text-[#8B8B9E] mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4">
          {["all", "new", "acknowledged", "resolved"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors",
                filter === f
                  ? "bg-[#3B82F6] text-white"
                  : "bg-[#12121A] border border-[#2A2A3A] text-[#8B8B9E] hover:text-white"
              )}
            >
              {f} {f === "all" ? `(${alerts.length})` : `(${alerts.filter(a => a.status === f).length})`}
            </button>
          ))}
        </div>

        {/* Alert List */}
        <div className="space-y-3">
          {filtered.map((alert) => {
            const config = severityConfig[alert.severity as keyof typeof severityConfig];
            const Icon = config.icon;

            return (
              <div
                key={alert.id}
                className="border rounded-lg p-4 transition-all"
                style={{ backgroundColor: config.bg, borderColor: config.border }}
              >
                <div className="flex items-start gap-3">
                  <Icon
                    size={16}
                    style={{ color: config.color }}
                    className="mt-0.5 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm text-white mb-1">{alert.message}</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{
                              backgroundColor: `${alert.projectColor}20`,
                              color: alert.projectColor,
                            }}
                          >
                            {alert.project}
                          </span>
                          <span className="text-xs text-[#5A5A6E]">{alert.source}</span>
                          <span className="text-xs text-[#5A5A6E]">·</span>
                          <span className="text-xs text-[#5A5A6E]">{alert.time}</span>
                          <span className={cn("text-xs px-1.5 py-0.5 rounded ml-auto", statusStyles[alert.status])}>
                            {alert.status}
                          </span>
                        </div>
                      </div>

                      {alert.status === "new" && (
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => acknowledge(alert.id)}
                            className="text-xs px-2 py-1 rounded bg-[#F59E0B15] text-[#F59E0B] hover:bg-[#F59E0B25] transition-colors"
                          >
                            Ack
                          </button>
                          <button
                            onClick={() => resolve(alert.id)}
                            className="text-xs px-2 py-1 rounded bg-[#10B98115] text-[#10B981] hover:bg-[#10B98125] transition-colors"
                          >
                            <Check size={12} />
                          </button>
                        </div>
                      )}
                      {alert.status === "acknowledged" && (
                        <button
                          onClick={() => resolve(alert.id)}
                          className="text-xs px-2 py-1 rounded bg-[#10B98115] text-[#10B981] hover:bg-[#10B98125] transition-colors flex-shrink-0"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
