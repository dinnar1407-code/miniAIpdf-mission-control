"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2 } from "lucide-react";
import { TaskCard } from "./task-card";
import { TaskModal } from "./task-modal";

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
  project?: { name: string; color: string; slug: string };
  agent?: { name: string };
}

const COLUMNS = [
  { id: "todo",        label: "To Do",       color: "#8B8B9E" },
  { id: "in_progress", label: "In Progress",  color: "#3B82F6" },
  { id: "review",      label: "Review",       color: "#F59E0B" },
  { id: "done",        label: "Done",         color: "#10B981" },
  { id: "blocked",     label: "Blocked",      color: "#EF4444" },
];

const PROJECT_COLORS: Record<string, string> = {
  miniaipdf:   "#3B82F6",
  furmales:    "#10B981",
  niw:         "#F59E0B",
  talengineer: "#8B5CF6",
  wheatcoin:   "#F97316",
  dinnar:      "#EF4444",
};

const PROJECT_EMOJIS: Record<string, string> = {
  miniaipdf:   "📄",
  furmales:    "🛒",
  niw:         "📝",
  talengineer: "🔧",
  wheatcoin:   "🪙",
  dinnar:      "🏭",
};

function normalizeTask(t: Task): Task {
  return {
    ...t,
    projectName:  t.project?.name  || t.projectName,
    projectColor: t.project?.color || (t.project ? PROJECT_COLORS[t.project.slug] : t.projectColor),
    projectEmoji: t.project ? PROJECT_EMOJIS[t.project.slug] : t.projectEmoji,
    agentName:    t.agent?.name    || t.agentName,
  };
}

interface KanbanBoardProps {
  projectFilter?: string;
}

export function KanbanBoard({ projectFilter = "all" }: KanbanBoardProps) {
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [loading, setLoading]       = useState(true);
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [editingTask, setEditingTask]   = useState<Task | undefined>();
  const [draggedTaskId, setDraggedTaskId]   = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [savingId, setSavingId]     = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const url = projectFilter !== "all"
        ? `/api/tasks?project=${projectFilter}`
        : "/api/tasks";
      const res = await fetch(url);
      if (res.ok) {
        const data: Task[] = await res.json();
        setTasks(data.map(normalizeTask));
      }
    } catch {}
    finally { setLoading(false); }
  }, [projectFilter]);

  useEffect(() => {
    setLoading(true);
    fetchTasks();
  }, [fetchTasks]);

  // Create or update task via API
  const handleSaveTask = async (data: Partial<Task>) => {
    if (editingTask) {
      // Update
      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = normalizeTask(await res.json());
        setTasks(prev => prev.map(t => t.id === editingTask.id ? updated : t));
      }
    } else {
      // Create
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const created = normalizeTask(await res.json());
        setTasks(prev => [...prev, created]);
      }
    }
    setEditingTask(undefined);
  };

  // Delete task
  const handleDeleteTask = async (taskId: string) => {
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  // Drag handlers — save to DB on drop
  const handleDragStart = (taskId: string) => setDraggedTaskId(taskId);

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDrop = async (columnId: string) => {
    if (!draggedTaskId || draggedTaskId === undefined) {
      setDraggedTaskId(null);
      setDragOverColumn(null);
      return;
    }

    const task = tasks.find(t => t.id === draggedTaskId);
    if (!task || task.status === columnId) {
      setDraggedTaskId(null);
      setDragOverColumn(null);
      return;
    }

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === draggedTaskId ? { ...t, status: columnId } : t));
    setDraggedTaskId(null);
    setDragOverColumn(null);

    // Persist to DB
    setSavingId(draggedTaskId);
    try {
      await fetch(`/api/tasks/${draggedTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: columnId,
          ...(columnId === "done" ? { completedAt: new Date().toISOString() } : {}),
        }),
      });
    } catch {
      // Revert on error
      setTasks(prev => prev.map(t => t.id === draggedTaskId ? { ...t, status: task.status } : t));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#5A5A6E]">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading tasks…
      </div>
    );
  }

  return (
    <>
      {/* Mobile: vertical stacked columns; Desktop: horizontal scroll */}
      <div className="flex flex-col gap-4 md:flex-row md:gap-4 md:overflow-x-auto md:pb-4">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter(t => t.status === col.id);
          const isDragOver = dragOverColumn === col.id;

          return (
            <div
              key={col.id}
              className="w-full md:flex-shrink-0 md:w-[260px]"
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDrop={() => handleDrop(col.id)}
              onDragLeave={() => setDragOverColumn(null)}
            >
              <div className={`bg-[#12121A] border rounded-xl p-3 flex flex-col gap-2 transition-colors ${
                isDragOver ? "border-[#3B82F6] bg-[#3B82F608]" : "border-[#2A2A3A]"
              }`}>
                {/* Column Header */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
                    <span className="text-xs font-semibold text-white">{col.label}</span>
                    <span className="text-xs text-[#5A5A6E] bg-[#1A1A24] px-1.5 py-0.5 rounded">
                      {colTasks.length}
                    </span>
                  </div>
                  <button
                    onClick={() => { setEditingTask(undefined); setIsModalOpen(true); }}
                    className="text-[#5A5A6E] hover:text-white transition-colors p-1 rounded hover:bg-[#1A1A24]"
                  >
                    <Plus size={13} />
                  </button>
                </div>

                {/* Min height only on desktop */}
                <div className="flex flex-col gap-2 md:min-h-[300px]">
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task.id)}
                      className={`transition-opacity ${
                        draggedTaskId === task.id ? "opacity-40" : "opacity-100"
                      } ${savingId === task.id ? "animate-pulse" : ""}`}
                    >
                      <TaskCard
                        task={task}
                        onEdit={handleEditTask}
                        onDelete={handleDeleteTask}
                      />
                    </div>
                  ))}

                  {colTasks.length === 0 && (
                    <div className={`flex-1 flex items-center justify-center py-6 ${isDragOver ? "border-2 border-dashed border-[#3B82F6] rounded-lg" : ""}`}>
                      <div className="text-xs text-[#5A5A6E] text-center">
                        {isDragOver ? "📥 Drop here" : "No tasks"}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <TaskModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingTask(undefined); }}
        onSave={handleSaveTask}
        initialData={editingTask}
      />
    </>
  );
}
