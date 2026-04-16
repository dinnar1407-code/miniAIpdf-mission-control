"use client";

import { Calendar, Flag, Trash2 } from "lucide-react";
import { PRIORITY_COLORS } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  projectName?: string;
  projectColor?: string;
  projectEmoji?: string;
  agentName?: string;
  agentEmoji?: string;
  dueDate?: string;
}

interface TaskCardProps {
  task: Task;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
}

const borderColors: Record<string, string> = {
  urgent: "#EF4444",
  high:   "#F59E0B",
  medium: "#3B82F6",
  low:    "#5A5A6E",
};

export function TaskCard({ task, onEdit, onDelete }: TaskCardProps) {
  const priorityColor    = PRIORITY_COLORS[task.priority] || "#8B8B9E";
  const leftBorderColor  = borderColors[task.priority] || "#5A5A6E";

  return (
    <div
      className="bg-[#1A1A24] border border-[#2A2A3A] rounded-lg p-3 cursor-pointer hover:border-[#3A3A4A] transition-all duration-200 group select-none"
      style={{ borderLeftColor: leftBorderColor, borderLeftWidth: "2px" }}
      onClick={() => onEdit?.(task)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-sm text-white font-medium leading-snug flex-1">{task.title}</div>
        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
          <Flag size={12} style={{ color: priorityColor }} fill={priorityColor} />
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
              className="opacity-0 group-hover:opacity-100 text-[#5A5A6E] hover:text-red-400 transition-all p-0.5 rounded"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>

      {task.description && (
        <div className="text-xs text-[#8B8B9E] mb-2 line-clamp-2">{task.description}</div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {task.projectName && (
          <span
            className="text-xs px-1.5 py-0.5 rounded font-medium"
            style={{
              backgroundColor: `${task.projectColor || "#3B82F6"}20`,
              color: task.projectColor || "#3B82F6",
            }}
          >
            {task.projectEmoji} {task.projectName}
          </span>
        )}
        {task.agentName && (
          <span className="text-xs text-[#5A5A6E]">
            {task.agentEmoji || "🤖"} {task.agentName}
          </span>
        )}
        {task.dueDate && (
          <span className="text-xs text-[#5A5A6E] flex items-center gap-1 ml-auto">
            <Calendar size={10} />
            {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}
