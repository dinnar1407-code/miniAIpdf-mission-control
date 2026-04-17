// 微信公众号 — 接口预留，接入微信公众号 API
import { BaseChannelAdapter } from "./base";
import { ChannelConfig, ContentType, PublishContent, PublishResult } from "../types";

export class WechatAdapter extends BaseChannelAdapter {
  readonly id = "wechat" as const;
  readonly name = "微信公众号";
  readonly icon = "💬";
  readonly color = "#07C160";
  readonly supportedTypes: ContentType[] = ["article", "long_post", "image_post"];
  readonly requiresApproval = true;

  async publish(content: PublishContent, config: ChannelConfig): Promise<PublishResult> {
    const appId     = config.credentials.appId;
    const appSecret = config.credentials.appSecret;

    if (!appId || !appSecret) {
      return this.stubPublish(this.name);
    }

    // TODO: 微信公众号发布流程（需要图文素材 + 群发）
    // Step 1: POST /cgi-bin/token → 获取 access_token
    // Step 2: POST /cgi-bin/media/uploadnews → 上传图文素材
    // Step 3: POST /cgi-bin/message/mass/sendall → 群发

    void content;
    return this.stubPublish(this.name);
  }
}
