"use client";

import { Header } from "@/components/layout/header";
import { useState } from "react";
import { Plus, Calendar, List } from "lucide-react";
import { cn } from "@/lib/utils";

const PLATFORM_ICONS: Record<string, string> = {
  twitter: "🐦",
  youtube: "📺",
  instagram: "📸",
  linkedin: "🔗",
  blog: "📰",
  newsletter: "📧",
  tiktok: "🎵",
};

const INITIAL_CONTENT = [
  {
    id: "1",
    title: "5 Ways AI Can Compress Your PDFs Without Losing Quality",
    platform: "blog",
    type: "tutorial",
    status: "published",
    scheduledFor: null,
    publishedAt: "2026-04-15",
    project: "MiniAIPDF",
    projectColor: "#3B82F6",
    agentEmoji: "📝",
    agentName: "PM01",
    metrics: { views: 1240, likes: 47 },
  },
  {
    id: "2",
    title: "Thread: Why your PDF tools are costing you 2h/day",
    platform: "twitter",
    type: "tip",
    status: "published",
    scheduledFor: null,
    publishedAt: "2026-04-16",
    project: "MiniAIPDF",
    projectColor: "#3B82F6",
    agentEmoji: "📝",
    agentName: "PM01",
    metrics: { views: 8400, likes: 312 },
  },
  {
    id: "3",
    title: "FurMates Spring Collection — Dog Beds Review",
    platform: "instagram",
    type: "post",
    status: "scheduled",
    scheduledFor: "2026-04-18 10:00",
    publishedAt: null,
    project: "FurMates",
    projectColor: "#10B981",
    agentEmoji: "🌾",
    agentName: "Playfish",
    metrics: null,
  },
  {
    id: "4",
    title: "MiniAIPDF API Integration Guide (YouTube)",
    platform: "youtube",
    type: "tutorial",
    status: "draft",
    scheduledFor: null,
    publishedAt: null,
    project: "MiniAIPDF",
    projectColor: "#3B82F6",
    agentEmoji: "📝",
    agentName: "PM01",
    metrics: null,
  },
  {
    id: "5",
    title: "wheatcoin SDK v2 — What's New",
    platform: "newsletter",
    type: "announcement",
    status: "published",
    scheduledFor: null,
    publishedAt: "2026-04-14",
    project: "wheatcoin",
    projectColor: "#F97316",
    agentEmoji: "📊",
    agentName: "DFM",
    metrics: { views: 340, likes: 28 },
  },
  {
    id: "6",
    title: "LinkedIn: Building AI Agents for your SaaS",
    platform: "linkedin",
    type: "post",
    status: "scheduled",
    scheduledFor: "2026-04-17 09:00",
    publishedAt: null,
    project: "MiniAIPDF",
    projectColor: "#3B82F6",
    agentEmoji: "🌾",
    agentName: "Playfish",
    metrics: null,
  },
];

const statusColors: Record<string, string> = {
  published: "text-[#10B981] bg-[#10B98115]",
  scheduled: "text-[#3B82F6] bg-[#3B82F615]",
  draft: "text-[#8B8B9E] bg-[#2A2A3A]",
  failed: "text-[#EF4444] bg-[#EF444415]",
};

export default function ContentPage() {
  const [view, setView] = useState<"list" | "calendar">("list");
  const [platformFilter, setPlatformFilter] = useState("all");

  const filtered = platformFilter === "all"
    ? INITIAL_CONTENT
    : INITIAL_CONTENT.filter((c) => c.platform === platformFilter);

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header
        title="Content"
        subtitle="All content across projects"
        actions={
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6] hover:bg-blue-600 text-white text-xs rounded-md transition-colors">
            <Plus size={13} /> New Content
          </button>
        }
      />

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Published", count: INITIAL_CONTENT.filter(c => c.status === "published").length, color: "#10B981" },
            { label: "Scheduled", count: INITIAL_CONTENT.filter(c => c.status === "scheduled").length, color: "#3B82F6" },
            { label: "Draft", count: INITIAL_CONTENT.filter(c => c.status === "draft").length, color: "#8B8B9E" },
            { label: "Total", count: INITIAL_CONTENT.length, color: "#8B5CF6" },
          ].map((s) => (
            <div key={s.label} className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-3 text-center">
              <div className="text-xl font-bold" style={{ color: s.color }}>{s.count}</div>
              <div className="text-xs text-[#8B8B9E]">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters + View Toggle */}
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setPlatformFilter("all")}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                platformFilter === "all"
                  ? "bg-[#3B82F6] text-white"
                  : "bg-[#12121A] border border-[#2A2A3A] text-[#8B8B9E] hover:text-white"
              )}
            >
              All
            </button>
            {Object.entries(PLATFORM_ICONS).map(([platform, icon]) => (
              <button
                key={platform}
                onClick={() => setPlatformFilter(platform)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors",
                  platformFilter === platform
                    ? "bg-[#3B82F6] text-white"
                    : "bg-[#12121A] border border-[#2A2A3A] text-[#8B8B9E] hover:text-white"
                )}
              >
                {icon} {platform}
              </button>
            ))}
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => setView("list")}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                view === "list"
                  ? "bg-[#1A1A24] text-white"
                  : "text-[#5A5A6E] hover:text-white"
              )}
            >
              <List size={15} />
            </button>
            <button
              onClick={() => setView("calendar")}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                view === "calendar"
                  ? "bg-[#1A1A24] text-white"
                  : "text-[#5A5A6E] hover:text-white"
              )}
            >
              <Calendar size={15} />
            </button>
          </div>
        </div>

        {/* Content List */}
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-4 hover:border-[#3A3A4A] transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl leading-none mt-0.5">
                  {PLATFORM_ICONS[item.platform]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium text-white leading-snug">
                      {item.title}
                    </div>
                    <span className={cn("text-xs px-2 py-0.5 rounded flex-shrink-0", statusColors[item.status])}>
                      {item.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${item.projectColor}20`,
                        color: item.projectColor,
                      }}
                    >
                      {item.project}
                    </span>
                    <span className="text-xs text-[#5A5A6E] capitalize">{item.type}</span>
                    <span className="text-xs text-[#5A5A6E]">
                      {item.agentEmoji} {item.agentName}
                    </span>

                    {item.scheduledFor && (
                      <span className="text-xs text-[#3B82F6]">
                        📅 {item.scheduledFor}
                      </span>
                    )}
                    {item.publishedAt && (
                      <span className="text-xs text-[#5A5A6E]">
                        Published {item.publishedAt}
                      </span>
                    )}

                    {item.metrics && (
                      <span className="text-xs text-[#5A5A6E] ml-auto">
                        👁 {item.metrics.views.toLocaleString()} · ❤️ {item.metrics.likes}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
