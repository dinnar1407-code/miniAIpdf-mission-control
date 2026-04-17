"use client";

import { Bell, RefreshCw, Settings } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      window.location.reload();
    }, 1000);
  };

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A2A3A] bg-[#0A0A0F] sticky top-0 z-10">
      <div>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        {subtitle && (
          <div className="text-sm text-[#8B8B9E] mt-0.5">{subtitle}</div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Live indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#12121A] border border-[#2A2A3A]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
          <span className="text-xs text-[#8B8B9E]">Live</span>
        </div>

        {actions}

        <button
          onClick={handleRefresh}
          className="p-2 rounded-md text-[#8B8B9E] hover:text-white hover:bg-[#1A1A24] transition-colors"
        >
          <RefreshCw
            size={15}
            className={cn(isRefreshing && "animate-spin")}
          />
        </button>

        <button className="p-2 rounded-md text-[#8B8B9E] hover:text-white hover:bg-[#1A1A24] transition-colors relative">
          <Bell size={15} />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
        </button>

        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center text-xs font-semibold">
          T
        </div>
      </div>
    </div>
  );
}
