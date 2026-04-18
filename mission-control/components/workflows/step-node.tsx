"use client";

import { GripVertical, X, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { WorkflowStep, STEP_ICONS, AGENT_OPTIONS } from "@/lib/workflow-types";
import { cn } from "@/lib/utils";

interface StepNodeProps {
  step: WorkflowStep;
  index: number;
  total: number;
  onUpdate: (step: WorkflowStep) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  runStatus?: "pending" | "running" | "completed" | "failed" | "skipped";
}

const stepColors: Record<string, string> = {
  agent:       "border-[#3B82F6] bg-[#3B82F610]",
  http:        "border-[#8B5CF6] bg-[#8B5CF610]",
  wait:        "border-[#F59E0B] bg-[#F59E0B10]",
  condition:   "border-[#F97316] bg-[#F9731610]",
  notify:      "border-[#10B981] bg-[#10B98110]",
  create_task: "border-[#10B981] bg-[#10B98110]",
  log:         "border-[#5A5A6E] bg-[#5A5A6E10]",
  publish:     "border-[#EC4899] bg-[#EC489910]",
};

// 所有已注册渠道（与 registry 保持一致）
const ALL_CHANNELS = [
  { id: "telegram_channel", name: "Telegram",     icon: "✈️" },
  { id: "twitter",          name: "Twitter/X",    icon: "🐦" },
  { id: "linkedin",         name: "LinkedIn",     icon: "💼" },
  { id: "wordpress",        name: "WordPress",    icon: "📰" },
  { id: "wechat",           name: "微信公众号",    icon: "💬" },
  { id: "xiaohongshu",      name: "小红书",        icon: "📕" },
  { id: "youtube",          name: "YouTube",      icon: "▶️" },
  { id: "medium",           name: "Medium",       icon: "✍️" },
];

const runStatusStyles: Record<string, string> = {
  running:   "ring-2 ring-[#3B82F6] ring-offset-1 ring-offset-[#0A0A0F]",
  completed: "ring-2 ring-[#10B981] ring-offset-1 ring-offset-[#0A0A0F]",
  failed:    "ring-2 ring-[#EF4444] ring-offset-1 ring-offset-[#0A0A0F]",
};

export function StepNode({
  step, index, total, onUpdate, onDelete, onMoveUp, onMoveDown, runStatus,
}: StepNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const icon = STEP_ICONS[step.type] || "⚙️";
  const color = stepColors[step.type] || "border-[#2A2A3A]";

  return (
    <div className="flex items-start gap-2">
      {/* Step number + connector */}
      <div className="flex flex-col items-center gap-0 flex-shrink-0 pt-3">
        <div className="w-6 h-6 rounded-full bg-[#1A1A24] border border-[#2A2A3A] flex items-center justify-center text-xs text-[#8B8B9E] font-mono">
          {index + 1}
        </div>
        {index < total - 1 && (
          <div className="w-px h-4 bg-[#2A2A3A] mt-1" />
        )}
      </div>

      {/* Step Card */}
      <div
        className={cn(
          "flex-1 border rounded-lg transition-all duration-200",
          color,
          runStatus && runStatusStyles[runStatus]
        )}
      >
        <div className="flex items-center gap-2 p-3">
          {/* Drag handle */}
          <GripVertical size={14} className="text-[#5A5A6E] flex-shrink-0 cursor-grab" />

          {/* Icon */}
          <span className="text-base leading-none flex-shrink-0">{icon}</span>

          {/* Label */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">{step.label}</div>
            <div className="text-xs text-[#8B8B9E] truncate">
              {step.type === "agent" && `${AGENT_OPTIONS.find(a => a.id === step.agent)?.emoji || "🤖"} ${step.agent || "—"}: ${step.action || "—"}`}
              {step.type === "http" && `${step.method} ${step.url}`}
              {step.type === "wait" && `Wait ${step.delay} min`}
              {step.type === "notify" && `${step.channel}: ${step.message}`}
              {step.type === "log" && step.message}
              {step.type === "create_task" && step.action}
              {step.type === "condition" && step.condition}
              {step.type === "publish" && (() => {
                const chs = (step.publishChannels || []);
                const icons = chs.map(id => ALL_CHANNELS.find(c => c.id === id)?.icon || "📡").join(" ");
                return `${icons || "📡"} ${chs.length} 个渠道 · ${step.contentSource === "prev_output" ? "上一步输出" : "静态内容"}${step.requireApproval ? " · 需审核" : ""}`;
              })()}
            </div>
          </div>

          {/* Run status indicator */}
          {runStatus && (
            <div className={cn(
              "text-xs px-1.5 py-0.5 rounded flex-shrink-0",
              runStatus === "running" && "bg-[#3B82F615] text-[#3B82F6]",
              runStatus === "completed" && "bg-[#10B98115] text-[#10B981]",
              runStatus === "failed" && "bg-[#EF444415] text-[#EF4444]",
              runStatus === "pending" && "bg-[#2A2A3A] text-[#5A5A6E]",
            )}>
              {runStatus === "running" && "⟳ Running"}
              {runStatus === "completed" && "✓ Done"}
              {runStatus === "failed" && "✕ Failed"}
              {runStatus === "pending" && "○ Pending"}
            </div>
          )}

          {/* Actions */}
          {!runStatus && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => onMoveUp(step.id)} disabled={index === 0} className="text-[#5A5A6E] hover:text-white disabled:opacity-20 transition-colors p-0.5">
                <ChevronUp size={13} />
              </button>
              <button onClick={() => onMoveDown(step.id)} disabled={index === total - 1} className="text-[#5A5A6E] hover:text-white disabled:opacity-20 transition-colors p-0.5">
                <ChevronDown size={13} />
              </button>
              <button onClick={() => setExpanded(!expanded)} className="text-[#5A5A6E] hover:text-white transition-colors p-0.5">
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              <button onClick={() => onDelete(step.id)} className="text-[#5A5A6E] hover:text-[#EF4444] transition-colors p-0.5">
                <X size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Expanded config */}
        {expanded && !runStatus && (
          <div className="px-3 pb-3 border-t border-[#2A2A3A] mt-0 pt-3 space-y-2">
            <div>
              <label className="text-xs text-[#5A5A6E] mb-1 block">Label</label>
              <input
                value={step.label}
                onChange={e => onUpdate({ ...step, label: e.target.value })}
                className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#3B82F6]"
              />
            </div>

            {step.type === "agent" && (
              <>
                <div>
                  <label className="text-xs text-[#5A5A6E] mb-1 block">Agent</label>
                  <select
                    value={step.agent}
                    onChange={e => onUpdate({ ...step, agent: e.target.value })}
                    className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#3B82F6]"
                  >
                    {AGENT_OPTIONS.map(a => (
                      <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#5A5A6E] mb-1 block">Task / Prompt</label>
                  <textarea
                    value={step.action}
                    onChange={e => onUpdate({ ...step, action: e.target.value })}
                    rows={2}
                    className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#3B82F6] resize-none"
                  />
                </div>
              </>
            )}

            {step.type === "http" && (
              <>
                <div className="flex gap-2">
                  <select
                    value={step.method}
                    onChange={e => onUpdate({ ...step, method: e.target.value })}
                    className="bg-[#0A0A0F] border border-[#2A2A3A] rounded px-2 py-1 text-xs text-white focus:outline-none w-20"
                  >
                    {["GET","POST","PUT","PATCH","DELETE"].map(m => <option key={m}>{m}</option>)}
                  </select>
                  <input
                    value={step.url}
                    onChange={e => onUpdate({ ...step, url: e.target.value })}
                    placeholder="https://..."
                    className="flex-1 bg-[#0A0A0F] border border-[#2A2A3A] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
              </>
            )}

            {step.type === "wait" && (
              <div>
                <label className="text-xs text-[#5A5A6E] mb-1 block">Delay (minutes)</label>
                <input
                  type="number"
                  value={step.delay}
                  onChange={e => onUpdate({ ...step, delay: Number(e.target.value) })}
                  className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
            )}

            {step.type === "notify" && (
              <>
                <div>
                  <label className="text-xs text-[#5A5A6E] mb-1 block">Channel</label>
                  <select
                    value={step.channel}
                    onChange={e => onUpdate({ ...step, channel: e.target.value })}
                    className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded px-2 py-1 text-xs text-white focus:outline-none"
                  >
                    {["telegram","email","slack"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#5A5A6E] mb-1 block">Message</label>
                  <input
                    value={step.message}
                    onChange={e => onUpdate({ ...step, message: e.target.value })}
                    className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
              </>
            )}

            {(step.type === "log" || step.type === "create_task") && (
              <div>
                <label className="text-xs text-[#5A5A6E] mb-1 block">
                  {step.type === "log" ? "Message" : "Task Title"}
                </label>
                <input
                  value={step.type === "log" ? step.message : step.action}
                  onChange={e => onUpdate(
                    step.type === "log"
                      ? { ...step, message: e.target.value }
                      : { ...step, action: e.target.value }
                  )}
                  className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
            )}

            {step.type === "publish" && (
              <>
                {/* 渠道多选 */}
                <div>
                  <label className="text-xs text-[#5A5A6E] mb-2 block">发布渠道（可多选）</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ALL_CHANNELS.map(ch => {
                      const selected = (step.publishChannels || []).includes(ch.id);
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => {
                            const cur = step.publishChannels || [];
                            const next = selected
                              ? cur.filter(c => c !== ch.id)
                              : [...cur, ch.id];
                            onUpdate({ ...step, publishChannels: next });
                          }}
                          className={cn(
                            "flex items-center gap-1.5 px-2 py-1 rounded text-xs border transition-colors",
                            selected
                              ? "border-[#EC4899] bg-[#EC489920] text-white"
                              : "border-[#2A2A3A] text-[#8B8B9E] hover:border-[#3A3A4A]"
                          )}
                        >
                          <span>{ch.icon}</span>
                          <span className="truncate">{ch.name}</span>
                          {selected && <span className="ml-auto text-[#EC4899]">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 内容来源 */}
                <div>
                  <label className="text-xs text-[#5A5A6E] mb-1 block">内容来源</label>
                  <select
                    value={step.contentSource || "prev_output"}
                    onChange={e => onUpdate({ ...step, contentSource: e.target.value as WorkflowStep["contentSource"] })}
                    className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#EC4899]"
                  >
                    <option value="prev_output">上一步 Agent 输出</option>
                    <option value="static">静态内容（手动填写）</option>
                    <option value="agent_output">指定 Agent 输出</option>
                  </select>
                </div>

                {/* 静态内容 */}
                {step.contentSource === "static" && (
                  <div>
                    <label className="text-xs text-[#5A5A6E] mb-1 block">静态内容</label>
                    <textarea
                      value={step.message || ""}
                      onChange={e => onUpdate({ ...step, message: e.target.value })}
                      rows={3}
                      placeholder="输入要发布的内容..."
                      className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#EC4899] resize-none"
                    />
                  </div>
                )}

                {/* 内容类型 */}
                <div>
                  <label className="text-xs text-[#5A5A6E] mb-1 block">内容类型</label>
                  <select
                    value={step.contentType || "short_post"}
                    onChange={e => onUpdate({ ...step, contentType: e.target.value })}
                    className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#EC4899]"
                  >
                    <option value="short_post">短帖 (Short Post)</option>
                    <option value="article">长文 (Article)</option>
                    <option value="image_post">图文 (Image + Post)</option>
                    <option value="video_desc">视频描述</option>
                    <option value="thread">线程/系列</option>
                  </select>
                </div>

                {/* 开关选项 */}
                <div className="space-y-2">
                  {[
                    { key: "requireApproval", label: "发布前需要人工审核", desc: "内容存入 Content Calendar 等待确认" },
                    { key: "adaptContent",    label: "AI 自动适配各渠道格式", desc: "长度、标签、语调自动调整" },
                  ].map(opt => (
                    <label key={opt.key} className="flex items-start gap-2 cursor-pointer group">
                      <div className="relative mt-0.5">
                        <input
                          type="checkbox"
                          checked={!!(step[opt.key as keyof WorkflowStep])}
                          onChange={e => onUpdate({ ...step, [opt.key]: e.target.checked })}
                          className="sr-only"
                        />
                        <div className={cn(
                          "w-8 h-4 rounded-full transition-colors",
                          step[opt.key as keyof WorkflowStep] ? "bg-[#EC4899]" : "bg-[#2A2A3A]"
                        )}>
                          <div className={cn(
                            "w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform",
                            step[opt.key as keyof WorkflowStep] ? "translate-x-4" : "translate-x-0.5"
                          )} />
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-white">{opt.label}</div>
                        <div className="text-[10px] text-[#5A5A6E]">{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
