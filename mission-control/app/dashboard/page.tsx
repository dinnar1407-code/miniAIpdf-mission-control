"use client";

import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/dashboard/stat-card";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { AgentStatusMini } from "@/components/dashboard/agent-status-mini";
import { AlertsPreview } from "@/components/dashboard/alerts-preview";
import { useEffect, useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";

const trafficData = Array.from({ length: 14 }, (_, i) => ({
  day: `Apr ${i + 3}`,
  visitors: Math.floor(800 + Math.random() * 600),
  signups: Math.floor(20 + Math.random() * 40),
}));

const projectComparisonData = [
  { project: "MiniAIPDF", mrr: 1247, users: 2847 },
  { project: "FurMates", mrr: 830, users: 1200 },
  { project: "NIW", mrr: 0, users: 15 },
  { project: "Talengineer", mrr: 200, users: 87 },
  { project: "wheatcoin", mrr: 50, users: 340 },
  { project: "Dinnar", mrr: 0, users: 5 },
];

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
  mrrChange?: number;
  users?: number;
  usersChange?: number;
  agentHours?: number;
  // real data
  workflowRunsThisWeek?: number;
  completedRunsThisWeek?: number;
  contentPublished?: number;
  contentDraft?: number;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1A1A24] border border-[#2A2A3A] rounded-lg p-3 text-xs">
        <p className="text-[#8B8B9E] mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: {p.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    openTasks: 23, totalTasks: 45, activeAgents: 3, totalAgents: 5,
    newAlerts: 0, mrr: 2327, mrrChange: 12, users: 4494, usersChange: 8, agentHours: 142,
    workflowRunsThisWeek: 0, completedRunsThisWeek: 0, contentPublished: 0,
  });
  const [recentRuns, setRecentRuns] = useState<{ id: string; name: string; status: string; time: string }[]>([]);
  const [live, setLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  // Load initial data from REST
  useEffect(() => {
    fetch("/api/dashboard")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.stats) {
          setStats(prev => ({ ...prev, ...data.stats }));
          setLastUpdated(new Date());
        }
        if (data?.recentRuns) setRecentRuns(data.recentRuns);
      })
      .catch(() => {});
  }, []);

  // SSE real-time updates
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
        title="Mission Control"
        subtitle={
          <span className="flex items-center gap-2 text-sm text-[#8B8B9E]">
            Playfish Universal Platform · All Projects
            {live && (
              <span className="flex items-center gap-1 text-green-400 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Live
              </span>
            )}
            {lastUpdated && (
              <span className="text-xs text-[#5A5A6E]">
                · Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </span>
        }
      />

      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Project Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <button className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#3B82F6] text-white">
            All
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
            label="Monthly Revenue"
            value={`$${(stats.mrr || 0).toLocaleString()}`}
            change={`+${stats.mrrChange || 0}%`}
            changeType="up"
            icon="💰"
            color="#10B981"
            subtitle="MRR across projects"
          />
          <StatCard
            label="Total Users"
            value={(stats.users || 0).toLocaleString()}
            change={`+${stats.usersChange || 0}%`}
            changeType="up"
            icon="👥"
            color="#3B82F6"
            subtitle="All platforms"
          />
          <StatCard
            label="Open Tasks"
            value={`${stats.openTasks}/${stats.totalTasks}`}
            change={`${taskPct}%`}
            changeType="neutral"
            icon="📋"
            color="#F59E0B"
            subtitle="Across all projects"
          />
          <StatCard
            label="Active Agents"
            value={`${stats.activeAgents}/${stats.totalAgents}`}
            change="Active"
            changeType="up"
            icon="🤖"
            color="#8B5CF6"
            subtitle={`${stats.totalAgents - stats.activeAgents} idle`}
          />
          <StatCard
            label="本周 Workflows"
            value={`${stats.completedRunsThisWeek ?? 0}/${stats.workflowRunsThisWeek ?? 0}`}
            change={stats.workflowRunsThisWeek ? `${Math.round(((stats.completedRunsThisWeek ?? 0) / stats.workflowRunsThisWeek) * 100)}%` : "0%"}
            changeType="up"
            icon="⚡"
            color="#F97316"
            subtitle="完成 / 触发"
          />
          <StatCard
            label="内容已发布"
            value={String(stats.contentPublished ?? 0)}
            change="全渠道"
            changeType="up"
            icon="📡"
            color="#EC4899"
            subtitle={`草稿 ${stats.contentDraft ?? 0} 篇`}
          />
        </div>

        {/* Activity + Agents */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ActivityFeed />
          </div>
          <div>
            <AgentStatusMini />
          </div>
        </div>

        {/* Recent Workflow Runs */}
        {recentRuns.length > 0 && (
          <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">最近 Workflow 运行</h3>
              <a href="/workflows" className="text-xs text-[#3B82F6] hover:underline">查看全部 →</a>
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
                  }>{run.status}</span>
                  <span className="text-[#5A5A6E]">{run.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Traffic Chart + Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-[#12121A] border border-[#2A2A3A] rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Traffic · Last 14 Days</h3>
              <div className="flex items-center gap-4 text-xs text-[#8B8B9E]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                  Visitors
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                  Signups
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={trafficData}>
                <XAxis dataKey="day" tick={{ fill: "#5A5A6E", fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={{ fill: "#5A5A6E", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="visitors" stroke="#3B82F6" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#3B82F6" }} />
                <Line type="monotone" dataKey="signups" stroke="#10B981" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#10B981" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div>
            <AlertsPreview />
          </div>
        </div>

        {/* Project Comparison */}
        <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Project Comparison · MRR</h3>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={projectComparisonData} barSize={24}>
              <XAxis dataKey="project" tick={{ fill: "#5A5A6E", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#5A5A6E", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="mrr" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
