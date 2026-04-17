// Twitter / X — 接口预留，接入 Twitter API v2
import { BaseChannelAdapter } from "./base";
import { ChannelConfig, ContentType, PublishContent, PublishResult } from "../types";

export class TwitterAdapter extends BaseChannelAdapter {
  readonly id = "twitter" as const;
  readonly name = "Twitter / X";
  readonly icon = "𝕏";
  readonly color = "#000000";
  readonly supportedTypes: ContentType[] = ["short_post", "thread", "image_post", "link_share"];
  readonly maxLength = 280;
  readonly requiresApproval = true;

  async publish(content: PublishContent, config: ChannelConfig): Promise<PublishResult> {
    const bearerToken = config.credentials.bearerToken;
    const accessToken = config.credentials.accessToken;
    const accessSecret = config.credentials.accessSecret;

    if (!bearerToken || !accessToken) {
      return this.stubPublish(this.name);
    }

    // TODO: 接入 Twitter API v2 POST /2/tweets
    // const client = new TwitterApi({ appKey, appSecret, accessToken, accessSecret });
    // const tweet = await client.v2.tweet(formatted.primary);
    // return { success: true, postId: tweet.data.id, postUrl: `https://twitter.com/i/web/status/${tweet.data.id}` };

    void config; void accessSecret;
    return this.stubPublish(this.name);
  }
}
