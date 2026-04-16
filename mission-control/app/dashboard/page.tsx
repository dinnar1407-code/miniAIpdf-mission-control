"use client";

import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/dashboard/stat-card";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { AgentStatusMini } from "@/components/dashboard/agent-status-mini";
import { AlertsPreview } from "@/components/dashboard/alerts-preview";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1A1A24] border border-[#2A2A3A] rounded-lg p-3 text-xs">
        <p className="text-[#8B8B9E] mb-1">{label}</p>
        {payload.map((p: any) => (
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
  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header
        title="Mission Control"
        subtitle="Playfish Universal Platform · All Projects"
      />

      <div className="p-6 space-y-6">
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            label="Monthly Revenue"
            value="$2,327"
            change="+12%"
            changeType="up"
            icon="💰"
            color="#10B981"
            subtitle="MRR across projects"
          />
          <StatCard
            label="Total Users"
            value="4,494"
            change="+8%"
            changeType="up"
            icon="👥"
            color="#3B82F6"
            subtitle="All platforms"
          />
          <StatCard
            label="Open Tasks"
            value="23/45"
            change="51%"
            changeType="neutral"
            icon="📋"
            color="#F59E0B"
            subtitle="Across all projects"
          />
          <StatCard
            label="Active Agents"
            value="3/5"
            change="Active"
            changeType="up"
            icon="🤖"
            color="#8B5CF6"
            subtitle="2 idle"
          />
          <StatCard
            label="Agent Hours"
            value="142h"
            change="+22%"
            changeType="up"
            icon="⏰"
            color="#F97316"
            subtitle="This week"
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

        {/* Traffic Chart + Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Traffic Chart */}
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
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trafficData}>
                <XAxis
                  dataKey="day"
                  tick={{ fill: "#5A5A6E", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval={3}
                />
                <YAxis
                  tick={{ fill: "#5A5A6E", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="visitors"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#3B82F6" }}
                />
                <Line
                  type="monotone"
                  dataKey="signups"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#10B981" }}
                />
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
            <div className="flex gap-2">
              <button className="text-xs px-2 py-1 rounded bg-[#3B82F6] text-white">MRR</button>
              <button className="text-xs px-2 py-1 rounded bg-[#1A1A24] text-[#8B8B9E] hover:text-white">Users</button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={projectComparisonData} barSize={28}>
              <XAxis
                dataKey="project"
                tick={{ fill: "#5A5A6E", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#5A5A6E", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="mrr" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
