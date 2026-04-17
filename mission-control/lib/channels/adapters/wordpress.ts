// WordPress — 接口预留，接入 WordPress REST API
import { BaseChannelAdapter } from "./base";
import { ChannelConfig, ContentType, PublishContent, PublishResult } from "../types";

export class WordPressAdapter extends BaseChannelAdapter {
  readonly id = "wordpress" as const;
  readonly name = "WordPress Blog";
  readonly icon = "📝";
  readonly color = "#21759B";
  readonly supportedTypes: ContentType[] = ["article", "long_post"];
  readonly requiresApproval = true;

  async publish(content: PublishContent, config: ChannelConfig): Promise<PublishResult> {
    const siteUrl      = config.credentials.siteUrl;  // https://miniaipdf.com
    const username     = config.credentials.username;
    const appPassword  = config.credentials.appPassword; // WordPress Application Password

    if (!siteUrl || !username || !appPassword) {
      return this.stubPublish(this.name);
    }

    // TODO: 接入 WordPress REST API POST /wp-json/wp/v2/posts
    // const auth = Buffer.from(`${username}:${appPassword}`).toString("base64");
    // const res = await fetch(`${siteUrl}/wp-json/wp/v2/posts`, {
    //   method: "POST",
    //   headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    //   body: JSON.stringify({ title: content.title, content: content.body, status: "publish", tags: [...] })
    // });
    // const post = await res.json();
    // return { success: true, postId: String(post.id), postUrl: post.link };

    void content;
    return this.stubPublish(this.name);
  }
}
