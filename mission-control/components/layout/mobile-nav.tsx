"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CheckSquare, BarChart3, Bot, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  { href: "/dashboard",  label: "Home",      icon: LayoutDashboard },
  { href: "/tasks",      label: "Tasks",     icon: CheckSquare },
  { href: "/workflows",  label: "Flows",     icon: Workflow },
  { href: "/agents",     label: "Agents",    icon: Bot },
  { href: "/analytics",  label: "Analytics", icon: BarChart3 },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0A0A0F]/95 backdrop-blur-md border-t border-[#2A2A3A] z-50">
      <div className="flex items-center justify-around px-2 pt-2 pb-4">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-xs transition-all active:scale-95",
                isActive
                  ? "text-[#3B82F6] bg-[#3B82F6]/10"
                  : "text-[#5A5A6E] hover:text-[#8B8B9E]"
              )}
            >
              <Icon size={21} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className={cn("font-medium", isActive ? "text-[#3B82F6]" : "text-[#5A5A6E]")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
