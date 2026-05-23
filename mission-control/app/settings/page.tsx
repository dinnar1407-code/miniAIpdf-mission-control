"use client";

import { Header } from "@/components/layout/header";
import { useT } from "@/lib/i18n";
import { useEffect, useState, useCallback } from "react";
import {
  Plus, Edit2, Archive, Key, Copy, EyeOff, Trash2, CheckCircle,
  Loader2, Radio, Zap, Settings2, ChevronDown, ChevronUp, FlaskConical, Plug,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────
const PROJECTS = [
  { name: "MiniAIPDF",    slug: "miniaipdf",    emoji: "📄", color: "#3B82F6", status: "active", description: "AI-powered PDF SaaS tool",        agents: ["Wheat.AI","PM01","Admin01","DFM"] },
  { name: "FurMates",     slug: "furmales",     emoji: "🛒", color: "#10B981", status: "active", description: "Pet supplies e-commerce",          agents: ["Wheat.AI","PM01","Admin01"] },
  { name: "NIW",          slug: "niw",          emoji: "📝", color: "#F59E0B", status: "active", description: "National Interest Waiver petition", agents: ["Wheat.AI","Admin01"] },
  { name: "Talengineer",  slug: "talengineer",  emoji: "🔧", color: "#8B5CF6", status: "active", description: "Engineering talent matchmaker",    agents: ["Admin01"] },
  { name: "wheatcoin",    slug: "wheatcoin",    emoji: "🪙", color: "#F97316", status: "active", description: "Crypto community & SDK",           agents: ["DFM","Admin01"] },
  { name: "Dinnar",       slug: "dinnar",       emoji: "🏭", color: "#EF4444", status: "active", description: "Industrial operations",           agents: ["Wheat.AI"] },
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
  defaults?: Record<string, unknown>;
}

type Tab = "projects" | "channels" | "integrations" | "ai" | "apikeys";

// ── Channel credential fields per channel ──────────────────────
const CHANNEL_FIELDS: Record<string, { key: string; label: string; placeholder: string; secret?: boolean }[]> = {
  telegram_channel: [
    { key: "botToken",   label: "Bot Token",   placeholder: "8574830800:AAH...", secret: true },
    { key: "channelId",  label: "Channel ID",  placeholder: "-100xxxxxxxxxx" },
  ],
  twitter: [
    { key: "apiKey",         label: "API Key (Consumer Key)",     placeholder: "xQeGQbc0...", secret: true },
    { key: "apiSecret",      label: "API Secret (Consumer Secret)", placeholder: "DSiaWzhK...", secret: true },
    { key: "accessToken",    label: "Access Token",               placeholder: "202292569...", secret: true },
    { key: "accessSecret",   label: "Access Secret",              placeholder: "TCV2nnw...", secret: true },
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

// ── Integration Config ─────────────────────────────────────────
type IntegDescKey = "integStripe" | "integGsc" | "integGa" | "integTelegram" | "integTwitter" | "integWordpress";

interface Integration {
  id: string;
  name: string;
  icon: string;
  priority: "P0" | "P1";
  descKey: IntegDescKey;
  envVars: string[];
  webhookUrl?: string;
  docsUrl: string;
}

// Integration id → i18n key mapping (populated after useT() is available)
const INTEGRATION_BASE = [
  {
    id: "stripe",
    name: "Stripe",
    icon: "💳",
    priority: "P0" as const,
    descKey: "integStripe" as const,
    envVars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    webhookUrl: "/api/webhooks/stripe",
    docsUrl: "https://dashboard.stripe.com/webhooks",
  },
  {
    id: "gsc",
    name: "Google Search Console",
    icon: "🔍",
    priority: "P0" as const,
    descKey: "integGsc" as const,
    envVars: ["GOOGLE_SERVICE_ACCOUNT_KEY", "GSC_SITE_URL"],
    docsUrl: "https://search.google.com/search-console",
  },
  {
    id: "ga",
    name: "Google Analytics 4",
    icon: "📊",
    priority: "P0" as const,
    descKey: "integGa" as const,
    envVars: ["GOOGLE_SERVICE_ACCOUNT_KEY", "GA_PROPERTY_ID"],
    docsUrl: "https://analytics.google.com",
  },
  {
    id: "telegram",
    name: "Telegram Bot",
    icon: "✈️",
    priority: "P0" as const,
    descKey: "integTelegram" as const,
    envVars: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "TELEGRAM_WEBHOOK_SECRET"],
    webhookUrl: "/api/webhooks/telegram",
    docsUrl: "https://t.me/BotFather",
  },
  {
    id: "twitter",
    name: "Twitter / X",
    icon: "𝕏",
    priority: "P1" as const,
    descKey: "integTwitter" as const,
    envVars: ["TWITTER_API_KEY", "TWITTER_API_SECRET", "TWITTER_ACCESS_TOKEN", "TWITTER_ACCESS_SECRET"],
    docsUrl: "https://developer.twitter.com",
  },
  {
    id: "wordpress",
    name: "WordPress",
    icon: "📰",
    priority: "P1" as const,
    descKey: "integWordpress" as const,
    envVars: ["WORDPRESS_SITE_URL", "WORDPRESS_USERNAME", "WORDPRESS_APP_PASSWORD"],
    docsUrl: "https://wordpress.org/documentation/article/application-passwords",
  },
];

// ── Channel Card ───────────────────────────────────────────────
function ChannelCard({ ch, onSave, onTest }: {
  ch: ChannelRecord;
  onSave: (id: string, enabled: boolean, creds: Record<string, string>, defaults: Record<string, unknown>) => Promise<void>;
  onTest: (id: string) => Promise<string>;
}) {
  const t = useT();
  const fields = CHANNEL_FIELDS[ch.id] || [];
  const [open,     setOpen]     = useState(false);
  const [creds,    setCreds]    = useState<Record<string, string>>({});
  const [enabled,  setEnabled]  = useState(ch.enabled);
  const [language, setLanguage] = useState<"auto" | "zh" | "en">(
    (ch.defaults?.language as "auto" | "zh" | "en") ?? "auto"
  );
  const [thumbMediaId, setThumbMediaId] = useState<string>((ch.defaults?.defaultThumbMediaId as string) ?? "");
  const [materials, setMaterials] = useState<{ media_id: string; name: string; url: string }[]>([]);
  const [loadingMat, setLoadingMat] = useState(false);
  const [matError, setMatError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(ch.testResult);

  const save = async () => {
    setSaving(true);
    const extra = ch.id === "wechat" ? { defaultThumbMediaId: thumbMediaId } : {};
    await onSave(ch.id, enabled, creds, { language, ...extra });
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
              <span className="text-xs bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded">{t.settingsChannelEnabled}</span>
            )}
            {ch.configured && !ch.enabled && (
              <span className="text-xs bg-[#2A2A3A] text-[#8B8B9E] px-1.5 py-0.5 rounded">{t.settingsChannelConfigured}</span>
            )}
            {!ch.configured && (
              <span className="text-xs bg-[#1A1A24] text-[#5A5A6E] px-1.5 py-0.5 rounded">{t.settingsChannelReserved}</span>
            )}
          </div>
          <div className="text-xs text-[#5A5A6E] mt-0.5">
            {ch.supportedTypes.join(" · ")}
            {ch.maxLength ? ` · ${t.settingsMaxLength(ch.maxLength)}` : ""}
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
            <p className="text-xs text-[#5A5A6E]">{t.settingsNoFields}</p>
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

          {/* WeChat: default thumb media ID */}
          {ch.id === "wechat" && (
            <div>
              <label className="text-xs text-[#8B8B9E] mb-1 block">默认封面图 Media ID</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={thumbMediaId}
                  onChange={e => setThumbMediaId(e.target.value)}
                  placeholder="从微信素材库获取（可选）"
                  className="flex-1 bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#3A3A4E] focus:outline-none focus:border-[#3B82F6] font-mono"
                />
                <button
                  onClick={async () => {
                    setLoadingMat(true);
                    setMatError(null);
                    setShowPicker(false);
                    try {
                      const res = await fetch("/api/settings/channels/wechat/materials");
                      const data = await res.json() as { items?: { media_id: string; name: string; url: string }[]; error?: string };
                      if (data.error) { setMatError(data.error); }
                      else { setMaterials(data.items ?? []); setShowPicker(true); }
                    } catch { setMatError("请求失败"); }
                    setLoadingMat(false);
                  }}
                  disabled={loadingMat}
                  className="flex-shrink-0 px-3 py-2 bg-[#1A1A24] hover:bg-[#2A2A3A] text-[#8B8B9E] text-xs rounded-lg transition-colors whitespace-nowrap"
                >
                  {loadingMat ? <Loader2 size={11} className="animate-spin inline" /> : "查询素材库"}
                </button>
              </div>
              {matError && <p className="text-[10px] text-red-400 mt-1">{matError}</p>}
              {showPicker && materials.length === 0 && (
                <p className="text-[10px] text-[#5A5A6E] mt-1">素材库暂无图片</p>
              )}
              {showPicker && materials.length > 0 && (
                <div className="mt-2 grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                  {materials.map(m => (
                    <button
                      key={m.media_id}
                      onClick={() => { setThumbMediaId(m.media_id); setShowPicker(false); }}
                      title={m.name}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                        thumbMediaId === m.media_id ? "border-[#3B82F6]" : "border-[#2A2A3A] hover:border-[#3B82F6]/50"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-[#5A5A6E] mt-1">发布草稿无封面图时自动使用此图。</p>
            </div>
          )}

          {/* Language setting */}
          <div>
            <label className="text-xs text-[#8B8B9E] mb-1 block">{t.settingsChannelLang}</label>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value as "auto" | "zh" | "en")}
              className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3B82F6]"
            >
              <option value="auto">{t.settingsChannelLangAuto}</option>
              <option value="zh">{t.settingsChannelLangZh}</option>
              <option value="en">{t.settingsChannelLangEn}</option>
            </select>
          </div>

          {/* Test result */}
          {testMsg && (
            <div className={cn("text-xs px-3 py-2 rounded-lg",
              testMsg === "ok" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400")}>
              {testMsg === "ok" ? t.settingsTestOk : `✗ ${testMsg}`}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {fields.length > 0 && (
              <button onClick={test} disabled={testing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1A24] hover:bg-[#2A2A3A] text-[#8B8B9E] text-xs rounded-lg transition-colors">
                {testing ? <Loader2 size={11} className="animate-spin" /> : <FlaskConical size={11} />}
                {t.testConnection}
              </button>
            )}
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6] hover:bg-blue-500 text-white text-xs rounded-lg transition-colors ml-auto">
              {saving ? <Loader2 size={11} className="animate-spin" /> : null}
              {t.save}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Integration Card ──────────────────────────────────────────
function IntegrationCard({ integration }: { integration: Integration }) {
  const t = useT();
  const [configStatus, setConfigStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    // Load integration status
    fetch("/api/settings/integrations/status")
      .then(r => r.ok ? r.json() : {})
      .then((data: Record<string, { configured: boolean }>) => {
        const status: Record<string, boolean> = {};
        integration.envVars.forEach(envVar => {
          // Check if integration is configured
          status[envVar] = data[integration.id]?.configured || false;
        });
        setConfigStatus(status);
        setLoading(false);
      })
      .catch(() => {
        const status: Record<string, boolean> = {};
        integration.envVars.forEach(envVar => {
          status[envVar] = false;
        });
        setConfigStatus(status);
        setLoading(false);
      });
  }, [integration.id, integration.envVars]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div className="bg-[#12121A] border border-[#2A2A3A] rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: "#3B82F6" + "20" }}>
          {integration.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white">{integration.name}</span>
            <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium",
              integration.priority === "P0" ? "bg-red-500/15 text-red-400" : "bg-yellow-500/15 text-yellow-400")}>
              {integration.priority}
            </span>
          </div>
          <p className="text-xs text-[#8B8B9E] mt-0.5">{t[integration.descKey] as string}</p>
        </div>
      </div>

      {/* Environment Variables */}
      <div className="space-y-2">
        <p className="text-xs text-[#8B8B9E] font-medium">{t.settingsRequired}</p>
        {integration.envVars.map(envVar => (
          <div key={envVar} className="flex items-center gap-2 p-2 bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg">
            <code className="text-xs text-[#8B8B9E] font-mono flex-1 truncate">{envVar}</code>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {loading ? (
                <Loader2 size={12} className="text-[#5A5A6E] animate-spin" />
              ) : (
                <span className="text-xs text-[#5A5A6E]">
                  {configStatus[envVar] ? <span className="text-green-400">{t.settingsConnConfigured}</span> : <span className="text-[#5A5A6E]">{t.settingsConnMissing}</span>}
                </span>
              )}
              <button onClick={() => copyToClipboard(envVar)}
                className="p-1 rounded text-[#5A5A6E] hover:text-white hover:bg-[#1A1A24] transition-colors">
                {copied === envVar ? <CheckCircle size={12} className="text-green-400" /> : <Copy size={12} />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Webhook URL */}
      {integration.webhookUrl && (
        <div className="space-y-2">
          <p className="text-xs text-[#8B8B9E] font-medium">{t.settingsWebhookUrl}</p>
          <div className="flex items-center gap-2 p-2 bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg">
            <code className="text-xs text-[#8B8B9E] font-mono flex-1 truncate">{integration.webhookUrl}</code>
            <button onClick={() => copyToClipboard(integration.webhookUrl!)}
              className="p-1 rounded text-[#5A5A6E] hover:text-white hover:bg-[#1A1A24] transition-colors">
              {copied === integration.webhookUrl ? <CheckCircle size={12} className="text-green-400" /> : <Copy size={12} />}
            </button>
          </div>
        </div>
      )}

      {/* Documentation Link */}
      <a href={integration.docsUrl} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1A24] hover:bg-[#2A2A3A] text-[#8B8B9E] text-xs rounded-lg transition-colors">
        📖 {t.settingsViewDocs}
      </a>
    </div>
  );
}

// ── Telegram Notify Card ───────────────────────────────────────
function TelegramNotifyCard() {
  const t = useT();
  const [botToken, setBotToken] = useState("");
  const [chatId,   setChatId]   = useState("");
  const [enabled,  setEnabled]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [testing,  setTesting]  = useState(false);
  const [testMsg,  setTestMsg]  = useState<string | null>(null);

  // 加载已保存的配置状态（不加载 token 值，保持密文）
  useEffect(() => {
    fetch("/api/settings/notify")
      .then(r => r.ok ? r.json() : {})
      .then((data: { enabled?: boolean; configured?: boolean }) => {
        if (data.enabled !== undefined) setEnabled(data.enabled);
      });
  }, []);

  const save = async () => {
    setSaving(true);
    await fetch("/api/settings/notify", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, botToken, chatId }),
    });
    setSaving(false);
    setTestMsg(null);
  };

  const test = async () => {
    setTesting(true);
    try {
      const res = await fetch("https://api.telegram.org/bot" + botToken + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "🤖 *Jarvis Mission Control* — Telegram 通知测试成功 ✅",
          parse_mode: "Markdown",
        }),
      });
      setTestMsg(res.ok ? "ok" : t.settingsTelegramTestFail);
    } catch {
      setTestMsg(t.settingsNetworkError);
    }
    setTesting(false);
  };

  return (
    <div className="bg-[#12121A] border border-[#2A2A3A] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">✈️</span>
          <div>
            <div className="text-sm font-medium text-white">{t.settingsTelegramTitle}</div>
            <div className="text-xs text-[#8B8B9E]">{t.settingsTelegramDesc}</div>
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <div className="relative">
            <input type="checkbox" className="sr-only" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
            <div className={cn("w-9 h-5 rounded-full transition-colors", enabled ? "bg-[#3B82F6]" : "bg-[#2A2A3A]")}>
              <div className={cn("w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform", enabled ? "translate-x-4" : "translate-x-0.5")} />
            </div>
          </div>
          <span className="text-xs text-[#8B8B9E]">{enabled ? t.enabled : t.disabled}</span>
        </label>
      </div>

      <div className="space-y-2">
        <div>
          <label className="text-xs text-[#8B8B9E] mb-1 block">Bot Token</label>
          <input
            type="password"
            value={botToken}
            onChange={e => setBotToken(e.target.value)}
            placeholder="8574830800:AAH..."
            className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#3A3A4E] focus:outline-none focus:border-[#3B82F6] font-mono"
          />
        </div>
        <div>
          <label className="text-xs text-[#8B8B9E] mb-1 block">Chat ID</label>
          <input
            type="text"
            value={chatId}
            onChange={e => setChatId(e.target.value)}
            placeholder="123456789"
            className="w-full bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#3A3A4E] focus:outline-none focus:border-[#3B82F6] font-mono"
          />
          <p className="text-xs text-[#5A5A6E] mt-1">{t.settingsTelegramChatIdHint}</p>
        </div>
      </div>

      {testMsg && (
        <div className={cn("text-xs px-3 py-2 rounded-lg",
          testMsg === "ok" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400")}>
          {testMsg === "ok" ? t.settingsTelegramTestOk : `✗ ${testMsg}`}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={test} disabled={testing || !botToken || !chatId}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1A24] hover:bg-[#2A2A3A] text-[#8B8B9E] text-xs rounded-lg transition-colors disabled:opacity-40">
          {testing ? <Loader2 size={11} className="animate-spin" /> : <FlaskConical size={11} />}
          {t.sendTest}
        </button>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6] hover:bg-blue-500 text-white text-xs rounded-lg transition-colors ml-auto">
          {saving ? <Loader2 size={11} className="animate-spin" /> : null}
          {t.save}
        </button>
      </div>
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
  const saveChannel = useCallback(async (channelId: string, enabled: boolean, creds: Record<string, string>, defaults: Record<string, unknown> = {}) => {
    await fetch("/api/settings/channels", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId, enabled, credentials: creds, defaults }),
    });
    setChannels(prev => prev.map(c => c.id === channelId ? { ...c, enabled, configured: Object.keys(creds).length > 0, defaults } : c));
  }, []);

  const testChannel = useCallback(async (channelId: string): Promise<string> => {
    const res = await fetch("/api/settings/channels", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId }),
    });
    const data = await res.json() as { ok: boolean; result?: string };
    return data.ok ? "ok" : (data.result || "failed");
  }, []);

  const t = useT();

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "channels",      label: t.settingsTabChannels,     icon: <Radio size={13} /> },
    { id: "integrations",  label: t.settingsTabIntegrations, icon: <Plug size={13} /> },
    { id: "ai",            label: t.settingsTabAI,           icon: <Zap size={13} /> },
    { id: "apikeys",       label: t.settingsTabApiKeys,      icon: <Key size={13} /> },
    { id: "projects",      label: t.settingsTabProjects,     icon: <Settings2 size={13} /> },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-20 md:pb-0">
      <Header title="Settings" subtitle={t.settingsSubtitle} />

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
              <h2 className="text-sm font-semibold text-white">{t.settingsChannelsTitle}</h2>
              <p className="text-xs text-[#8B8B9E] mt-1">{t.settingsChannelsDesc}</p>
            </div>
            {channels.map(ch => (
              <ChannelCard key={ch.id} ch={ch} onSave={saveChannel} onTest={testChannel} />
            ))}
          </div>
        )}

        {/* ── INTEGRATIONS TAB ─────────────────────────────── */}
        {tab === "integrations" && (
          <div className="space-y-4">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-white">{t.settingsIntegrationsTitle}</h2>
              <p className="text-xs text-[#8B8B9E] mt-1">{t.settingsIntegrationsDesc}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {INTEGRATION_BASE.map(integration => (
                <IntegrationCard key={integration.id} integration={integration} />
              ))}
            </div>
          </div>
        )}

        {/* ── AI TAB ───────────────────────────────────── */}
        {tab === "ai" && (
          <div className="space-y-4">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-white">{t.settingsAITitle}</h2>
              <p className="text-xs text-[#8B8B9E] mt-1">{t.settingsAIDesc}</p>
            </div>

            {/* Telegram Notification */}
            <TelegramNotifyCard />

            <div className="bg-[#12121A] border border-[#2A2A3A] rounded-xl divide-y divide-[#2A2A3A]">
              {[
                { label: t.settingsAIProvider,       value: "Anthropic Claude",                        sub: t.settingsAIRow1Sub },
                { label: "ANTHROPIC_API_KEY",        value: t.settingsAIApiKeyConfig,                  sub: "Settings → Environment Variables → ANTHROPIC_API_KEY" },
                { label: t.settingsAIDefaultModel,   value: "claude-haiku-4-5-20251001",               sub: t.settingsAIDefaultModelSub },
                { label: t.settingsAIFallback,       value: t.settingsAIFallbackValue,                 sub: t.settingsAIFallbackSub },
                { label: t.settingsAIAgents,         value: "Wheat.AI · PM01 · DFM · Admin01 · PM01-B", sub: t.settingsAIAgentsSub },
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
              <p className="text-xs text-blue-400 font-medium mb-1">{t.settingsAnthropicHow}</p>
              <ol className="text-xs text-[#8B8B9E] space-y-1 list-decimal list-inside">
                <li>{t.settingsAIStep1}</li>
                <li>{t.settingsAIStep2}</li>
                <li>{t.settingsAIStep3}</li>
                <li>{t.settingsAIStep4}</li>
                <li>{t.settingsAIStep5}</li>
              </ol>
            </div>
          </div>
        )}

        {/* ── API KEYS TAB ─────────────────────────────── */}
        {tab === "apikeys" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">{t.settingsApiKeysTab}</h2>
                <p className="text-xs text-[#8B8B9E] mt-0.5">{t.settingsApiKeyDesc}</p>
              </div>
              <button onClick={() => setShowForm(f => !f)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6] hover:bg-blue-600 text-white text-xs rounded-md transition-colors">
                <Plus size={13} /> {t.settingsNewKey}
              </button>
            </div>

            {createdKey && (
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                <p className="text-green-400 text-xs font-medium mb-2">{t.settingsKeyCreated}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-[#08080E] text-green-300 text-xs p-2 rounded-lg font-mono break-all">{createdKey}</code>
                  <button onClick={() => copyKey(createdKey)}
                    className="flex-shrink-0 p-2 rounded-lg bg-[#1A1A24] text-[#8B8B9E] hover:text-white transition-colors">
                    {copied ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                </div>
                <button onClick={() => setCreatedKey(null)} className="text-xs text-[#5A5A6E] mt-2 hover:text-white">{t.close}</button>
              </div>
            )}

            {showForm && (
              <div className="p-4 bg-[#12121A] border border-[#2A2A3A] rounded-xl space-y-3">
                <div className="flex gap-3 flex-wrap">
                  <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
                    placeholder={t.settingsKeyNamePlaceholder}
                    className="flex-1 min-w-0 bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#5A5A6E] focus:outline-none focus:border-[#3B82F6]"
                  />
                  <select value={newKeyPerms} onChange={e => setNewKeyPerms(e.target.value)}
                    className="bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                    <option value="read">{t.settingsRead}</option>
                    <option value="write">{t.settingsWrite}</option>
                    <option value="admin">{t.settingsAdmin}</option>
                  </select>
                  <button onClick={createKey} className="px-4 py-2 bg-[#3B82F6] hover:bg-blue-600 text-white text-sm rounded-lg">{t.settingsCreate}</button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {apiKeys.length === 0 && (
                <div className="text-center py-8 text-[#5A5A6E] text-sm border border-dashed border-[#2A2A3A] rounded-xl">
                  <Key size={20} className="mx-auto mb-2 text-[#3A3A4E]" /> {t.settingsNoApiKeys}
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
                      {!k.active && <span className="text-xs bg-[#3A3A1A] text-[#F59E0B] px-1.5 py-0.5 rounded">{t.settingsRevokedBadge}</span>}
                    </div>
                    <div className="text-xs text-[#5A5A6E] mt-0.5">
                      {t.settingsCreatedAt} {new Date(k.createdAt).toLocaleDateString()}
                      {k.lastUsedAt && ` ${t.settingsLastUsed} ${new Date(k.lastUsedAt).toLocaleDateString()}`}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {k.active && (
                      <button onClick={() => revokeKey(k.id)} className="p-1.5 rounded-md text-[#5A5A6E] hover:text-yellow-400 hover:bg-[#1A1A24] transition-colors" title={t.settingsRevoke}>
                        <EyeOff size={13} />
                      </button>
                    )}
                    <button onClick={() => deleteKey(k.id)} className="p-1.5 rounded-md text-[#5A5A6E] hover:text-red-400 hover:bg-[#1A1A24] transition-colors" title="Delete">
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
                <h2 className="text-sm font-semibold text-white">{t.settingsProjectsTitle}</h2>
                <p className="text-xs text-[#8B8B9E] mt-0.5">{t.settingsProjectsDesc}</p>
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6] hover:bg-blue-600 text-white text-xs rounded-md transition-colors">
                <Plus size={13} /> {t.settingsAddProject}
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
