/**
 * 本地运行：从微信 API 获取 access_token 并写入生产数据库
 * 使用 .env.production.local 中的 DATABASE_URL 连接生产 DB
 * 建议通过 launchd 每 90 分钟执行一次
 *
 * 用法：
 *   tsx --env-file=.env.production.local scripts/refresh-wechat-token.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const WX_BASE = "https://api.weixin.qq.com";

async function main() {
  // 从 DB 读取微信凭证
  const cred = await prisma.channelCredential.findUnique({
    where: { channelId: "wechat" },
  });

  if (!cred) {
    console.error("❌ 未找到微信凭证，请先在设置页面保存 App ID 和 App Secret");
    process.exit(1);
  }

  const { appId, appSecret } = JSON.parse(cred.credentials) as {
    appId?: string;
    appSecret?: string;
  };

  if (!appId || !appSecret) {
    console.error("❌ 微信凭证不完整（缺少 appId 或 appSecret）");
    process.exit(1);
  }

  console.log(`🔄 正在刷新 access_token（appId: ${appId.slice(0, 8)}...）`);

  // 调微信 API 获取新 token（从本机家庭宽带 IP 发出，需已加入白名单）
  const res = await fetch(
    `${WX_BASE}/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`
  );

  if (!res.ok) {
    console.error(`❌ 请求失败：HTTP ${res.status}`);
    process.exit(1);
  }

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    errcode?: number;
    errmsg?: string;
  };

  if (!data.access_token) {
    console.error(`❌ 获取 token 失败：[${data.errcode}] ${data.errmsg}`);
    process.exit(1);
  }

  // 提前 5 分钟过期，避免边界竞争
  const expiresAt = new Date(Date.now() + ((data.expires_in ?? 7200) - 300) * 1000);

  // 写入 DB
  await prisma.wechatToken.upsert({
    where:  { appId },
    create: { appId, accessToken: data.access_token, expiresAt },
    update: { accessToken: data.access_token, expiresAt, updatedAt: new Date() },
  });

  console.log(`✅ token 已写入 DB，有效期至 ${expiresAt.toLocaleString("zh-CN")}`);
}

main()
  .catch(err => { console.error("❌ 未知错误：", err); process.exit(1); })
  .finally(() => prisma.$disconnect());
