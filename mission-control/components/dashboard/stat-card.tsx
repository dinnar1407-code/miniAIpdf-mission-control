"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  changeType?: "up" | "down" | "neutral";
  icon: string;
  color?: string;
  subtitle?: string;
}

export function StatCard({
  label,
  value,
  change,
  changeType = "neutral",
  icon,
  color = "#3B82F6",
  subtitle,
}: StatCardProps) {
  return (
    <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-4 hover:border-[#3A3A4A] transition-all duration-200 cursor-default">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
          style={{ backgroundColor: `${color}20` }}
        >
          {icon}
        </div>
        {change && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded",
              changeType === "up" && "text-[#10B981] bg-[#10B98115]",
              changeType === "down" && "text-[#EF4444] bg-[#EF444415]",
              changeType === "neutral" && "text-[#8B8B9E]"
            )}
          >
            {changeType === "up" && <TrendingUp size={11} />}
            {changeType === "down" && <TrendingDown size={11} />}
            {change}
          </div>
        )}
      </div>

      <div className="text-2xl font-bold text-white mb-0.5">{value}</div>
      <div className="text-xs text-[#8B8B9E]">{label}</div>
      {subtitle && (
        <div className="text-xs text-[#5A5A6E] mt-1">{subtitle}</div>
      )}
    </div>
  );
}
