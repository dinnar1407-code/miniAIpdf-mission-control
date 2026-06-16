/**
 * 免费市场新闻聚合 —— 给 Jarvis 简报加一段"市场要闻"。
 *
 * 设计取舍（见 Obsidian daily_stock_analysis-审计 §七 复核结论）：
 *   - 只读、给人看的简报情境，**绝不进任何交易决策**（那是可乐 decide() 的禁区）。
 *   - 数据源选 **Google News RSS**（零 API Key、结构化 XML），而非 DuckDuckGo 抓取——
 *     后者需要 vqd token + HTML 解析，在 serverless cron 下脆弱。
 *   - 拉取失败返回 []，绝不拖垮简报。
 */

export interface NewsItem {
  title: string;
  source: string;
}

// 关注主题：加密为主（可乐当前重心 BTC）+ 美股/宏观
const NEWS_QUERY = "比特币 OR 以太坊 OR 加密货币 OR 美股";

export async function fetchTopNews(limit = 4): Promise<NewsItem[]> {
  try {
    const url =
      "https://news.google.com/rss/search?q=" +
      encodeURIComponent(NEWS_QUERY) +
      "&hl=zh-CN&gl=CN&ceid=CN:zh-Hans";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return [];

    const xml = await res.text();
    const items: NewsItem[] = [];
    for (const block of xml.split("<item>").slice(1)) {
      const rawTitle = decodeXml(extractTag(block, "title"));
      if (!rawTitle) continue;
      // Google News 标题结尾常是 " - 来源名"，拆出来
      const sep = rawTitle.lastIndexOf(" - ");
      const title = sep > 0 ? rawTitle.slice(0, sep) : rawTitle;
      const source =
        decodeXml(extractTag(block, "source")) || (sep > 0 ? rawTitle.slice(sep + 3) : "");
      items.push({ title, source });
      if (items.length >= limit) break;
    }
    return items;
  } catch {
    return [];
  }
}

function extractTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : "";
}

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

/** 把新闻格式化成简报里的若干行（清掉会破坏 Telegram Markdown 的字符）。 */
export function formatNewsLines(items: NewsItem[]): string[] {
  if (!items.length) return [];
  const safe = (t: string) => t.replace(/[*_`[\]]/g, "").slice(0, 70);
  const lines = ["*📰 市场要闻*"];
  for (const n of items) {
    const src = n.source ? ` _(${safe(n.source)})_` : "";
    lines.push(`• ${safe(n.title)}${src}`);
  }
  return lines;
}
