"use client";

// 黑球派活页面 — 在这里向黑球 Agent OS 派发任务并查看执行状态。
// 数据获取：TanStack Query 轮询 /api/admin/blackball/tasks（走 admin_token cookie 鉴权）
// 派活：POST 同一端点，由 middleware 鉴权，与其他 admin 页面一致。

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Loader2, CheckCircle2, XCircle, Clock, Zap, Send } from "lucide-react";

// ── 类型定义 ─────────────────────────────────────────────────────────────────

type TaskStatus = "pending" | "claimed" | "running" | "succeeded" | "failed" | "cancelled";

interface DelegatedTask {
  id:             string;
  title:          string;
  prompt:         string;
  targetDir:      string | null;
  status:         TaskStatus;
  blackballRunId: string | null;
  resultSummary:  string | null;
  errorMessage:   string | null;
  createdAt:      string;
  claimedAt:      string | null;
  completedAt:    string | null;
}

// ── 状态徽标 ──────────────────────────────────────────────────────────────────

// 每种状态对应不同颜色：
// pending=灰 / claimed+running=琥珀 / succeeded=绿 / failed+cancelled=红
const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  pending:   {
    label: "等待中",
    className: "text-[#8B8B9E] bg-[#8B8B9E]/10",
    icon: <Clock className="w-3 h-3" />,
  },
  claimed:   {
    label: "已领取",
    className: "text-[#EAB308] bg-[#EAB308]/10",
    icon: <Zap className="w-3 h-3" />,
  },
  running:   {
    label: "执行中",
    className: "text-[#F97316] bg-[#F97316]/10",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  succeeded: {
    label: "已完成",
    className: "text-[#10B981] bg-[#10B981]/10",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  failed:    {
    label: "失败",
    className: "text-[#EF4444] bg-[#EF4444]/10",
    icon: <XCircle className="w-3 h-3" />,
  },
  cancelled: {
    label: "已取消",
    className: "text-[#EF4444] bg-[#EF4444]/10",
    icon: <XCircle className="w-3 h-3" />,
  },
};

function StatusBadge({ status }: { status: TaskStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.className}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ── 时间格式化 ────────────────────────────────────────────────────────────────

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit",  minute: "2-digit",
  });
}

// ── 派活表单组件 ──────────────────────────────────────────────────────────────

function DispatchForm({ onSuccess }: { onSuccess: () => void }) {
  // 表单状态：标题、任务描述、可选工作目录
  const [title,     setTitle]     = useState("");
  const [prompt,    setPrompt]    = useState("");
  const [targetDir, setTargetDir] = useState("");
  const [errMsg,    setErrMsg]    = useState("");

  // useMutation：提交后自动刷新任务列表
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/blackball/tasks", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          title,
          prompt,
          // 工作目录为空时不传（后端存 null）
          ...(targetDir.trim() ? { targetDir: targetDir.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "提交失败");
      return json;
    },
    onSuccess: () => {
      // 清空表单，通知父组件刷新列表
      setTitle("");
      setPrompt("");
      setTargetDir("");
      setErrMsg("");
      onSuccess();
    },
    onError: (err: Error) => {
      setErrMsg(err.message);
    },
  });

  const canSubmit = title.trim() && prompt.trim() && !mutation.isPending;

  return (
    <div className="bg-[#12121A] border border-[#2A2A3A] rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white">派发新任务给黑球</h2>

      {/* 标题 */}
      <div className="space-y-1.5">
        <label className="text-xs text-[#8B8B9E]">任务标题 *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例：分析 kele-quant 最新回测结果"
          className="w-full px-3 py-2 rounded-lg bg-[#0A0A0F] border border-[#2A2A3A] text-sm text-white placeholder-[#555566] focus:outline-none focus:border-[#3B82F6] transition-colors"
        />
      </div>

      {/* 任务描述 */}
      <div className="space-y-1.5">
        <label className="text-xs text-[#8B8B9E]">任务描述 *</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="详细描述你希望黑球执行的任务，可以包括目标、约束条件、期望输出格式等…"
          rows={5}
          className="w-full px-3 py-2 rounded-lg bg-[#0A0A0F] border border-[#2A2A3A] text-sm text-white placeholder-[#555566] focus:outline-none focus:border-[#3B82F6] transition-colors resize-y"
        />
      </div>

      {/* 可选工作目录 */}
      <div className="space-y-1.5">
        <label className="text-xs text-[#8B8B9E]">工作目录（可选）</label>
        <input
          type="text"
          value={targetDir}
          onChange={(e) => setTargetDir(e.target.value)}
          placeholder="例：~/code/kele-quant（留空则黑球自行决定）"
          className="w-full px-3 py-2 rounded-lg bg-[#0A0A0F] border border-[#2A2A3A] text-sm text-white placeholder-[#555566] focus:outline-none focus:border-[#3B82F6] transition-colors font-mono text-xs"
        />
      </div>

      {/* 错误信息 */}
      {errMsg && (
        <p className="text-xs text-red-400">{errMsg}</p>
      )}

      {/* 提交按钮 */}
      <button
        onClick={() => mutation.mutate()}
        disabled={!canSubmit}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            提交中…
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            派活给黑球
          </>
        )}
      </button>

      {/* 成功提示 */}
      {mutation.isSuccess && (
        <p className="text-xs text-[#10B981] text-center">
          ✓ 任务已派出，黑球下次轮询时会自动领取
        </p>
      )}
    </div>
  );
}

// ── 任务卡片组件 ──────────────────────────────────────────────────────────────

function TaskCard({ task }: { task: DelegatedTask }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[#12121A] border border-[#2A2A3A] rounded-xl p-4 space-y-3 hover:border-[#3B3B4A] transition-colors">
      {/* 标题行 */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-white leading-snug">{task.title}</p>
        <StatusBadge status={task.status} />
      </div>

      {/* 时间信息 */}
      <div className="flex items-center gap-4 text-[10px] text-[#555566] flex-wrap">
        <span>派出：{fmtTime(task.createdAt)}</span>
        {task.claimedAt   && <span>领取：{fmtTime(task.claimedAt)}</span>}
        {task.completedAt && <span>完成：{fmtTime(task.completedAt)}</span>}
        {task.blackballRunId && (
          <span className="font-mono">
            RunID: {task.blackballRunId.slice(0, 12)}
            {task.blackballRunId.length > 12 ? "…" : ""}
          </span>
        )}
      </div>

      {/* 工作目录 */}
      {task.targetDir && (
        <p className="text-[11px] text-[#555566] font-mono bg-[#0A0A0F] px-2 py-1 rounded-md truncate">
          📁 {task.targetDir}
        </p>
      )}

      {/* 结果摘要 */}
      {task.resultSummary && (
        <div className="text-xs text-[#8B8B9E] bg-[#10B981]/5 border border-[#10B981]/20 rounded-lg p-3 leading-relaxed">
          <span className="text-[#10B981] font-medium">结果：</span>
          {task.resultSummary}
        </div>
      )}

      {/* 错误信息 */}
      {task.errorMessage && (
        <div className="text-xs text-[#8B8B9E] bg-[#EF4444]/5 border border-[#EF4444]/20 rounded-lg p-3 leading-relaxed">
          <span className="text-[#EF4444] font-medium">错误：</span>
          {task.errorMessage}
        </div>
      )}

      {/* 展开查看任务描述 */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-[10px] text-[#555566] hover:text-[#8B8B9E] transition-colors"
      >
        {expanded ? "收起描述 ▲" : "查看描述 ▼"}
      </button>
      {expanded && (
        <pre className="text-[11px] text-[#8B8B9E] bg-[#0A0A0F] rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
          {task.prompt}
        </pre>
      )}
    </div>
  );
}

// ── 任务列表组件 ──────────────────────────────────────────────────────────────

function TaskList() {
  const { data, isLoading, error } = useQuery<{ ok: boolean; tasks: DelegatedTask[] }>({
    queryKey: ["blackball-tasks"],
    queryFn:  async () => {
      const res = await fetch("/api/admin/blackball/tasks");
      return res.json();
    },
    // 每 30 秒自动刷新，与项目其他页面保持一致
    refetchInterval: 30_000,
  });

  const tasks = data?.tasks ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-[#12121A] border border-[#2A2A3A] animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-400 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg p-4">
        加载失败：{(error as Error).message}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[#555566]">
        <span className="text-4xl mb-3">⚫</span>
        <p className="text-sm">暂无任务记录</p>
        <p className="text-xs mt-1 text-[#3A3A4A]">填写左侧表单，派出第一个任务</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  );
}

// ── 主页面 ────────────────────────────────────────────────────────────────────

export default function BlackballPage() {
  const qc = useQueryClient();

  // 派活成功后立即刷新任务列表
  const handleDispatchSuccess = () => {
    qc.invalidateQueries({ queryKey: ["blackball-tasks"] });
  };

  // 统计 running/pending 数量用于副标题
  const { data } = useQuery<{ ok: boolean; tasks: DelegatedTask[] }>({
    queryKey: ["blackball-tasks"],
    queryFn:  async () => {
      const res = await fetch("/api/admin/blackball/tasks");
      return res.json();
    },
    refetchInterval: 30_000,
  });
  const tasks   = data?.tasks ?? [];
  const running = tasks.filter((t) => t.status === "running" || t.status === "claimed").length;
  const pending = tasks.filter((t) => t.status === "pending").length;

  const subtitle =
    tasks.length === 0
      ? "黑球 Agent OS · 任务调度"
      : `${tasks.length} 条任务${running > 0 ? ` · ${running} 执行中` : ""}${pending > 0 ? ` · ${pending} 等待` : ""}`;

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header title="⚫ 黑球" subtitle={subtitle} />

      <div className="p-4 md:p-6">
        {/* 响应式两栏：大屏左侧派活表单（1/3），右侧任务列表（2/3） */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* 左侧：派活表单 */}
          <div className="lg:col-span-1">
            <DispatchForm onSuccess={handleDispatchSuccess} />

            {/* 使用说明 */}
            <div className="mt-4 bg-[#12121A] border border-[#2A2A3A] rounded-xl p-4 space-y-2">
              <p className="text-xs font-medium text-[#8B8B9E]">使用说明</p>
              <ul className="text-xs text-[#555566] space-y-1.5 leading-relaxed">
                <li>• 派出任务后，黑球 worker 每隔几秒轮询一次，自动领取 pending 任务</li>
                <li>• 状态：<span className="text-[#8B8B9E]">等待中</span> → <span className="text-[#EAB308]">已领取</span> → <span className="text-[#F97316]">执行中</span> → <span className="text-[#10B981]">已完成</span></li>
                <li>• 页面每 30 秒自动刷新，也可点击右上角刷新按钮</li>
                <li>• 失败任务会显示错误原因，供排查</li>
              </ul>
            </div>
          </div>

          {/* 右侧：任务列表 */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">任务记录</h2>
              <span className="text-xs text-[#555566]">每 30 秒自动刷新</span>
            </div>
            <TaskList />
          </div>

        </div>
      </div>
    </div>
  );
}
