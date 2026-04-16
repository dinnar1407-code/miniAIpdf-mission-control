"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  BarChart3,
  Bot,
  Bell,
  Settings,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

const projects = [
  { name: "MiniAIPDF", slug: "miniaipdf", emoji: "📄", color: "#3B82F6" },
  { name: "FurMates", slug: "furmales", emoji: "🛒", color: "#10B981" },
  { name: "NIW", slug: "niw", emoji: "📝", color: "#F59E0B" },
  { name: "Talengineer", slug: "talengineer", emoji: "🔧", color: "#8B5CF6" },
  { name: "wheatcoin", slug: "wheatcoin", emoji: "🪙", color: "#F97316" },
  { name: "Dinnar", slug: "dinnar", emoji: "🏭", color: "#EF4444" },
];

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/content", label: "Content", icon: Calendar },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-[240px] bg-[#0A0A0F] border-r border-[#2A2A3A] h-screen flex-shrink-0">
      {/* Logo */}
      <div className="p-4 border-b border-[#2A2A3A]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] rounded-lg flex items-center justify-center text-sm">
            🌾
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Mission Ctrl</div>
            <div className="text-xs text-[#5A5A6E]">Playfish Platform</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-150",
                isActive
                  ? "bg-[#1A1A24] text-white"
                  : "text-[#8B8B9E] hover:text-white hover:bg-[#1A1A24]"
              )}
            >
              <Icon size={16} />
              {item.label}
              {item.label === "Alerts" && (
                <span className="ml-auto bg-[#EF4444] text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  3
                </span>
              )}
            </Link>
          );
        })}

        {/* Projects */}
        <div className="pt-4">
          <div className="px-3 py-1 text-xs font-medium text-[#5A5A6E] uppercase tracking-wider mb-1">
            Projects
          </div>
          {projects.map((project) => (
            <Link
              key={project.slug}
              href={`/dashboard?project=${project.slug}`}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-[#8B8B9E] hover:text-white hover:bg-[#1A1A24] transition-colors duration-150"
            >
              <span className="text-base leading-none">{project.emoji}</span>
              <span className="truncate">{project.name}</span>
              <span
                className="ml-auto w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: project.color }}
              />
            </Link>
          ))}
        </div>
      </nav>

      {/* Agent Status (compact) */}
      <div className="p-3 border-t border-[#2A2A3A]">
        <div className="text-xs text-[#5A5A6E] mb-2">Agent Status</div>
        <div className="space-y-1.5">
          {[
            { name: "Playfish", status: "active", emoji: "🌾" },
            { name: "PM01", status: "active", emoji: "📝" },
            { name: "Admin01", status: "active", emoji: "🔧" },
            { name: "DFM", status: "idle", emoji: "📊" },
          ].map((agent) => (
            <div key={agent.name} className="flex items-center gap-2">
              <span className="text-xs">{agent.emoji}</span>
              <span className="text-xs text-[#8B8B9E] flex-1">{agent.name}</span>
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  agent.status === "active"
                    ? "bg-[#10B981] animate-pulse"
                    : "bg-[#5A5A6E]"
                )}
              />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
