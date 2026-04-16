"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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
}

const INITIAL_TASKS: Task[] = [
  {
    id: "1",
    title: "Launch Product Hunt campaign",
    description: "Prepare assets, schedule launch, monitor comments",
    status: "in_progress",
    priority: "urgent",
    projectName: "MiniAIPDF",
    projectColor: "#3B82F6",
    projectEmoji: "📄",
    agentName: "Playfish",
    agentEmoji: "🌾",
  },
  {
    id: "2",
    title: "Write 5 SEO blog posts",
    description: "Target keywords: pdf editor, compress pdf, merge pdf",
    status: "todo",
    priority: "high",
    projectName: "MiniAIPDF",
    projectColor: "#3B82F6",
    projectEmoji: "📄",
    agentName: "PM01",
    agentEmoji: "📝",
  },
  {
    id: "3",
    title: "Set up Shopify abandoned cart emails",
    status: "review",
    priority: "medium",
    projectName: "FurMates",
    projectColor: "#10B981",
    projectEmoji: "🛒",
    agentName: "Admin01",
    agentEmoji: "🔧",
  },
  {
    id: "4",
    title: "Update NIW petition letter",
    description: "Add recent publications and citations",
    status: "todo",
    priority: "high",
    projectName: "NIW",
    projectColor: "#F59E0B",
    projectEmoji: "📝",
    agentName: "Playfish",
    agentEmoji: "🌾",
  },
  {
    id: "5",
    title: "API documentation update",
    status: "done",
    priority: "medium",
    projectName: "MiniAIPDF",
    projectColor: "#3B82F6",
    projectEmoji: "📄",
    agentName: "PM01",
    agentEmoji: "📝",
  },
  {
    id: "6",
    title: "Fix checkout bug on mobile",
    status: "blocked",
    priority: "urgent",
    projectName: "FurMates",
    projectColor: "#10B981",
    projectEmoji: "🛒",
  },
  {
    id: "7",
    title: "Wheatcoin SDK v2 release notes",
    status: "in_progress",
    priority: "medium",
    projectName: "wheatcoin",
    projectColor: "#F97316",
    projectEmoji: "🪙",
    agentName: "DFM",
    agentEmoji: "📊",
  },
  {
    id: "8",
    title: "Design Talengineer landing page v2",
    status: "todo",
    priority: "low",
    projectName: "Talengineer",
    projectColor: "#8B5CF6",
    projectEmoji: "🔧",
  },
];

const COLUMNS = [
  { id: "todo", label: "To Do", color: "#8B8B9E" },
  { id: "in_progress", label: "In Progress", color: "#3B82F6" },
  { id: "review", label: "Review", color: "#F59E0B" },
  { id: "done", label: "Done", color: "#10B981" },
  { id: "blocked", label: "Blocked", color: "#EF4444" },
];

export function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleSaveTask = (data: Partial<Task>) => {
    if (editingTask) {
      setTasks(tasks.map((t) => (t.id === editingTask.id ? { ...t, ...data } : t)));
    } else {
      const newTask: Task = {
        id: Date.now().toString(),
        title: data.title || "",
        description: data.description,
        status: data.status || "todo",
        priority: data.priority || "medium",
        projectName: data.projectName,
        projectColor: data.projectColor,
      };
      setTasks([...tasks, newTask]);
    }
    setEditingTask(undefined);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleDragStart = (taskId: string) => {
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDrop = (columnId: string) => {
    if (draggedTaskId) {
      setTasks(
        tasks.map((t) =>
          t.id === draggedTaskId ? { ...t, status: columnId } : t
        )
      );
    }
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          const isDragOver = dragOverColumn === col.id;

          return (
            <div
              key={col.id}
              className="flex-shrink-0 w-[260px]"
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDrop={() => handleDrop(col.id)}
            >
              <div
                className={`bg-[#12121A] border rounded-lg p-3 min-h-[400px] flex flex-col gap-2 transition-colors ${
                  isDragOver
                    ? "border-[#3B82F6] bg-[#3B82F610]"
                    : "border-[#2A2A3A]"
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: col.color }}
                    />
                    <span className="text-xs font-semibold text-white">
                      {col.label}
                    </span>
                    <span className="text-xs text-[#5A5A6E] bg-[#1A1A24] px-1.5 rounded">
                      {colTasks.length}
                    </span>
                  </div>
                  {col.id === "todo" && (
                    <button
                      onClick={() => {
                        setEditingTask(undefined);
                        setIsModalOpen(true);
                      }}
                      className="text-[#5A5A6E] hover:text-white transition-colors"
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </div>

                {/* Task Cards */}
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task.id)}
                    className={draggedTaskId === task.id ? "opacity-50" : ""}
                  >
                    <TaskCard task={task} onEdit={handleEditTask} />
                  </div>
                ))}

                {colTasks.length === 0 && (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-xs text-[#5A5A6E] text-center">
                      {isDragOver ? "Drop here" : "No tasks"}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(undefined);
        }}
        onSave={handleSaveTask}
        initialData={editingTask}
      />
    </>
  );
}
