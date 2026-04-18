// Twitter / X — Twitter API v2 with OAuth 1.0a signature
import { createHmac, randomBytes } from "crypto";
import { BaseChannelAdapter } from "./base";
import { ChannelConfig, ContentType, PublishContent, PublishResult } from "../types";

export class TwitterAdapter extends BaseChannelAdapter {
  readonly id = "twitter" as const;
  readonly name = "Twitter / X";
  readonly icon = "𝕏";
  readonly color = "#000000";
  readonly supportedTypes: ContentType[] = ["short_post", "thread"];
  readonly maxLength = 280;
  readonly requiresApproval = false;

  async publish(content: PublishContent, config: ChannelConfig): Promise<PublishResult> {
    const apiKey = config.credentials.apiKey;
    const apiSecret = config.credentials.apiSecret;
    const accessToken = config.credentials.accessToken;
    const accessSecret = config.credentials.accessSecret;

    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
      return this.stubPublish(this.name);
    }

    try {
      const tweetText = content.body.slice(0, 280);
      const endpoint = "https://api.twitter.com/2/tweets";
      const body = JSON.stringify({ text: tweetText });

      // Generate OAuth 1.0a Authorization header
      const authHeader = this.generateOAuth1Header(
        endpoint,
        "POST",
        { text: tweetText },
        apiKey,
        apiSecret,
        accessToken,
        accessSecret
      );

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          typeof errorData === "object" && errorData !== null && "detail" in errorData
            ? (errorData as any).detail
            : `HTTP ${response.status}`;
        return { success: false, error: errorMessage };
      }

      const result = (await response.json()) as any;
      const tweetId = result.data?.id;

      if (!tweetId) {
        return { success: false, error: "No tweet ID in response" };
      }

      return {
        success: true,
        postId: tweetId,
        postUrl: `https://twitter.com/i/web/status/${tweetId}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: message };
    }
  }

  private generateOAuth1Header(
    url: string,
    method: string,
    params: Record<string, string>,
    consumerKey: string,
    consumerSecret: string,
    accessToken: string,
    accessTokenSecret: string
  ): string {
    const nonce = randomBytes(16).toString("hex");
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // OAuth 1.0a parameters
    const oauthParams = {
      oauth_consumer_key: consumerKey,
      oauth_token: accessToken,
      oauth_signature_method: "HMAC-SHA1",
      oauth_signature_version: "1.0",
      oauth_nonce: nonce,
      oauth_timestamp: timestamp,
    };

    // Combine all parameters for signature base string
    const allParams = { ...oauthParams, ...params };
    const sortedParams = Object.keys(allParams)
      .sort()
      .map((key) => `${this.percentEncode(key)}=${this.percentEncode(allParams[key])}`)
      .join("&");

    // Signature base string
    const signatureBaseString = [
      method,
      this.percentEncode(url),
      this.percentEncode(sortedParams),
    ]
      .map((s) => this.percentEncode(s))
      .join("&");

    // Signing key
    const signingKey = `${this.percentEncode(consumerSecret)}&${this.percentEncode(accessTokenSecret)}`;

    // Generate signature
    const signature = createHmac("sha1", signingKey)
      .update(signatureBaseString)
      .digest("base64");

    // Build Authorization header
    const authorizationParams = {
      ...oauthParams,
      oauth_signature: signature,
    };

    const authHeader =
      "OAuth " +
      Object.keys(authorizationParams)
        .sort()
        .map((key) => `${key}="${this.percentEncode(authorizationParams[key])}"`)
        .join(", ");

    return authHeader;
  }

  private percentEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/!/g, "%21")
      .replace(/\*/g, "%2A")
      .replace(/'/g, "%27")
      .replace(/\(/g, "%28")
      .replace(/\)/g, "%29");
  }
}
