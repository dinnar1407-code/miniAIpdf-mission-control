import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
}

export const PROJECT_COLORS: Record<string, string> = {
  miniaipdf: "#3B82F6",
  furmales: "#10B981",
  niw: "#F59E0B",
  talengineer: "#8B5CF6",
  wheatcoin: "#F97316",
  dinnar: "#EF4444",
};

export const STATUS_COLORS: Record<string, string> = {
  todo: "#8B8B9E",
  in_progress: "#3B82F6",
  review: "#F59E0B",
  done: "#10B981",
  blocked: "#EF4444",
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: "#8B8B9E",
  medium: "#3B82F6",
  high: "#F59E0B",
  urgent: "#EF4444",
};
