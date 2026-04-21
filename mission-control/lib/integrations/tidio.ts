/**
 * Tidio REST API 集成 — FurMates 客服自动化
 *
 * 文档：https://tidio.com/panel/settings/developer
 *
 * 环境变量：
 * - TIDIO_PUBLIC_KEY   Tidio 公钥（Project Public Key）
 * - TIDIO_API_KEY      Tidio API 密钥（私钥，用于 REST API）
 *
 * 获取方式：Tidio 控制台 → Settings → Developer
 */

const TIDIO_BASE = "https://api.tidio.co";

// ==================== 类型定义 ====================

export interface TidioConversation {
  id:           string;
  status:       "open" | "solved" | "pending";
  created_at:   string;
  updated_at:   string;
  messages:     TidioMessage[];
  contact?:     TidioContact;
  assignee_id?: string;
  tags?:        string[];
}

export interface TidioMessage {
  id:         string;
  type:       "message" | "note" | "event";
  author:     { type: "visitor" | "operator"; name?: string };
  message:    string;
  created_at: string;
}

export interface TidioContact {
  id:         string;
  email?:     string;
  name?:      string;
  phone?:     string;
  tags?:      string[];
  attributes: Record<string, unknown>;
  created_at: string;
}

export interface TidioListConversationsParams {
  status?:   "open" | "solved" | "pending";
  limit?:    number;
  page?:     number;
  order_by?: "created_at" | "updated_at";
}

// ==================== 核心请求函数 ====================

async function tidioRequest<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const apiKey = process.env.TIDIO_API_KEY;
  if (!apiKey) throw new Error("TIDIO_API_KEY 未配置");

  const res = await fetch(`${TIDIO_BASE}${path}`, {
    method:  options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Token ${apiKey}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Tidio API ${res.status}: ${text}`);
  }

  // 204 No Content → return empty object
  const ct = res.headers.get("content-type") ?? "";
  if (res.status === 204 || !ct.includes("json")) return {} as T;

  return res.json() as Promise<T>;
}

// ==================== 对话操作 ====================

/**
 * 获取对话列表
 */
export async function listConversations(
  params: TidioListConversationsParams = {}
): Promise<{ conversations: TidioConversation[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.status)   qs.set("status",   params.status);
  if (params.limit)    qs.set("limit",    String(params.limit));
  if (params.page)     qs.set("page",     String(params.page));
  if (params.order_by) qs.set("order_by", params.order_by);

  const qstr = qs.toString();
  return tidioRequest(`/v1/conversations${qstr ? "?" + qstr : ""}`);
}

/**
 * 获取单条对话（含消息记录）
 */
export async function getConversation(
  conversationId: string
): Promise<TidioConversation> {
  return tidioRequest(`/v1/conversations/${conversationId}`);
}

/**
 * 以客服身份回复消息
 */
export async function sendMessage(
  conversationId: string,
  message: string
): Promise<TidioMessage> {
  return tidioRequest(`/v1/conversations/${conversationId}/messages`, {
    method: "POST",
    body: { message, type: "message" },
  });
}

/**
 * 关闭对话（标记为 solved）
 */
export async function closeConversation(
  conversationId: string
): Promise<void> {
  await tidioRequest(`/v1/conversations/${conversationId}`, {
    method: "PATCH",
    body:   { status: "solved" },
  });
}

/**
 * 重新打开对话
 */
export async function openConversation(
  conversationId: string
): Promise<void> {
  await tidioRequest(`/v1/conversations/${conversationId}`, {
    method: "PATCH",
    body:   { status: "open" },
  });
}

// ==================== 联系人操作 ====================

/**
 * 获取联系人列表
 */
export async function listContacts(
  params: { limit?: number; page?: number; email?: string } = {}
): Promise<{ contacts: TidioContact[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.page)  qs.set("page",  String(params.page));
  if (params.email) qs.set("email", params.email);
  const qstr = qs.toString();
  return tidioRequest(`/v1/contacts${qstr ? "?" + qstr : ""}`);
}

/**
 * 获取单个联系人
 */
export async function getContact(contactId: string): Promise<TidioContact> {
  return tidioRequest(`/v1/contacts/${contactId}`);
}

/**
 * 更新联系人标签或属性
 */
export async function updateContact(
  contactId: string,
  data: { tags?: string[]; attributes?: Record<string, unknown>; name?: string }
): Promise<TidioContact> {
  return tidioRequest(`/v1/contacts/${contactId}`, {
    method: "PATCH",
    body:   data,
  });
}

// ==================== 摘要工具 ====================

/**
 * 获取未回复对话摘要（用于 Agent 日报）
 */
export async function getPendingConversationsSummary(): Promise<{
  openCount:    number;
  pendingCount: number;
  topMessages:  Array<{ id: string; contact: string; preview: string; created_at: string }>;
}> {
  const [openResult, pendingResult] = await Promise.all([
    listConversations({ status: "open",    limit: 50 }).catch(() => ({ conversations: [], total: 0 })),
    listConversations({ status: "pending", limit: 50 }).catch(() => ({ conversations: [], total: 0 })),
  ]);

  const topMessages = [...openResult.conversations, ...pendingResult.conversations]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)
    .map(conv => {
      const lastMsg = conv.messages?.[conv.messages.length - 1];
      return {
        id:         conv.id,
        contact:    conv.contact?.email ?? conv.contact?.name ?? "Unknown",
        preview:    lastMsg?.message?.slice(0, 100) ?? "(无消息)",
        created_at: conv.created_at,
      };
    });

  return {
    openCount:    openResult.total,
    pendingCount: pendingResult.total,
    topMessages,
  };
}
