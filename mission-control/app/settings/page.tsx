"use client";

import { Header } from "@/components/layout/header";
import { useEffect, useState, useCallback } from "react";
import {
  Plus, Edit2, Archive, Key, Copy, EyeOff, Trash2, CheckCircle,
  Loader2, Radio, Zap, Settings2, ChevronDown, ChevronUp, FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────
const PROJECTS = [
  { name: "MiniAIPDF",    slug: "miniaipdf",    emoji: "📄", color: "#3B82F6", status: "active", description: "AI-powered PDF SaaS tool",        agents: ["Playfish","PM01","Admin01","DFM"] },
  { name: "FurMates",     slug: "furmales",     emoji: "🛒", color: "#10B981", status: "active", description: "Pet supplies e-commerce",          agents: ["Playfish","PM01","Admin01"] },
  { name: "NIW",          slug: "niw",          emoji: "📝", color: "#F59E0B", status: "active", description: "National Interest Waiver petition", agents: ["Playfish","Admin01"] },
  { name: "Talengineer",  slug: "talengineer",  emoji: "🔧", color: "#8B5CF6", status: "active", description: "Engineering talent matchmaker",    agents: ["Admin01"] },
  { name: "wheatcoin",    slug: "wheatcoin",    emoji: "🪙", color: "#F97316", status: "active", description: "Crypto community & SDK",           agents: ["DFM","Admin01"] },
  { name: "Dinnar",       slug: "dinnar",       emoji: "🏭", color: "#EF4444", status: "active", description: "Industrial operations",           agents: ["Playfish"] },
];

interface ApiKeyRecord {
  id: string; name: string; permissions: string;
  active: boolean; lastUsedAt: string | null; createdAt: string; key?: string;
}

interface ChannelRecord {
  id: string; name: string; icon: string; color: string;
  supportedTypes: string[]; requiresApproval: boolean; maxLength?: number;
  enabled: boolean; configured: boolean;
  testedAt: string | null; testResult: string | null;
}

type Tab = "projects" | "channels" | "ai" | "apikeys" | "system";

// ── Channel credential fields per channel ──────────────────────
const CHANNEL_FIELDS: Record<string, { key: string; label: string; placeholder: string; secret?: boolean }[]> = {
  telegram_channel: [
    { key: "botToken",   label: "Bot Token",   placeholder: "8574830800:AAH...", secret: true },
    { key: "channelId",  label: "Channel ID",  placeholder: "-100xxxxxxxxxx" },
  ],
  twitter: [
    { key: "bearerToken",    label: "Bearer Token",    placeholder: "AAAA...", secret: true },
    { key: "accessToken",    label: "Access Token",    placeholder: "...", secret: true },
    { key: "accessSecret",   label: "Access Secret",   placeholder: "...", secret: true },
  ],
  linkedin: [
    { key: "accessToken", label: "Access Token", placeholder: "AQX...", secret: true },
    { key: "personUrn",   label: "Person URN",   placeholder: "urn:li:person:xxx" },
  ],
  wordpress: [
    { key: "siteUrl",      label: "Site URL",       placeholder: "https://yourblog.com" },
    { key: "username",     label: "Username",        placeholder: "admin" },
    { key: "appPassword",  label: "App Password",    placeholder: "xxxx xxxx xxxx", secret: true },
  ],
  wechat: [
    { key: "appId",     label: "App ID",     placeholder: "wx..." },
    { key: "appSecret", label: "App Secret", placeholder: "...", secret: true },
  ],
  medium: [
    { key: "integrationToken", label: "Integration Token", placeholder: "...", secret: true },
    { key: "authorId",         label: "Author ID",         placeholder: "..." },
  ],
  youtube: [
    { key: "accessToken",  label: "OAuth Access Token", placeholder: "ya29...", secret: true },
  ],
};

// ── Channel Card ───────────────────────────────────────────────
function ChannelCard({ ch, onSave, onTest }: {
  ch: ChannelRecord;
  onSave: (id: string, enabled: boolean, creds: Record<string, string>) => Promise<void>;
  onTest: (id: string) => Promise<string>;
}) {
  const fields = CHANNEL_FIELDS[ch.id] || [];
  const [open,    setOpen]    = useState(false);
  const [creds,   setCreds]   = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState(ch.enabled);
  const [saving,  setSaving]  = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(ch.testResult);

  const save = async () => {
    setSaving(true);
    await onSave(ch.id, enabled, creds);
    setSaving(false);
    setOpen(false);
  };

  const test = async () => {
    setTesting(true);
    const result = await onTest(ch.id);
    setTestMsg(result);
    setTesting(false);
  };

  return (
    <div className={cn("bg-[#12121A] border rounded-xl overflow-hidden transition-colors",
      open ? "border-[#3B82F6]/50" : "border-[#2A2A3A]")}>
      {/* Header row */}
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
          style={{ backgroundColor: `${ch.color}20` }}>
          {ch.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white">{ch.name}</span>
            {ch.configured && ch.enabled && (
              <span className="text-xs bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded">已启用</span>
            )}
            {ch.configured && !ch.enabled && (
              <span className="text-xs bg-[#2A2A3A] text-[#8B8B9E] px-1.5 py-0.5 rounded">已配置</span>
            )}
            {!ch.configured && (
              <span className="text-xs bg-[#1A1A24] text-[#5A5A6E] px-1.5 py-0.5 rounded">预留</span>
            )}
          </div>
          <div className="text-xs text-[#5A5A6E] mt-0.5">
            {ch.supportedTypes.join(" · ")}
            {ch.maxLength ? ` · 最长 ${ch.maxLength} 字` : ""}
          </div>
        </div>
        {/* Toggle */}
        <div
          onClick={e => { e.stopPropagation(); setEnabled(v => !v); }}
          className={cn("w-9 h-5 rounded-full relative transition-colors flex-shrink-0",
            enabled ? "bg-[#10B981]" : "bg-[#2A2A3A]")}>
          <div className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all",
            enabled ? "right-0.5" : "left-0.5")} />
        </div>
        {open ? <ChevronUp size={14} className="text-[#5A5A6E]" /> : <ChevronDown size={14} className="text-[#5A5A6E]" />}
      </div>

      {/* Credential fields */}
      {open && (
        <div className="border-t border-[#2A2A3A] p-4 space-y-3">
          {fields.length === 0 ? (
            <p className="text-xs text-[#5A5A6E]">该渠道暂无官方 API，接口已预留，后续更新自动接入。</p>
          ) : (
            fields.map(f => (
              <div key={f.key}>
                <label className="text-xs text-[#8B8B9E] mb-1 block">{f.label}</label>
                <input
                  type={f.secret ? "password" : "text"}
                  value={creds[f.key] || ""}
                  onChange={e => setCreds(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#3A3A4E] focus:outline-none focus:border-[#3B82F6] font-mono"
                />
              </div>
            ))
          )}

          {/* Test result */}
          {testMsg && (
            <div className={cn("text-xs px-3 py-2 rounded-lg",
              testMsg === "ok" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400")}>
              {testMsg === "ok" ? "✓ 连接测试成功" : `✗ ${testMsg}`}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {fields.length > 0 && (
              <button onClick={test} disabled={testing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1A24] hover:bg-[#2A2A3A] text-[#8B8B9E] text-xs rounded-lg transition-colors">
                {testing ? <Loader2 size={11} className="animate-spin" /> : <FlaskConical size={11} />}
                测试连接
              </button>
            )}
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6] hover:bg-blue-500 text-white text-xs rounded-lg transition-colors ml-auto">
              {saving ? <Loader2 size={11} className="animate-spin" /> : null}
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Settings Page ─────────────────────────────────────────
export default function SettingsPage() {
  const [tab, setTab]         = useState<Tab>("channels");
  const [projects]            = useState(PROJECTS);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [channels, setChannels] = useState<ChannelRecord[]>([]);
  const [newKeyName, setNewKeyName]   = useState("");
  const [newKeyPerms, setNewKeyPerms] = useState("write");
  const [createdKey, setCreatedKey]   = useState<string | null>(null);
  const [copied, setCopied]           = useState(false);
  const [showForm, setShowForm]       = useState(false);

  useEffect(() => {
    fetch("/api/api-keys").then(r => r.ok ? r.json() : []).then(setApiKeys);
    fetch("/api/settings/channels").then(r => r.ok ? r.json() : []).then(setChannels);
  }, []);

  // API Keys
  const createKey = async () => {
    if (!newKeyName.trim()) return;
    const res = await fetch("/api/api-keys", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName, permissions: newKeyPerms }),
    });
    if (res.ok) {
      const data = await res.json();
      setCreatedKey(data.key);
      setApiKeys(prev => [data, ...prev]);
      setNewKeyName(""); setShowForm(false);
    }
  };
  const revokeKey = async (id: string) => {
    await fetch(`/api/api-keys/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: false }) });
    setApiKeys(prev => prev.map(k => k.id === id ? { ...k, active: false } : k));
  };
  const deleteKey = async (id: string) => {
    await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    setApiKeys(prev => prev.filter(k => k.id !== id));
  };
  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  // Channels
  const saveChannel = useCallback(async (channelId: string, enabled: boolean, creds: Record<string, string>) => {
    await fetch("/api/settings/channels", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId, enabled, credentials: creds }),
    });
    setChannels(prev => prev.map(c => c.id === channelId ? { ...c, enabled, configured: Object.keys(creds).length > 0 } : c));
  }, []);

  const testChannel = useCallback(async (channelId: string): Promise<string> => {
    const res = await fetch("/api/settings/channels", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId }),
    });
    const data = await res.json() as { ok: boolean; result?: string };
    return data.ok ? "ok" : (data.result || "failed");
  }, []);

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "channels",  label: "渠道",    icon: <Radio size={13} /> },
    { id: "ai",        label: "AI 引擎", icon: <Zap size={13} /> },
    { id: "apikeys",   label: "API Keys", icon: <Key size={13} /> },
    { id: "projects",  label: "项目",    icon: <Settings2 size={13} /> },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header title="Settings" subtitle="平台配置 · J.A.R.V.I.S." />

      <div className="p-4 md:p-6 max-w-3xl">
        {/* Tabs */}
        <div className="flex gap-1 bg-[#12121A] border border-[#2A2A3A] rounded-xl p-1 mb-6 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0",
                tab === t.id ? "bg-[#3B82F6] text-white" : "text-[#8B8B9E] hover:text-white"
              )}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── CHANNELS TAB ─────────────────────────────── */}
        {tab === "channels" && (
          <div className="space-y-3">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-white">发布渠道</h2>
              <p className="text-xs text-[#8B8B9E] mt-1">配置 API 凭证后即可在 Workflow 中使用该渠道发布内容</p>
            </div>
            {channels.map(ch => (
              <ChannelCard key={ch.id} ch={ch} onSave={saveChannel} onTest={testChannel} />
            ))}
          </div>
        )}

        {/* ── AI TAB ───────────────────────────────────── */}
        {tab === "ai" && (
          <div className="space-y-4">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-white">AI 引擎配置</h2>
              <p className="text-xs text-[#8B8B9E] mt-1">Workflow 中 Agent 步骤的 AI 驱动设置</p>
            </div>

            <div className="bg-[#12121A] border border-[#2A2A3A] rounded-xl divide-y divide-[#2A2A3A]">
              {[
                { label: "AI Provider",       value: "Anthropic Claude",           sub: "claude-haiku-4-5-20251001 (快速任务) · claude-sonnet-4-6 (内容创作)" },
                { label: "ANTHROPIC_API_KEY", value: "在 Vercel 环境变量中配置",    sub: "Settings → Environment Variables → ANTHROPIC_API_KEY" },
                { label: "默认模型",           value: "claude-haiku-4-5-20251001",  sub: "低延迟，适合大多数 Agent 任务" },
                { label: "降级策略",           value: "自动降级到模拟模式",           sub: "API Key 未配置时，Agent 返回预设示例输出" },
                { label: "Agents",             value: "Playfish · PM01 · DFM · Admin01 · PM01-B", sub: "各 Agent 拥有专属系统 Prompt 和能力范围" },
              ].map(item => (
                <div key={item.label} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-xs text-[#8B8B9E] flex-shrink-0 mt-0.5">{item.label}</span>
                    <div className="text-right">
                      <div className="text-xs text-white font-mono">{item.value}</div>
                      <div className="text-xs text-[#5A5A6E] mt-0.5">{item.sub}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <p className="text-xs text-blue-400 font-medium mb-1">如何配置 ANTHROPIC_API_KEY</p>
              <ol className="text-xs text-[#8B8B9E] space-y-1 list-decimal list-inside">
                <li>访问 <span className="text-white font-mono">console.anthropic.com</span> → API Keys</li>
                <li>创建新 Key，复制</li>
                <li>打开 Vercel → 你的项目 → Settings → Environment Variables</li>
                <li>添加 <span className="text-white font-mono">ANTHROPIC_API_KEY</span>，粘贴值，选择所有环境</li>
                <li>重新部署（Deployments → Redeploy）</li>
              </ol>
            </div>
          </div>
        )}

        {/* ── API KEYS TAB ─────────────────────────────── */}
        {tab === "apikeys" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">API Keys</h2>
                <p className="text-xs text-[#8B8B9E] mt-0.5">用于 Playfish Agent 和外部集成</p>
              </div>
              <button onClick={() => setShowForm(f => !f)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6] hover:bg-blue-600 text-white text-xs rounded-md transition-colors">
                <Plus size={13} /> New Key
              </button>
            </div>

            {createdKey && (
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                <p className="text-green-400 text-xs font-medium mb-2">✓ Key 已创建 — 请立即复制，不会再次显示</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-[#08080E] text-green-300 text-xs p-2 rounded-lg font-mono break-all">{createdKey}</code>
                  <button onClick={() => copyKey(createdKey)}
                    className="flex-shrink-0 p-2 rounded-lg bg-[#1A1A24] text-[#8B8B9E] hover:text-white transition-colors">
                    {copied ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                </div>
                <button onClick={() => setCreatedKey(null)} className="text-xs text-[#5A5A6E] mt-2 hover:text-white">关闭</button>
              </div>
            )}

            {showForm && (
              <div className="p-4 bg-[#12121A] border border-[#2A2A3A] rounded-xl space-y-3">
                <div className="flex gap-3 flex-wrap">
                  <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
                    placeholder="Key 名称 (如: Playfish Agent)"
                    className="flex-1 min-w-0 bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#5A5A6E] focus:outline-none focus:border-[#3B82F6]"
                  />
                  <select value={newKeyPerms} onChange={e => setNewKeyPerms(e.target.value)}
                    className="bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                    <option value="read">Read</option>
                    <option value="write">Write</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button onClick={createKey} className="px-4 py-2 bg-[#3B82F6] hover:bg-blue-600 text-white text-sm rounded-lg">Create</button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {apiKeys.length === 0 && (
                <div className="text-center py-8 text-[#5A5A6E] text-sm border border-dashed border-[#2A2A3A] rounded-xl">
                  <Key size={20} className="mx-auto mb-2 text-[#3A3A4E]" /> 暂无 API Key
                </div>
              )}
              {apiKeys.map(k => (
                <div key={k.id} className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-4 flex items-center gap-3">
                  <Key size={14} className={k.active ? "text-green-400" : "text-[#5A5A6E]"} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-white">{k.name}</span>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium",
                        k.permissions === "admin" ? "bg-red-500/15 text-red-400" :
                        k.permissions === "write" ? "bg-blue-500/15 text-blue-400" : "bg-[#2A2A3A] text-[#8B8B9E]")}>
                        {k.permissions}
                      </span>
                      {!k.active && <span className="text-xs bg-[#3A3A1A] text-[#F59E0B] px-1.5 py-0.5 rounded">已撤销</span>}
                    </div>
                    <div className="text-xs text-[#5A5A6E] mt-0.5">
                      创建于 {new Date(k.createdAt).toLocaleDateString("zh-CN")}
                      {k.lastUsedAt && ` · 最近使用 ${new Date(k.lastUsedAt).toLocaleDateString("zh-CN")}`}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {k.active && (
                      <button onClick={() => revokeKey(k.id)} className="p-1.5 rounded-md text-[#5A5A6E] hover:text-yellow-400 hover:bg-[#1A1A24] transition-colors" title="撤销">
                        <EyeOff size={13} />
                      </button>
                    )}
                    <button onClick={() => deleteKey(k.id)} className="p-1.5 rounded-md text-[#5A5A6E] hover:text-red-400 hover:bg-[#1A1A24] transition-colors" title="删除">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PROJECTS TAB ─────────────────────────────── */}
        {tab === "projects" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-white">项目管理</h2>
                <p className="text-xs text-[#8B8B9E] mt-0.5">管理你的项目组合</p>
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6] hover:bg-blue-600 text-white text-xs rounded-md transition-colors">
                <Plus size={13} /> 添加项目
              </button>
            </div>
            {projects.map(p => (
              <div key={p.slug} className="bg-[#12121A] border border-[#2A2A3A] rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                    style={{ backgroundColor: `${p.color}20` }}>{p.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white">{p.name}</span>
                      <span className="text-xs text-[#5A5A6E]">/{p.slug}</span>
                      <span className="text-xs bg-[#10B98115] text-[#10B981] px-1.5 py-0.5 rounded ml-auto">{p.status}</span>
                    </div>
                    <div className="text-xs text-[#8B8B9E] mt-0.5">{p.description}</div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {p.agents.map(a => (
                        <span key={a} className="text-xs bg-[#1A1A24] text-[#5A5A6E] px-2 py-0.5 rounded">{a}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button className="p-1.5 rounded-md text-[#5A5A6E] hover:text-white hover:bg-[#1A1A24]"><Edit2 size={13} /></button>
                    <button className="p-1.5 rounded-md text-[#5A5A6E] hover:text-yellow-400 hover:bg-[#1A1A24]"><Archive size={13} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
