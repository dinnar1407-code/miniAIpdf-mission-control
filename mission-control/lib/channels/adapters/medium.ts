// Medium — 接口预留，接入 Medium API
import { BaseChannelAdapter } from "./base";
import { ChannelConfig, ContentType, PublishContent, PublishResult } from "../types";

export class MediumAdapter extends BaseChannelAdapter {
  readonly id = "medium" as const;
  readonly name = "Medium";
  readonly icon = "📖";
  readonly color = "#000000";
  readonly supportedTypes: ContentType[] = ["article", "long_post"];
  readonly requiresApproval = true;

  async publish(content: PublishContent, config: ChannelConfig): Promise<PublishResult> {
    const integrationToken = config.credentials.integrationToken;
    const authorId         = config.credentials.authorId;

    if (!integrationToken || !authorId) {
      return this.stubPublish(this.name);
    }

    // TODO: 接入 Medium API POST /v1/users/{authorId}/posts
    // const res = await fetch(`https://api.medium.com/v1/users/${authorId}/posts`, {
    //   method: "POST",
    //   headers: { Authorization: `Bearer ${integrationToken}`, "Content-Type": "application/json" },
    //   body: JSON.stringify({ title: content.title, contentFormat: "markdown", content: content.body,
    //                          tags: content.tags, publishStatus: "public" })
    // });
    // const post = await res.json();
    // return { success: true, postId: post.data.id, postUrl: post.data.url };

    void content;
    return this.stubPublish(this.name);
  }
}
