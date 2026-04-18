"use client";

import { Header } from "@/components/layout/header";
import { useEffect, useState, useCallback } from "react";
import {
  RefreshCw, Loader2, CheckCircle, Clock, XCircle,
  Send, ChevronDown, ChevronUp, ThumbsUp, Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ContentItem {
  id: string; title: string; body: string;
  channelIds: string; contentType: string; status: string;
  scheduledFor: string | null; publishedAt: string | null;
  publishResults: string; workflowRunId: string | null; createdAt: string;
}

const CHANNEL_META: Record<string, { icon: string; name: string }> = {
  telegram_channel: { icon: "✈️", name: "Telegram" },
  twitter:          { icon: "𝕏",  name: "Twitter" },
  linkedin:         { icon: "💼", name: "LinkedIn" },
  wordpress:        { icon: "📝", name: "WordPress" },
  wechat:           { icon: "💬", name: "微信公众号" },
  xiaohongshu:      { icon: "📕", name: "小红书" },
  youtube:          { icon: "▶️", name: "YouTube" },
  medium:           { icon: "📖", name: "Medium" },
};

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
  draft:     { icon: <Clock size={11} />,       label: "草稿",   cls: "text-[#8B8B9E] bg-[#2A2A3A]" },
  approved:  { icon: <CheckCircle size={11} />, label: "已审批", cls: "text-blue-400 bg-blue-400/10" },
  published: { icon: <CheckCircle size={11} />, label: "已发布", cls: "text-green-400 bg-green-400/10" },
  failed:    { icon: <XCircle size={11} />,     label: "失败",   cls: "text-red-400 bg-red-400/10" },
  scheduled: { icon: <Clock size={11} />,       label: "待发布", cls: "text-yellow-400 bg-yellow-400/10" },
};

const TYPE_LABELS: Record<string, string> = {
  short_post: "短帖", long_post: "长文", article: "博客",
  thread: "推文串", video: "视频", image_post: "图文", link_share: "链接",
};

const FILTERS = ["all", "draft", "approved", "scheduled", "published", "failed"] as const;
type FilterType = typeof FILTERS[number];

export default function ContentPage() {
  const [items,    setItems]    = useState<ContentItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<FilterType>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [acting,   setActing]   = useState<Record<string, "approving" | "publishing">>({});

  const load = useCallback(async (status: string) => {
    setLoading(true);
    const qs = status !== "all" ? `?status=${status}` : "";
    try {
      const res  = await fetch(`/api/content${qs}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch { setItems([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(filter); }, [filter, load]);

  const getChannels = (item: ContentItem) => {
    try { return JSON.parse(item.channelIds) as string[]; } catch { return []; }
  };
  const getResults = (item: ContentItem) => {
    try { return JSON.parse(item.publishResults) as Record<string, { success: boolean; postUrl?: string; error?: string }>; }
    catch { return {}; }
  };

  // 审核通过（draft → approved）
  const approveItem = async (id: string) => {
    setActing(a => ({ ...a, [id]: "approving" }));
    await fetch(`/api/content/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    await load(filter);
    setActing(a => { const n = { ...a }; delete n[id]; return n; });
  };

  // 立即发布（approved → published）
  const publishItem = async (id: string) => {
    setActing(a => ({ ...a, [id]: "publishing" }));
    try {
      await fetch(`/api/content/${id}/publish`, { method: "POST" });
    } catch {}
    await load(filter);
    setActing(a => { const n = { ...a }; delete n[id]; return n; });
  };

  const stats = {
    total:     items.length,
    published: items.filter(i => i.status === "published").length,
    scheduled: items.filter(i => i.status === "scheduled").length,
    draft:     items.filter(i => i.status === "draft").length,
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header title="Content Calendar" subtitle="全媒体矩阵 · 发布管理" />
      <div className="p-4 md:p-6 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: "总内容",  count: stats.total,     color: "#8B5CF6" },
            { label: "已发布",  count: stats.published, color: "#10B981" },
            { label: "待发布",  count: stats.scheduled, color: "#F59E0B" },
            { label: "草稿",    count: stats.draft,     color: "#8B8B9E" },
          ].map(s => (
            <div key={s.label} className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-3 text-center">
              <div className="text-xl font-bold" style={{ color: s.color }}>{s.count}</div>
              <div className="text-xs text-[#8B8B9E] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-[#12121A] border border-[#2A2A3A] rounded-xl p-1 overflow-x-auto scrollbar-none">
          {FILTERS.map(tab => (
            <button key={tab} onClick={() => setFilter(tab)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0",
                filter === tab ? "bg-[#3B82F6] text-white" : "text-[#8B8B9E] hover:text-white"
              )}>
              {tab === "all" ? "全部" : (STATUS_CONFIG[tab]?.label ?? tab)}
            </button>
          ))}
          <button onClick={() => load(filter)}
            className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-[#5A5A6E] hover:text-white hover:bg-[#1A1A24] flex-shrink-0">
            <RefreshCw size={11} />
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#5A5A6E]">
            <Loader2 size={18} className="animate-spin mr-2" /> 加载中…
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-[#2A2A3A] rounded-xl">
            <Send size={24} className="mx-auto mb-3 text-[#3A3A4E]" />
            <p className="text-[#8B8B9E] text-sm mb-1">暂无内容</p>
            <p className="text-[#5A5A6E] text-xs">
              运行带有 📡 Publish 步骤的 Workflow 后，内容会自动出现在这里
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(item => {
              const isExp     = expanded === item.id;
              const chs       = getChannels(item);
              const results   = getResults(item);
              const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
              const isActing  = !!acting[item.id];

              return (
                <div key={item.id} className="bg-[#12121A] border border-[#2A2A3A] rounded-xl overflow-hidden hover:border-[#3A3A4A] transition-colors">
                  {/* Header row */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => setExpanded(isExp ? null : item.id)}
                      >
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-medium text-white truncate">{item.title || "无标题"}</span>
                          <span className="text-xs text-[#5A5A6E] bg-[#1A1A24] px-1.5 py-0.5 rounded flex-shrink-0">
                            {TYPE_LABELS[item.contentType] ?? item.contentType}
                          </span>
                        </div>
                        <p className="text-xs text-[#8B8B9E] line-clamp-2 mb-2">{item.body}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {chs.map(ch => {
                            const m = CHANNEL_META[ch];
                            return m ? (
                              <span key={ch} className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-[#1A1A24] text-[#8B8B9E]">
                                {m.icon} <span className="hidden sm:inline">{m.name}</span>
                              </span>
                            ) : null;
                          })}
                          <span className="text-xs text-[#5A5A6E]">
                            · {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                          </span>
                        </div>
                      </div>

                      {/* Right: status + action buttons */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium",
                            statusCfg.cls
                          )}>
                            {statusCfg.icon} {statusCfg.label}
                          </span>
                          <button
                            onClick={() => setExpanded(isExp ? null : item.id)}
                            className="text-[#5A5A6E]"
                          >
                            {isExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-1.5">
                          {item.status === "draft" && (
                            <button
                              onClick={() => approveItem(item.id)}
                              disabled={isActing}
                              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                            >
                              {acting[item.id] === "approving"
                                ? <Loader2 size={10} className="animate-spin" />
                                : <ThumbsUp size={10} />
                              }
                              审核通过
                            </button>
                          )}

                          {(item.status === "approved" || item.status === "failed") && (
                            <button
                              onClick={() => publishItem(item.id)}
                              disabled={isActing}
                              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-[#EC4899]/10 text-[#EC4899] border border-[#EC4899]/30 hover:bg-[#EC4899]/20 transition-colors disabled:opacity-50"
                            >
                              {acting[item.id] === "publishing"
                                ? <Loader2 size={10} className="animate-spin" />
                                : <Rocket size={10} />
                              }
                              立即发布
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded panel */}
                  {isExp && (
                    <div className="border-t border-[#2A2A3A] p-4 bg-[#0E0E16] space-y-3">
                      {/* Full body */}
                      <div className="bg-[#12121A] rounded-lg p-3">
                        <p className="text-xs text-[#C0C0D0] whitespace-pre-wrap leading-relaxed">{item.body}</p>
                      </div>

                      {/* Publish results */}
                      {Object.keys(results).length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs text-[#8B8B9E] font-medium">发布结果</p>
                          {Object.entries(results).map(([chId, r]) => {
                            const m = CHANNEL_META[chId];
                            return (
                              <div key={chId} className="flex items-center gap-2 text-xs">
                                <span>{m?.icon ?? "📡"}</span>
                                <span className="text-[#8B8B9E]">{m?.name ?? chId}</span>
                                {r.success ? (
                                  <>
                                    <CheckCircle size={11} className="text-green-400 flex-shrink-0" />
                                    {r.postUrl && (
                                      <a
                                        href={r.postUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:underline truncate max-w-[200px]"
                                      >
                                        {r.postUrl}
                                      </a>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <XCircle size={11} className="text-red-400 flex-shrink-0" />
                                    {r.error && <span className="text-red-400/70 truncate">{r.error}</span>}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Timestamps */}
                      <div className="flex gap-4 text-xs text-[#5A5A6E] flex-wrap">
                        <span>创建：{new Date(item.createdAt).toLocaleString("zh-CN")}</span>
                        {item.scheduledFor && (
                          <span>计划：{new Date(item.scheduledFor).toLocaleString("zh-CN")}</span>
                        )}
                        {item.publishedAt && (
                          <span>发布：{new Date(item.publishedAt).toLocaleString("zh-CN")}</span>
                        )}
                        {item.workflowRunId && (
                          <span>来源：Workflow Run</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
