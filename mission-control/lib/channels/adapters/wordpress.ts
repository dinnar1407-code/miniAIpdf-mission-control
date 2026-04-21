// WordPress — WordPress REST API with Application Password authentication
import { BaseChannelAdapter } from "./base";
import { ChannelConfig, ContentType, PublishContent, PublishResult } from "../types";

export class WordPressAdapter extends BaseChannelAdapter {
  readonly id = "wordpress" as const;
  readonly name = "WordPress";
  readonly icon = "📰";
  readonly color = "#21759B";
  readonly supportedTypes: ContentType[] = ["article", "short_post"];
  readonly requiresApproval = true;

  async publish(content: PublishContent, config: ChannelConfig): Promise<PublishResult> {
    const siteUrl = config.credentials.siteUrl;
    const username = config.credentials.username;
    const appPassword = config.credentials.appPassword;

    if (!siteUrl || !username || !appPassword) {
      return this.stubPublish(this.name);
    }

    try {
      // Normalize siteUrl (remove trailing slash)
      const normalizedUrl = siteUrl.replace(/\/$/, "");
      const endpoint = `${normalizedUrl}/wp-json/wp/v2/posts`;

      // Create Basic Auth header
      const authString = Buffer.from(`${username}:${appPassword}`).toString("base64");

      // 发布状态优先级：
      // 1. content.metadata.status（工具调用时的明确指令）
      // 2. config.defaults.publishStatus（渠道全局默认）
      // 3. 兜底："draft"（安全默认，避免意外直发）
      const metaStatus = content.metadata?.status as string | undefined;
      const publishStatus =
        metaStatus === "publish" || metaStatus === "draft"
          ? metaStatus
          : config.defaults?.publishStatus === "publish"
          ? "publish"
          : "draft";

      // tags：从 content.tags 数组生成（WordPress REST API 接受 tag slug 或 ID，这里用 slug）
      const tagSlugs = (content.tags ?? []).map(t => t.toLowerCase().replace(/\s+/g, "-"));

      // Prepare post data
      const postData: Record<string, unknown> = {
        title:   content.title || "Untitled",
        content: content.body,
        status:  publishStatus,
        ...(content.summary ? { excerpt: content.summary } : {}),
        ...(tagSlugs.length > 0 ? { tags: tagSlugs } : {}),
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Basic ${authString}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          typeof errorData === "object" &&
          errorData !== null &&
          "message" in errorData
            ? (errorData as any).message
            : `HTTP ${response.status}`;
        return { success: false, error: errorMessage };
      }

      const post = (await response.json()) as any;

      if (!post.id || !post.link) {
        return { success: false, error: "Invalid response structure from WordPress" };
      }

      return {
        success: true,
        postId: String(post.id),
        postUrl: post.link,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: message };
    }
  }
}
