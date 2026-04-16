"use client";

import { Header } from "@/components/layout/header";
import { useState } from "react";
import { Plus, Edit2, Archive } from "lucide-react";

const PROJECTS = [
  { name: "MiniAIPDF", slug: "miniaipdf", emoji: "📄", color: "#3B82F6", status: "active", description: "AI-powered PDF SaaS tool", agents: ["Playfish", "PM01", "Admin01", "DFM"] },
  { name: "FurMates", slug: "furmales", emoji: "🛒", color: "#10B981", status: "active", description: "Pet supplies e-commerce", agents: ["Playfish", "PM01", "Admin01"] },
  { name: "NIW", slug: "niw", emoji: "📝", color: "#F59E0B", status: "active", description: "National Interest Waiver petition", agents: ["Playfish", "Admin01"] },
  { name: "Talengineer", slug: "talengineer", emoji: "🔧", color: "#8B5CF6", status: "active", description: "Engineering talent matchmaker", agents: ["Admin01"] },
  { name: "wheatcoin", slug: "wheatcoin", emoji: "🪙", color: "#F97316", status: "active", description: "Crypto community & SDK", agents: ["DFM", "Admin01"] },
  { name: "Dinnar", slug: "dinnar", emoji: "🏭", color: "#EF4444", status: "active", description: "Industrial operations", agents: ["Playfish"] },
];

export default function SettingsPage() {
  const [projects, setProjects] = useState(PROJECTS);

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header title="Settings" subtitle="Platform configuration" />

      <div className="p-6 max-w-3xl space-y-8">
        {/* Projects */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Projects</h2>
              <p className="text-xs text-[#8B8B9E] mt-0.5">Manage your portfolio of projects</p>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6] hover:bg-blue-600 text-white text-xs rounded-md transition-colors">
              <Plus size={13} /> Add Project
            </button>
          </div>

          <div className="space-y-3">
            {projects.map((p) => (
              <div key={p.slug} className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                    style={{ backgroundColor: `${p.color}20` }}
                  >
                    {p.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{p.name}</span>
                      <span className="text-xs text-[#5A5A6E]">/{p.slug}</span>
                      <span className="text-xs bg-[#10B98115] text-[#10B981] px-1.5 py-0.5 rounded ml-auto">
                        {p.status}
                      </span>
                    </div>
                    <div className="text-xs text-[#8B8B9E] mt-0.5">{p.description}</div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {p.agents.map((a) => (
                        <span key={a} className="text-xs bg-[#1A1A24] text-[#5A5A6E] px-2 py-0.5 rounded">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button className="p-1.5 rounded-md text-[#5A5A6E] hover:text-white hover:bg-[#1A1A24] transition-colors">
                      <Edit2 size={13} />
                    </button>
                    <button className="p-1.5 rounded-md text-[#5A5A6E] hover:text-[#F59E0B] hover:bg-[#1A1A24] transition-colors">
                      <Archive size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Platform Info */}
        <section>
          <h2 className="text-sm font-semibold text-white mb-4">Platform</h2>
          <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg divide-y divide-[#2A2A3A]">
            {[
              { label: "Platform Name", value: "Playfish Mission Control" },
              { label: "Version", value: "v1.0.0" },
              { label: "Environment", value: "Development" },
              { label: "Database", value: "SQLite (dev) → PostgreSQL (prod)" },
              { label: "Auth", value: "NextAuth.js" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-[#8B8B9E]">{item.label}</span>
                <span className="text-xs text-white font-mono">{item.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Refresh Settings */}
        <section>
          <h2 className="text-sm font-semibold text-white mb-4">Real-time Settings</h2>
          <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white">Auto-refresh interval</div>
                <div className="text-xs text-[#8B8B9E] mt-0.5">How often the dashboard polls for updates</div>
              </div>
              <select className="bg-[#1A1A24] border border-[#2A2A3A] text-white text-xs rounded-md px-3 py-1.5 focus:outline-none focus:border-[#3B82F6]">
                <option>30 seconds</option>
                <option>60 seconds</option>
                <option>5 minutes</option>
                <option>Manual only</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white">Critical alert notifications</div>
                <div className="text-xs text-[#8B8B9E] mt-0.5">Browser notifications for critical alerts</div>
              </div>
              <div className="w-9 h-5 bg-[#10B981] rounded-full relative cursor-pointer">
                <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
