import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const WX_BASE = "https://api.weixin.qq.com";

interface WxMaterialItem {
  media_id: string;
  name: string;
  update_time: number;
  url: string;
}

// GET /api/settings/channels/wechat/materials — 查询微信永久素材图片列表
export async function GET() {
  try {
    const cred = await prisma.channelCredential.findUnique({ where: { channelId: "wechat" } });
    if (!cred) return NextResponse.json({ error: "未配置微信凭证，请先保存 App ID 和 App Secret" }, { status: 400 });

    const { appId, appSecret } = JSON.parse(cred.credentials) as { appId?: string; appSecret?: string };
    if (!appId || !appSecret) return NextResponse.json({ error: "凭证不完整" }, { status: 400 });

    // 获取 access_token
    const tokenRes = await fetch(
      `${WX_BASE}/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`
    );
    const tokenData = await tokenRes.json() as { access_token?: string; errcode?: number; errmsg?: string };
    if (!tokenData.access_token) {
      return NextResponse.json({ error: `获取 token 失败：[${tokenData.errcode}] ${tokenData.errmsg}` }, { status: 400 });
    }

    // 拉取永久图片素材列表（最多 20 条）
    const matRes = await fetch(
      `${WX_BASE}/cgi-bin/material/batchget_material?access_token=${tokenData.access_token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "image", offset: 0, count: 20 }),
      }
    );
    const matData = await matRes.json() as { item?: WxMaterialItem[]; errcode?: number; errmsg?: string };

    if (matData.errcode) {
      return NextResponse.json({ error: `[${matData.errcode}] ${matData.errmsg}` }, { status: 400 });
    }

    return NextResponse.json({ items: matData.item ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
