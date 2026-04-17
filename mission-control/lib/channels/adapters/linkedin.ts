// LinkedIn — 接口预留，接入 LinkedIn API v2
import { BaseChannelAdapter } from "./base";
import { ChannelConfig, ContentType, PublishContent, PublishResult } from "../types";

export class LinkedInAdapter extends BaseChannelAdapter {
  readonly id = "linkedin" as const;
  readonly name = "LinkedIn";
  readonly icon = "💼";
  readonly color = "#0A66C2";
  readonly supportedTypes: ContentType[] = ["long_post", "article", "link_share", "image_post"];
  readonly maxLength = 3000;
  readonly requiresApproval = true;

  async publish(content: PublishContent, config: ChannelConfig): Promise<PublishResult> {
    const accessToken = config.credentials.accessToken;
    const personUrn  = config.credentials.personUrn; // urn:li:person:xxx

    if (!accessToken || !personUrn) {
      return this.stubPublish(this.name);
    }

    // TODO: 接入 LinkedIn API POST /v2/ugcPosts
    // const post = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    //   method: "POST",
    //   headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    //   body: JSON.stringify({ author: personUrn, lifecycleState: "PUBLISHED", ... })
    // });

    void content;
    return this.stubPublish(this.name);
  }
}
