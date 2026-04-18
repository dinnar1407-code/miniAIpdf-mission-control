"use client";

import { Header } from "@/components/layout/header";
import { useState, useEffect, useCallback } from "react";
import { Play, Pause, RefreshCw, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// 静态配置：emoji / 显示名 / 类型（DB 无 emoji，前端补充）
const AGENT_META: Record<string, { emoji: string; displayType: string }> = {
  playfish: { emoji: "🌾", displayType: "CEO Agent" },
  pm01:     { emoji: "📝", displayType: "Content Agent" },
  "pm01-b": { emoji: "📝", displayType: "Content Agent B" },
  admin01:  { emoji: "🔧", displayType: "Operations Agent" },
  dfm:      { emoji: "📊", displayType: "Data & Finance Agent" },
};

function getEmoji(name: string) {
  const key = name.toLowerCase().replace(/\s/g, "").replace("-", "-");
  return AGENT_META[key]?.emoji ?? "🤖";
}
function getDisplayType(name: string, dbType: string) {
  const key = name.toLowerCase().replace(/\s/g, "");
  return AGENT_META[key]?.displayType ?? dbType;
}

function timeAgo(date: string | Date) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "刚刚";
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

interface AgentData {
  id:              string;
  name:            string;
  type:            string;
  status:          string;
  currentTask:     string | null;
  lastActiveAt:    string;
  projects:        string[];
  tasksCompleted:  number;
  contentPublished: number;
  recentActivity:  { action: string; target: string | null; result: string | null; timestamp: string }[];
}

interface GlobalStats {
  totalWorkflowRunsThisWeek: number;
  completedRunsThisWeek:     number;
  publishedContent:          number;
  recentRuns:                { id: string; status: string; name: string }[];
}

export default function AgentsPage() {
  const [agents,       setAgents]       = useState<AgentData[]>([]);
  const [globalStats,  setGlobalStats]  = useState<GlobalStats | null>(null);
  const [selected,     setSelected]     = useState<AgentData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [toggling,     setToggling]     = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res  = await fetch("/api/agents/stats");
      const data = await res.json();
      if (data.agents) {
        setAgents(data.agents);
        setGlobalStats(data.globalStats);
        // 同步 selected（若已选中）
        setSelected(prev => prev ? data.agents.find((a: AgentData) => a.id === prev.id) ?? prev : null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // 每 30 秒轮询一次
    const t = setInterval(fetchStats, 30000);
    return () => clearInterval(t);
  }, [fetchStats]);

  const toggleStatus = async (agent: AgentData) => {
    setToggling(agent.id);
    const newStatus = agent.status === "active" ? "idle" : "active";
    try {
      await fetch(`/api/agents/${agent.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: newStatus }),
      });
      await fetchStats();
    } finally {
      setToggling(null);
    }
  };

  const activeCount = agents.filter(a => a.status === "active").length;
  const totalTasks  = agents.reduce((s, a) => s + a.tasksCompleted, 0);
  const totalContent = agents.reduce((s, a) => s + a.contentPublished, 0);

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header title="Agents" subtitle="AI 智能体管理" />

      <div className="p-4 md:p-6 space-y-6">
        {/* 全局统计 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "活跃 Agent",    value: loading ? "—" : `${activeCount}/${agents.length}`, icon: "🟢" },
            { label: "累计完成任务",  value: loading ? "—" : totalTasks,                        icon: "✅" },
            { label: "内容已发布",    value: loading ? "—" : (globalStats?.publishedContent ?? totalContent), icon: "📄" },
            { label: "本周 Workflow", value: loading ? "—" : (globalStats?.completedRunsThisWeek ?? 0),       icon: "⚡" },
          ].map(stat => (
            <div key={stat.label} className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-3 md:p-4">
              <div className="text-xl md:text-2xl mb-1">{stat.icon}</div>
              <div className="text-lg md:text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-[#5A5A6E] mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent 列表 */}
          <div className="lg:col-span-2 space-y-4">
            {loading ? (
              <div className="text-center py-16 text-[#5A5A6E]">
                <RefreshCw size={24} className="mx-auto mb-2 animate-spin" />
                <p className="text-sm">加载中...</p>
              </div>
            ) : agents.length === 0 ? (
              <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-8 text-center">
                <div className="text-3xl mb-2">🤖</div>
                <div className="text-sm text-[#8B8B9E] mb-1">还没有 Agent 数据</div>
                <div className="text-xs text-[#5A5A6E]">运行一次 Workflow 后，Agent 记录会自动创建</div>
              </div>
            ) : (
              agents.map(agent => {
                const emoji = getEmoji(agent.name);
                const displayType = getDisplayType(agent.name, agent.type);
                const isToggling = toggling === agent.id;
                return (
                  <div
                    key={agent.id}
                    className={cn(
                      "bg-[#12121A] border rounded-lg p-4 cursor-pointer transition-all duration-200",
                      selected?.id === agent.id
                        ? "border-[#3B82F6]"
                        : "border-[#2A2A3A] hover:border-[#3A3A4A]"
                    )}
                    onClick={() => setSelected(agent)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <div className="w-12 h-12 bg-[#1A1A24] rounded-xl flex items-center justify-center text-2xl">
                          {emoji}
                        </div>
                        <div className={cn(
                          "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#12121A]",
                          agent.status === "active" ? "bg-[#10B981] animate-pulse" : "bg-[#5A5A6E]"
                        )} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-white">{agent.name}</span>
                              <span className={cn(
                                "text-xs px-1.5 py-0.5 rounded flex-shrink-0",
                                agent.status === "active"
                                  ? "bg-[#10B98115] text-[#10B981]"
                                  : "bg-[#2A2A3A] text-[#5A5A6E]"
                              )}>
                                {agent.status}
                              </span>
                            </div>
                            <div className="text-xs text-[#8B8B9E]">{displayType}</div>
                          </div>

                          <button
                            onClick={(e) => { e.stopPropagation(); toggleStatus(agent); }}
                            disabled={isToggling}
                            className="p-1.5 rounded-md bg-[#1A1A24] hover:bg-[#2A2A3A] text-[#8B8B9E] hover:text-white transition-colors flex-shrink-0 disabled:opacity-50"
                            title={agent.status === "active" ? "暂停" : "激活"}
                          >
                            {isToggling
                              ? <RefreshCw size={13} className="animate-spin" />
                              : agent.status === "active" ? <Pause size={13} /> : <Play size={13} />
                            }
                          </button>
                        </div>

                        {/* 当前任务 */}
                        {agent.currentTask ? (
                          <div className="mt-2 text-xs text-[#8B8B9E] bg-[#1A1A24] rounded-md px-3 py-2 flex items-start gap-1.5">
                            <Zap size={11} className="text-[#F59E0B] flex-shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{agent.currentTask}</span>
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-[#5A5A6E] bg-[#1A1A24] rounded-md px-3 py-2">
                            空闲 — 等待任务
                          </div>
                        )}

                        {/* 统计行 */}
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5A5A6E]">
                          <span>✅ {agent.tasksCompleted} 任务</span>
                          <span>📄 {agent.contentPublished} 内容</span>
                          <span className="ml-auto">{timeAgo(agent.lastActiveAt)}</span>
                        </div>

                        {/* 项目标签 */}
                        {agent.projects.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {agent.projects.map(p => (
                              <span key={p} className="text-xs bg-[#1A1A24] text-[#8B8B9E] px-2 py-0.5 rounded">
                                {p}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 右侧详情面板 */}
          <div className="space-y-4">
            {selected ? (
              <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-4 sticky top-20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-3xl">{getEmoji(selected.name)}</div>
                  <div>
                    <div className="font-semibold text-white">{selected.name}</div>
                    <div className="text-xs text-[#8B8B9E]">{getDisplayType(selected.name, selected.type)}</div>
                  </div>
                </div>

                {/* 统计卡片 */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { label: "完成任务", value: selected.tasksCompleted },
                    { label: "已发内容", value: selected.contentPublished },
                  ].map(s => (
                    <div key={s.label} className="bg-[#0A0A0F] rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-white">{s.value}</div>
                      <div className="text-xs text-[#5A5A6E]">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* 近期活动 */}
                <div>
                  <div className="text-xs text-[#5A5A6E] mb-2 font-medium uppercase tracking-wider">
                    近期活动
                  </div>
                  {selected.recentActivity.length > 0 ? (
                    <div className="space-y-2">
                      {selected.recentActivity.map((item, i) => (
                        <div key={i} className="flex gap-2 text-xs">
                          <span className="text-[#5A5A6E] flex-shrink-0">{timeAgo(item.timestamp)}</span>
                          <div className="min-w-0">
                            <span className="text-[#8B8B9E]">{item.action}</span>
                            {item.target && (
                              <span className="text-[#5A5A6E] block truncate">→ {item.target}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-[#5A5A6E] italic">暂无活动记录</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-8 flex items-center justify-center text-center">
                <div>
                  <div className="text-3xl mb-2">🤖</div>
                  <div className="text-sm text-[#8B8B9E]">点击 Agent 卡片查看详情</div>
                </div>
              </div>
            )}

            {/* 本周 Workflow 运行记录 */}
            {globalStats && globalStats.recentRuns.length > 0 && (
              <div className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-4">
                <div className="text-xs text-[#5A5A6E] mb-3 font-medium uppercase tracking-wider">
                  最近 Workflow 运行
                </div>
                <div className="space-y-2">
                  {globalStats.recentRuns.map(run => (
                    <div key={run.id} className="flex items-center gap-2 text-xs">
                      <span className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        run.status === "completed" ? "bg-[#10B981]" :
                        run.status === "running"   ? "bg-[#3B82F6] animate-pulse" :
                        run.status === "failed"    ? "bg-[#EF4444]" : "bg-[#5A5A6E]"
                      )} />
                      <span className="text-[#8B8B9E] truncate flex-1">{run.name}</span>
                      <span className={cn(
                        "flex-shrink-0",
                        run.status === "completed" ? "text-[#10B981]" :
                        run.status === "failed"    ? "text-[#EF4444]" : "text-[#5A5A6E]"
                      )}>
                        {run.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
