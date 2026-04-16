"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<TaskFormData>) => void;
  initialData?: Partial<TaskFormData>;
}

interface TaskFormData {
  title: string;
  description: string;
  status: string;
  priority: string;
  projectSlug: string;
  agentId: string;
}

const PROJECTS = [
  { slug: "miniaipdf", name: "MiniAIPDF", emoji: "📄" },
  { slug: "furmales", name: "FurMates", emoji: "🛒" },
  { slug: "niw", name: "NIW", emoji: "📝" },
  { slug: "talengineer", name: "Talengineer", emoji: "🔧" },
  { slug: "wheatcoin", name: "wheatcoin", emoji: "🪙" },
  { slug: "dinnar", name: "Dinnar", emoji: "🏭" },
];

const AGENTS = [
  { id: "playfish", name: "Playfish", emoji: "🌾" },
  { id: "pm01", name: "PM01", emoji: "📝" },
  { id: "admin01", name: "Admin01", emoji: "🔧" },
  { id: "dfm", name: "DFM", emoji: "📊" },
];

export function TaskModal({ isOpen, onClose, onSave, initialData }: TaskModalProps) {
  const [form, setForm] = useState<TaskFormData>({
    title: initialData?.title || "",
    description: initialData?.description || "",
    status: initialData?.status || "todo",
    priority: initialData?.priority || "medium",
    projectSlug: initialData?.projectSlug || "",
    agentId: initialData?.agentId || "",
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-[#12121A] border border-[#2A2A3A] rounded-xl w-full max-w-md mx-4 shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between p-4 border-b border-[#2A2A3A]">
          <h2 className="text-sm font-semibold text-white">
            {initialData?.title ? "Edit Task" : "New Task"}
          </h2>
          <button
            onClick={onClose}
            className="text-[#8B8B9E] hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="text-xs text-[#8B8B9E] mb-1 block">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Task title..."
              required
              className="w-full bg-[#1A1A24] border border-[#2A2A3A] rounded-md px-3 py-2 text-sm text-white placeholder-[#5A5A6E] focus:outline-none focus:border-[#3B82F6] transition-colors"
            />
          </div>

          <div>
            <label className="text-xs text-[#8B8B9E] mb-1 block">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional description..."
              rows={3}
              className="w-full bg-[#1A1A24] border border-[#2A2A3A] rounded-md px-3 py-2 text-sm text-white placeholder-[#5A5A6E] focus:outline-none focus:border-[#3B82F6] transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#8B8B9E] mb-1 block">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full bg-[#1A1A24] border border-[#2A2A3A] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6] transition-colors"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-[#8B8B9E] mb-1 block">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full bg-[#1A1A24] border border-[#2A2A3A] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6] transition-colors"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#8B8B9E] mb-1 block">Project</label>
              <select
                value={form.projectSlug}
                onChange={(e) => setForm({ ...form, projectSlug: e.target.value })}
                className="w-full bg-[#1A1A24] border border-[#2A2A3A] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6] transition-colors"
              >
                <option value="">None</option>
                {PROJECTS.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.emoji} {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-[#8B8B9E] mb-1 block">Assign to</label>
              <select
                value={form.agentId}
                onChange={(e) => setForm({ ...form, agentId: e.target.value })}
                className="w-full bg-[#1A1A24] border border-[#2A2A3A] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6] transition-colors"
              >
                <option value="">Unassigned</option>
                {AGENTS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.emoji} {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-[#8B8B9E] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-[#3B82F6] hover:bg-blue-600 text-white rounded-md transition-colors"
            >
              {initialData?.title ? "Save changes" : "Create task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
