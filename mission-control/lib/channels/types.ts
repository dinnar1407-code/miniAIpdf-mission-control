// ================================================================
// 全媒体矩阵发布接口定义
// 新增渠道：只需实现 ChannelAdapter 接口 + 注册到 registry.ts
// ================================================================

export type ChannelId =
  | "twitter"
  | "linkedin"
  | "youtube"
  | "wechat"          // 微信公众号
  | "xiaohongshu"     // 小红书
  | "douyin"          // 抖音
  | "telegram_channel"
  | "instagram"
  | "facebook"
  | "medium"
  | "wordpress"
  | "producthunt"
  | "hackernews"
  | "indiehackers";

export type ContentType =
  | "short_post"      // 推文、微博 (< 280 chars)
  | "long_post"       // LinkedIn、公众号
  | "article"         // 博客、Medium
  | "thread"          // 推文串
  | "video"           // YouTube、抖音
  | "image_post"      // 小红书、Instagram
  | "link_share";     // HackerNews、IndieHackers

export type PublishStatus =
  | "pending"
  | "approved"
  | "publishing"
  | "published"
  | "failed"
  | "rejected";

// 标准化内容结构（与渠道无关）
export interface PublishContent {
  title?: string;
  body: string;             // 主正文
  summary?: string;         // 摘要（部分渠道用）
  imageUrls?: string[];     // 图片
  videoUrl?: string;        // 视频
  tags?: string[];          // 标签/话题
  link?: string;            // 附带链接
  language?: "zh" | "en";
  metadata?: Record<string, unknown>;
}

// 渠道特定配置（存于数据库，通过 Settings 管理）
export interface ChannelConfig {
  channelId: ChannelId;
  enabled: boolean;
  credentials: Record<string, string>; // apiKey, accessToken, etc.
  defaults?: Record<string, unknown>;  // 渠道默认参数
}

// 发布结果
export interface PublishResult {
  success: boolean;
  postId?: string;      // 平台返回的帖子 ID
  postUrl?: string;     // 帖子链接
  error?: string;
  raw?: unknown;        // 平台原始响应（调试用）
}

// 内容格式化结果（适配各平台限制）
export interface FormattedContent {
  primary: string;      // 主体内容（已截断/调整）
  attachments?: unknown[];
  warnings?: string[];  // 如："内容已从 500 字截断至 280 字"
}

// 帖子状态（发布后查询）
export interface PostStatus {
  postId: string;
  status: "live" | "removed" | "pending_review";
  publishedAt?: string;
}

// 互动数据（Analytics 阶段接入）
export interface PostAnalytics {
  postId: string;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  fetchedAt: string;
}

// 内容校验结果
export interface ValidationResult {
  valid: boolean;
  errors: string[];     // 如："正文超出 280 字符限制"
  warnings: string[];   // 如："不含图片，互动率可能较低"
}

// ================================================================
// 核心接口：每个渠道必须实现
// ================================================================
export interface ChannelAdapter {
  readonly id: ChannelId;
  readonly name: string;
  readonly icon: string;          // emoji
  readonly color: string;         // hex，用于 UI 展示
  readonly supportedTypes: ContentType[];
  readonly maxLength?: number;    // 字符限制
  readonly requiresApproval: boolean; // 是否默认需要人工审批

  // 必须实现
  publish(content: PublishContent, config: ChannelConfig): Promise<PublishResult>;
  validate(content: PublishContent): ValidationResult;
  formatContent(content: PublishContent): FormattedContent;

  // 可选实现（Analytics 阶段）
  getStatus?(postId: string, config: ChannelConfig): Promise<PostStatus>;
  getAnalytics?(postId: string, config: ChannelConfig): Promise<PostAnalytics>;
}

// Workflow publish 步骤定义（扩展 WorkflowStep）
export interface PublishStep {
  id: string;
  type: "publish";
  label: string;
  config: Record<string, unknown>;
  channels: ChannelId[];           // 同时发布到多个渠道
  contentSource: "static" | "prev_output" | "agent_output";
  content?: string;                // contentSource = "static" 时使用
  contentType: ContentType;
  requireApproval?: boolean;       // 覆盖渠道默认值
  scheduleDelay?: number;          // 延迟发布（分钟）
  adaptContent?: boolean;          // 是否 AI 自动适配各渠道格式
}
