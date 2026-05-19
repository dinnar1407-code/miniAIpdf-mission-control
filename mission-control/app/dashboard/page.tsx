"use client";

import { Header } from "@/components/layout/header";
import { useT } from "@/lib/i18n";
import { StatCard } from "@/components/dashboard/stat-card";
import { ActivityFeed, ActivityItem } from "@/components/dashboard/activity-feed";
import { AgentStatusMini, AgentRecord } from "@/components/dashboard/agent-status-mini";
import { AlertsPreview } from "@/components/dashboard/alerts-preview";
import { useEffect, useRef, useState } from "react";

const projects = [
  { name: "MiniAIPDF", slug: "miniaipdf", emoji: "📄", color: "#3B82F6" },
  { name: "FurMates", slug: "furmales", emoji: "🛒", color: "#10B981" },
  { name: "NIW", slug: "niw", emoji: "📝", color: "#F59E0B" },
  { name: "Talengineer", slug: "talengineer", emoji: "🔧", color: "#8B5CF6" },
  { name: "wheatcoin", slug: "wheatcoin", emoji: "🪙", color: "#F97316" },
  { name: "Dinnar", slug: "dinnar", emoji: "🏭", color: "#EF4444" },
];

interface DashboardStats {
  openTasks: number;
  totalTasks: number;
  activeAgents: number;
  totalAgents: number;
  newAlerts: number;
  mrr?: number;
  mrrConfigured?: boolean;
  users?: number;
  usersConfigured?: boolean;
  workflowRunsThisWeek?: number;
  completedRunsThisWeek?: number;
  contentPublished?: number;
  contentDraft?: number;
  pendingApprovals?: number;
}

export default function DashboardPage() {
  const t = useT();
  const [stats, setStats] = useState<DashboardStats>({
    openTasks: 0, totalTasks: 0, activeAgents: 0, totalAgents: 0,
    newAlerts: 0, mrrConfigured: false, usersConfigured: false,
    workflowRunsThisWeek: 0, completedRunsThisWeek: 0, contentPublished: 0,
  });
  const [recentRuns, setRecentRuns] = useState<{ id: string; name: string; status: string; time: string }[]>([]);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [agentList, setAgentList] = useState<AgentRecord[]>([]);
  const [live, setLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.stats) {
          setStats(prev => ({ ...prev, ...data.stats }));
          setLastUpdated(new Date());
        }
        if (data?.recentRuns) setRecentRuns(data.recentRuns);
        if (data?.recentActivity) setActivityItems(data.recentActivity);
        if (data?.agents) setAgentList(data.agents);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/sse");
    sseRef.current = es;

    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as DashboardStats & { timestamp: string };
        setStats(prev => ({ ...prev, ...data }));
        setLastUpdated(new Date(data.timestamp));
        setLive(true);
      } catch {}
    };

    return () => {
      es.close();
      setLive(false);
    };
  }, []);

  const taskPct = stats.totalTasks > 0
    ? Math.round((stats.openTasks / stats.totalTasks) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header
        title={t.dashTitle}
        subtitle={
          <span className="flex items-center gap-2 text-sm text-[#8B8B9E]">
            {t.dashSubtitle}
            {live && (
              <span className="flex items-center gap-1 text-green-400 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                {t.dashLive}
              </span>
            )}
            {lastUpdated && (
              <span className="text-xs text-[#5A5A6E]">
                {t.dashUpdatedAt(lastUpdated.toLocaleTimeString())}
              </span>
            )}
          </span>
        }
      />

      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Project Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <button className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#3B82F6] text-white">
            {t.all}
          </button>
          {projects.map((p) => (
            <button
              key={p.slug}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#12121A] border border-[#2A2A3A] text-[#8B8B9E] hover:text-white hover:border-[#3A3A4A] transition-colors"
            >
              {p.emoji} {p.name}
            </button>
          ))}
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          <StatCard
            label={t.dashMonthlyRevenue}
            value={`$${(stats.mrr || 0).toLocaleString()}`}
            icon="💰"
            color="#10B981"
            subtitle={t.dashMRR}
            configured={stats.mrrConfigured !== false}
          />
          <StatCard
            label={t.dashTotalUsers}
            value={(stats.users || 0).toLocaleString()}
            icon="👥"
            color="#3B82F6"
            subtitle={t.dashAllPlatforms}
            configured={stats.usersConfigured !== false}
          />
          <StatCard
            label={t.dashOpenTasks}
            value={`${stats.openTasks}/${stats.totalTasks}`}
            change={`${taskPct}%`}
            changeType="neutral"
            icon="📋"
            color="#F59E0B"
            subtitle={t.dashAllProjects}
          />
          <StatCard
            label={t.dashActiveAgents}
            value={`${stats.activeAgents}/${stats.totalAgents}`}
            change={t.dashStatusActive}
            changeType="up"
            icon="🤖"
            color="#8B5CF6"
            subtitle={t.dashIdleCount(stats.totalAgents - stats.activeAgents)}
          />
          <StatCard
            label={t.dashWeeklyWorkflows}
            value={`${stats.completedRunsThisWeek ?? 0}/${stats.workflowRunsThisWeek ?? 0}`}
            change={stats.workflowRunsThisWeek ? `${Math.round(((stats.completedRunsThisWeek ?? 0) / stats.workflowRunsThisWeek) * 100)}%` : "0%"}
            changeType="up"
            icon="⚡"
            color="#F97316"
            subtitle={t.dashDoneTriggered}
          />
          <StatCard
            label={t.dashContentPublished}
            value={String(stats.contentPublished ?? 0)}
            change={t.dashAllChannels}
            changeType="up"
            icon="📡"
            color="#EC4899"
            subtitle={t.dashDraftCount(stats.contentDraft ?? 0)}
          />
        </div>

        {/* Pending Approvals */}
        {(stats.pendingApprovals ?? 0) > 0 && (
          <div className="max-w-md">
            <StatCard
              label={t.dashPendingApprovals}
              value={String(stats.pendingApprovals)}
              change={t.dashActionRequired}
              changeType="neutral"
              icon="⏳"
              color="#F59E0B"
              subtitle="Telegram /approve_xxx"
            />
          </div>
        )}

        {/* Activity + Agents */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ActivityFeed items={activityItems} />
          </div>
          <div>
            <AgentStatusMini agents={agentList} />
          </div>
        </div>

        {/* Recent Workflow Runs */}
        {recentRuns.length > 0 && (
          <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">{t.dashRecentRuns}</h3>
              <a href="/workflows" className="text-xs text-[#3B82F6] hover:underline">{t.dashViewAll}</a>
            </div>
            <div className="space-y-2">
              {recentRuns.map(run => (
                <div key={run.id} className="flex items-center gap-3 text-xs">
                  <span className={
                    run.status === "completed" ? "w-2 h-2 rounded-full bg-[#10B981] flex-shrink-0" :
                    run.status === "running"   ? "w-2 h-2 rounded-full bg-[#3B82F6] animate-pulse flex-shrink-0" :
                    run.status === "failed"    ? "w-2 h-2 rounded-full bg-[#EF4444] flex-shrink-0" :
                    "w-2 h-2 rounded-full bg-[#5A5A6E] flex-shrink-0"
                  } />
                  <span className="text-white flex-1 truncate">{run.name}</span>
                  <span className={
                    run.status === "completed" ? "text-[#10B981]" :
                    run.status === "failed"    ? "text-[#EF4444]" : "text-[#5A5A6E]"
                  }>{run.status === "completed" ? t.statusCompleted : run.status === "running" ? t.statusRunning : run.status === "failed" ? t.statusFailed : run.status}</span>
                  <span className="text-[#5A5A6E]">{run.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Traffic chart — no data source */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-[#12121A] border border-[#2A2A3A] rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">{t.dashTraffic}</h3>
            </div>
            <div className="flex flex-col items-center justify-center h-[180px] gap-2">
              <span className="text-2xl">📊</span>
              <p className="text-sm text-[#5A5A6E]">{t.noData}</p>
              <p className="text-xs text-[#3A3A4E]">{t.dashChartNoDataHint}</p>
            </div>
          </div>
          <div>
            <AlertsPreview />
          </div>
        </div>

        {/* Project MRR comparison — no data source */}
        <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">{t.dashProjectMRR}</h3>
          </div>
          <div className="flex flex-col items-center justify-center h-[140px] gap-2">
            <span className="text-2xl">💰</span>
            <p className="text-sm text-[#5A5A6E]">{t.noData}</p>
            <p className="text-xs text-[#3A3A4E]">{t.dashNotConfigured} · {t.dashNotConfiguredHint}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
