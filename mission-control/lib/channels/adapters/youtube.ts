// YouTube — 接口预留，接入 YouTube Data API v3
import { BaseChannelAdapter } from "./base";
import { ChannelConfig, ContentType, PublishContent, PublishResult } from "../types";

export class YouTubeAdapter extends BaseChannelAdapter {
  readonly id = "youtube" as const;
  readonly name = "YouTube";
  readonly icon = "▶️";
  readonly color = "#FF0000";
  readonly supportedTypes: ContentType[] = ["video"];
  readonly requiresApproval = true;

  async publish(content: PublishContent, config: ChannelConfig): Promise<PublishResult> {
    const accessToken = config.credentials.accessToken;

    if (!accessToken || !content.videoUrl) {
      return this.stubPublish(this.name);
    }

    // TODO: 接入 YouTube Data API v3 POST /upload/youtube/v3/videos
    // 上传视频文件 + 设置 snippet (title, description, tags) + status (public)

    void content;
    return this.stubPublish(this.name);
  }
}
