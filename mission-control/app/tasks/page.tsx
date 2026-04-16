"use client";

import { Header } from "@/components/layout/header";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { useState } from "react";

const PROJECTS = [
  { slug: "all", name: "All Projects", emoji: "🌐" },
  { slug: "miniaipdf", name: "MiniAIPDF", emoji: "📄", color: "#3B82F6" },
  { slug: "furmales", name: "FurMates", emoji: "🛒", color: "#10B981" },
  { slug: "niw", name: "NIW", emoji: "📝", color: "#F59E0B" },
  { slug: "talengineer", name: "Talengineer", emoji: "🔧", color: "#8B5CF6" },
  { slug: "wheatcoin", name: "wheatcoin", emoji: "🪙", color: "#F97316" },
  { slug: "dinnar", name: "Dinnar", emoji: "🏭", color: "#EF4444" },
];

export default function TasksPage() {
  const [selectedProject, setSelectedProject] = useState("all");

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header
        title="Tasks"
        subtitle="Kanban board · All projects"
      />

      <div className="p-6">
        {/* Project Filter */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {PROJECTS.map((p) => (
            <button
              key={p.slug}
              onClick={() => setSelectedProject(p.slug)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedProject === p.slug
                  ? "bg-[#3B82F6] text-white"
                  : "bg-[#12121A] border border-[#2A2A3A] text-[#8B8B9E] hover:text-white hover:border-[#3A3A4A]"
              }`}
            >
              {p.emoji} {p.name}
            </button>
          ))}
        </div>

        <KanbanBoard />
      </div>
    </div>
  );
}
