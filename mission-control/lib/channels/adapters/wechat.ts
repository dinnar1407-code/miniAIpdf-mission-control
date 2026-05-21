// 微信公众号 — 完整发布流程
// 支持：纯文字图文 / 带封面图图文 / 草稿模式 / 群发模式
import { BaseChannelAdapter } from "./base";
import { ChannelConfig, ContentType, PublishContent, PublishResult } from "../types";

// access_token 模块级缓存（key = appId）— 用于 getAccessToken()
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

// 微信 API 基址
const WX_BASE = "https://api.weixin.qq.com";

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

    // TODO: implement in later tasks
    void content;
    return { success: false, error: "实现进行中" };
  }
}
