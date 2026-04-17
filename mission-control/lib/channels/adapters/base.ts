// 基础 Adapter — 提供默认实现，各渠道继承并覆盖
import {
  ChannelAdapter, ChannelConfig, ChannelId, ContentType,
  FormattedContent, PostAnalytics, PostStatus,
  PublishContent, PublishResult, ValidationResult,
} from "../types";

export abstract class BaseChannelAdapter implements ChannelAdapter {
  abstract readonly id: ChannelId;
  abstract readonly name: string;
  abstract readonly icon: string;
  abstract readonly color: string;
  abstract readonly supportedTypes: ContentType[];
  readonly maxLength?: number = undefined;  // 子类按需覆盖
  readonly requiresApproval: boolean = true;

  abstract publish(content: PublishContent, config: ChannelConfig): Promise<PublishResult>;

  validate(content: PublishContent): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!content.body || content.body.trim().length === 0) {
      errors.push("内容正文不能为空");
    }
    if (this.maxLength && content.body.length > this.maxLength) {
      errors.push(`内容超出 ${this.maxLength} 字符限制（当前 ${content.body.length} 字）`);
    }
    if (!content.imageUrls?.length && this.supportedTypes.includes("image_post")) {
      warnings.push("建议添加图片以提升互动率");
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  formatContent(content: PublishContent): FormattedContent {
    const warnings: string[] = [];
    let primary = content.body;

    if (this.maxLength && primary.length > this.maxLength) {
      primary = primary.slice(0, this.maxLength - 3) + "...";
      warnings.push(`内容已从 ${content.body.length} 字截断至 ${this.maxLength} 字`);
    }

    return { primary, warnings };
  }

  // 默认未实现（Analytics 阶段补充）
  async getStatus(_postId: string, _config: ChannelConfig): Promise<PostStatus> {
    return { postId: _postId, status: "live" };
  }

  async getAnalytics(_postId: string, _config: ChannelConfig): Promise<PostAnalytics> {
    throw new Error(`${this.name} Analytics 尚未接入`);
  }

  // Stub 发布（未配置凭证时的占位实现）
  protected stubPublish(channelName: string): PublishResult {
    return {
      success: false,
      error: `${channelName} 接口预留中，请在 Settings → Channels 配置 API 凭证后启用`,
    };
  }
}
