// ================================================================
// Channel Registry — 渠道注册中心
// 新增渠道：import adapter → channelRegistry.register(new XxxAdapter())
// ================================================================
import { ChannelAdapter, ChannelId } from "./types";
import { TelegramChannelAdapter } from "./adapters/telegram-channel";
import { TwitterAdapter }          from "./adapters/twitter";
import { LinkedInAdapter }         from "./adapters/linkedin";
import { WordPressAdapter }        from "./adapters/wordpress";
import { WechatAdapter }           from "./adapters/wechat";
import { XiaohongshuAdapter }      from "./adapters/xiaohongshu";
import { YouTubeAdapter }          from "./adapters/youtube";
import { MediumAdapter }           from "./adapters/medium";

class ChannelRegistry {
  private adapters = new Map<ChannelId, ChannelAdapter>();

  register(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(id: ChannelId): ChannelAdapter | undefined {
    return this.adapters.get(id);
  }

  getAll(): ChannelAdapter[] {
    return Array.from(this.adapters.values());
  }

  getEnabled(): ChannelAdapter[] {
    return this.getAll(); // 运行时根据 DB 配置过滤
  }

  isRegistered(id: ChannelId): boolean {
    return this.adapters.has(id);
  }
}

// 单例
export const channelRegistry = new ChannelRegistry();

// 注册所有渠道
// ✅ 已接入（半真实）
channelRegistry.register(new TelegramChannelAdapter());

// 🔜 接口预留（配置凭证后即可启用）
channelRegistry.register(new TwitterAdapter());
channelRegistry.register(new LinkedInAdapter());
channelRegistry.register(new WordPressAdapter());
channelRegistry.register(new WechatAdapter());
channelRegistry.register(new XiaohongshuAdapter());
channelRegistry.register(new YouTubeAdapter());
channelRegistry.register(new MediumAdapter());

// 新增渠道模板：
// channelRegistry.register(new DouyinAdapter());
// channelRegistry.register(new InstagramAdapter());
// channelRegistry.register(new FacebookAdapter());
// channelRegistry.register(new ProductHuntAdapter());
