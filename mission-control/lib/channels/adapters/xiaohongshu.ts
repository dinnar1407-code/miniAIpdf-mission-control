// 小红书 — 接口预留（小红书目前无官方 API，保留接口）
import { BaseChannelAdapter } from "./base";
import { ChannelConfig, ContentType, PublishContent, PublishResult } from "../types";

export class XiaohongshuAdapter extends BaseChannelAdapter {
  readonly id = "xiaohongshu" as const;
  readonly name = "小红书";
  readonly icon = "📕";
  readonly color = "#FF2442";
  readonly supportedTypes: ContentType[] = ["image_post", "short_post"];
  readonly maxLength = 1000;
  readonly requiresApproval = true;

  async publish(content: PublishContent, config: ChannelConfig): Promise<PublishResult> {
    // 小红书目前无官方 Open API
    // 可选方案：① 等待官方 API ② 合作账号 SDK ③ 人工辅助发布
    void content; void config;
    return {
      success: false,
      error: "小红书暂无官方 API，接口预留中。可通过 Telegram 通知人工发布。",
    };
  }
}
