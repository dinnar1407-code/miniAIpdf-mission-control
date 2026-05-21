// 微信公众号 — 完整发布流程
// 支持：纯文字图文 / 带封面图图文 / 草稿模式 / 群发模式
import { BaseChannelAdapter } from "./base";
import { ChannelConfig, PublishContent, PublishResult } from "../types";

// access_token 模块级缓存（key = appId）— 用于 getAccessToken()
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

// 微信 API 基址
const WX_BASE = "https://api.weixin.qq.com";

// ── Access Token ──────────────────────────────────────────────

interface WxTokenResponse {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

async function getAccessToken(appId: string, appSecret: string): Promise<string> {
  const cached = tokenCache.get(appId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const url = `${WX_BASE}/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
  const res = await fetch(url).catch(() => {
    throw new Error("获取 access_token 失败：网络请求错误");
  });
  if (!res.ok) {
    throw new Error(`获取 access_token 失败：HTTP ${res.status}`);
  }
  const data = (await res.json()) as WxTokenResponse;

  if (!data.access_token) {
    throw new Error(`获取 access_token 失败：[${data.errcode}] ${data.errmsg}`);
  }

  // 提前 5 分钟刷新，避免边界过期
  tokenCache.set(appId, {
    token: data.access_token,
    expiresAt: Date.now() + ((data.expires_in ?? 7200) - 300) * 1000,
  });

  return data.access_token;
}

// 仅供单元测试使用
export const _testOnly_tokenCache = tokenCache;
export const _testOnly_getAccessToken = getAccessToken;

// ── 内容格式化 ─────────────────────────────────────────────────

export interface WxArticle {
  title: string;
  author: string;
  content: string;
  digest: string;
  thumb_media_id: string;
  need_open_comment: number;
  only_fans_can_comment: number;
}

function buildArticle(
  content: PublishContent,
  defaults: Record<string, unknown>,
  thumbMediaId: string
): WxArticle {
  return {
    title: content.title ?? "无标题",
    author: typeof defaults.author === "string" ? defaults.author : "",
    content: content.body,
    digest: (content.summary ?? content.body).slice(0, 120),
    thumb_media_id: thumbMediaId,
    need_open_comment: 0,
    only_fans_can_comment: 0,
  };
}

export const _testOnly_buildArticle = buildArticle;

// ── 封面图上传 ─────────────────────────────────────────────────

interface WxMediaUploadResponse {
  type?: string;
  media_id?: string;
  created_at?: number;
  errcode?: number;
  errmsg?: string;
}

async function uploadThumbMedia(imageUrl: string, accessToken: string): Promise<string> {
  // 微信不接受外部 URL，需先下载图片到内存
  const imgRes = await fetch(imageUrl).catch(() => {
    throw new Error(`封面图下载失败：网络请求错误`);
  });
  if (!imgRes.ok) {
    throw new Error(`封面图下载失败：HTTP ${imgRes.status}`);
  }
  const imgBuffer = await imgRes.arrayBuffer();
  // 从响应头推断 MIME 类型，兜底 image/jpeg（微信要求有效的图片类型）
  const contentType = imgRes.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  const imgBlob = new Blob([imgBuffer], { type: contentType });

  // 从 URL 推断文件名（取最后一段，默认 cover.jpg）
  const fileName = imageUrl.split("/").pop()?.split("?")[0] || "cover.jpg";

  const form = new FormData();
  form.append("media", imgBlob, fileName);

  const url = `${WX_BASE}/cgi-bin/media/upload?access_token=${accessToken}&type=thumb`;
  const res = await fetch(url, { method: "POST", body: form }).catch(() => {
    throw new Error("封面图上传失败：网络请求错误");
  });
  if (!res.ok) {
    throw new Error(`封面图上传失败：HTTP ${res.status}`);
  }
  const data = (await res.json()) as WxMediaUploadResponse;

  if (!data.media_id) {
    throw new Error(`封面图上传失败：[${data.errcode}] ${data.errmsg}`);
  }

  return data.media_id;
}

// ── 草稿 ───────────────────────────────────────────────────────

interface WxDraftAddResponse {
  media_id?: string;
  errcode?: number;
  errmsg?: string;
}

async function addDraft(article: WxArticle, accessToken: string): Promise<string> {
  const url = `${WX_BASE}/cgi-bin/draft/add?access_token=${accessToken}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ articles: [article] }),
  }).catch(() => {
    throw new Error("草稿创建失败：网络请求错误");
  });
  if (!res.ok) {
    throw new Error(`草稿创建失败：HTTP ${res.status}`);
  }
  const data = (await res.json()) as WxDraftAddResponse;

  if (!data.media_id) {
    throw new Error(`草稿创建失败：[${data.errcode}] ${data.errmsg}`);
  }

  return data.media_id;
}

// ── 群发 ───────────────────────────────────────────────────────

interface WxMassSendResponse {
  errcode?: number;
  errmsg?: string;
  msg_id?: number;
  msg_data_id?: number;
}

async function massSend(draftMediaId: string, accessToken: string): Promise<number> {
  const url = `${WX_BASE}/cgi-bin/message/mass/sendall?access_token=${accessToken}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filter: { is_to_all: true },
      mpnews: { media_id: draftMediaId },
      msgtype: "mpnews",
      send_ignore_reprint: 1,
    }),
  }).catch(() => {
    throw new Error("群发失败：网络请求错误");
  });
  if (!res.ok) {
    throw new Error(`群发失败：HTTP ${res.status}`);
  }
  const data = (await res.json()) as WxMassSendResponse;

  if (data.errcode !== undefined && data.errcode !== 0) {
    throw new Error(`群发失败：[${data.errcode}] ${data.errmsg}`);
  }

  return data.msg_id ?? 0;
}

export class WechatAdapter extends BaseChannelAdapter {
  readonly id = "wechat" as const;
  readonly name = "微信公众号";
  readonly icon = "💬";
  readonly color = "#07C160";
  readonly supportedTypes: ContentType[] = ["article", "long_post", "image_post"];
  readonly requiresApproval = true;

  async publish(content: PublishContent, config: ChannelConfig): Promise<PublishResult> {
    const { appId, appSecret } = config.credentials;

    if (!appId || !appSecret) {
      return { success: false, error: "未配置 AppID 或 AppSecret" };
    }

    const publishMode = typeof config.defaults?.publishMode === "string"
      ? config.defaults.publishMode
      : "draft";
    const defaults = config.defaults ?? {};

    try {
      // Step 1: 获取 access_token（带缓存，缓存过期时自动刷新）
      // 注意：40001 mid-request 场景（草稿/群发接口返回 token 过期）暂不处理，v1 范围外
      const accessToken = await getAccessToken(appId, appSecret);

      // Step 2: 上传封面图（如有）；无封面图时用 defaults.defaultThumbMediaId 或报错
      let thumbMediaId = "";
      if (content.imageUrls?.[0]) {
        thumbMediaId = await uploadThumbMedia(content.imageUrls[0], accessToken);
      } else if (typeof defaults.defaultThumbMediaId === "string" && defaults.defaultThumbMediaId) {
        thumbMediaId = defaults.defaultThumbMediaId;
      } else {
        return { success: false, error: "微信公众号草稿需要封面图（imageUrls[0] 或 defaults.defaultThumbMediaId）" };
      }

      // Step 3: 创建草稿
      const article = buildArticle(content, defaults, thumbMediaId);
      const draftMediaId = await addDraft(article, accessToken);

      // Step 4: 群发（可选）
      if (publishMode === "mass") {
        const msgId = await massSend(draftMediaId, accessToken);
        return {
          success: true,
          postId: String(msgId),
          raw: { mode: "mass", draftMediaId, msgId },
        };
      }

      return {
        success: true,
        postId: draftMediaId,
        raw: { mode: "draft" },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "未知错误",
      };
    }
  }
}
