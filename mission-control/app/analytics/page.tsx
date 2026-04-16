"use client";

import { Header } from "@/components/layout/header";
import { useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const generateDailyData = (days: number) =>
  Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.now() - (days - i) * 86400000);
    return {
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      visitors: Math.floor(600 + Math.random() * 800),
      signups: Math.floor(15 + Math.random() * 50),
      mrr: Math.floor(2100 + Math.random() * 400),
      apiCalls: Math.floor(40000 + Math.random() * 20000),
    };
  });

const PROJECT_MRR = [
  { name: "MiniAIPDF", value: 1247, color: "#3B82F6" },
  { name: "FurMates", value: 830, color: "#10B981" },
  { name: "Talengineer", value: 200, color: "#8B5CF6" },
  { name: "wheatcoin", value: 50, color: "#F97316" },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1A1A24] border border-[#2A2A3A] rounded-lg p-3 text-xs shadow-xl">
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

export default function AnalyticsPage() {
  const [days, setDays] = useState(14);
  const data = generateDailyData(days);

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header title="Analytics" subtitle="Cross-project metrics" />

      <div className="p-6 space-y-6">
        {/* Date Range */}
        <div className="flex items-center gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                days === d
                  ? "bg-[#3B82F6] text-white"
                  : "bg-[#12121A] border border-[#2A2A3A] text-[#8B8B9E] hover:text-white"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total MRR", value: "$2,327", change: "+12%", color: "#10B981" },
            { label: "Active Users", value: "4,494", change: "+8%", color: "#3B82F6" },
            { label: "API Calls", value: "847K", change: "+31%", color: "#8B5CF6" },
            { label: "Conversion", value: "3.2%", change: "+0.4%", color: "#F59E0B" },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-4">
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-[#8B8B9E] mt-1">{stat.label}</div>
              <div className="text-xs mt-1" style={{ color: stat.color }}>
                ↑ {stat.change} vs prev period
              </div>
            </div>
          ))}
        </div>

        {/* Traffic Chart */}
        <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-4">
            Traffic & Signups · {days}d
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data}>
              <XAxis dataKey="date" tick={{ fill: "#5A5A6E", fontSize: 11 }} axisLine={false} tickLine={false} interval={Math.floor(days / 5)} />
              <YAxis tick={{ fill: "#5A5A6E", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="visitors" stroke="#3B82F6" strokeWidth={2} dot={false} name="Visitors" />
              <Line type="monotone" dataKey="signups" stroke="#10B981" strokeWidth={2} dot={false} name="Signups" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* MRR Over Time */}
          <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-4">MRR Trend</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data}>
                <XAxis dataKey="date" tick={{ fill: "#5A5A6E", fontSize: 11 }} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={{ fill: "#5A5A6E", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="mrr" stroke="#10B981" strokeWidth={2} dot={false} name="MRR ($)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue by Project */}
          <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-4">MRR by Project</h3>
            <div className="flex items-center gap-4">
              <PieChart width={150} height={150}>
                <Pie data={PROJECT_MRR} dataKey="value" cx={70} cy={70} innerRadius={40} outerRadius={65}>
                  {PROJECT_MRR.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
              <div className="flex-1 space-y-2">
                {PROJECT_MRR.map((p) => (
                  <div key={p.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-xs text-[#8B8B9E]">{p.name}</span>
                    </div>
                    <span className="text-xs font-medium text-white">${p.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* API Calls */}
        <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-4">API Calls · {days}d</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data} barSize={12}>
              <XAxis dataKey="date" tick={{ fill: "#5A5A6E", fontSize: 11 }} axisLine={false} tickLine={false} interval={3} />
              <YAxis tick={{ fill: "#5A5A6E", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="apiCalls" fill="#8B5CF6" radius={[3, 3, 0, 0]} name="API Calls" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
