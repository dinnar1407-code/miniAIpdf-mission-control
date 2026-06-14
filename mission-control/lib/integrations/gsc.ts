/**
 * Google Search Console Integration Client
 *
 * Required environment variables:
 * - GOOGLE_SERVICE_ACCOUNT_KEY: Base64-encoded JSON service account key
 * - GSC_SITE_URL: The site URL to query (e.g., https://example.com/)
 *
 * Fetches keyword rankings, clicks, impressions, CTR from GSC API
 */

import { prisma } from '@/lib/db';
import crypto from 'crypto';

export interface GSCRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GoogleServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

interface JWTHeader {
  alg: string;
  typ: string;
  kid: string;
}

interface JWTPayload {
  iss: string;
  sub: string;
  scope: string;
  aud: string;
  exp: number;
  iat: number;
}

interface GoogleAccessTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface GSCAPIResponse {
  rows?: Array<{
    keys: [string, string, string, string]; // query, country, device, date
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}

/**
 * Validates required GSC environment variables
 */
function validateGSCConfig(): boolean {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.warn('⚠️  GOOGLE_SERVICE_ACCOUNT_KEY is not configured');
    return false;
  }
  if (!process.env.GSC_SITE_URL) {
    console.warn('⚠️  GSC_SITE_URL is not configured');
    return false;
  }
  return true;
}

/**
 * Decodes service account key from base64
 */
function getServiceAccountKey(): GoogleServiceAccount | null {
  try {
    const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!encoded) return null;

    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Error decoding GOOGLE_SERVICE_ACCOUNT_KEY:', error);
    return null;
  }
}

/**
 * Base64 URL-safe encode
 */
function base64urlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generates JWT token for Google OAuth
 */
function generateJWT(serviceAccount: GoogleServiceAccount): string {
  const header: JWTHeader = {
    alg: 'RS256',
    typ: 'JWT',
    kid: serviceAccount.private_key_id,
  };

  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: serviceAccount.token_uri,
    exp: now + 3600,
    iat: now,
  };

  const headerEncoded = base64urlEncode(JSON.stringify(header));
  const payloadEncoded = base64urlEncode(JSON.stringify(payload));
  const signatureInput = `${headerEncoded}.${payloadEncoded}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  // 修复二次编码 bug：
  // 之前写法是 base64urlEncode(sign.sign(key, 'base64'))，sign.sign(key, 'base64')
  // 已经返回了一个 base64 字符串，再丢进 base64urlEncode 会把这串文本当成普通字符
  // 再编码一次（即把签名“当成数据”又 base64 了一遍），导致最终签名是损坏的。
  // Google 用公钥验签时会失败 → 拿不到 access token → 指标静默全部为 0。
  // 正确做法：让 sign.sign 直接输出原始签名 Buffer（不传第二个参数），
  // 再用 Node 内置的 'base64url' 编码一次性转成 URL 安全的 base64（自带去掉 padding）。
  const signature = sign.sign(serviceAccount.private_key).toString('base64url');

  return `${signatureInput}.${signature}`;
}

/**
 * Gets Google OAuth access token
 */
export async function getGoogleAccessToken(): Promise<string | null> {
  try {
    const serviceAccount = getServiceAccountKey();
    if (!serviceAccount) return null;

    const jwt = generateJWT(serviceAccount);

    const response = await fetch(serviceAccount.token_uri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Google auth error: ${response.statusText}`);
    }

    const data = await response.json() as GoogleAccessTokenResponse;
    return data.access_token;
  } catch (error) {
    console.error('Error getting Google access token:', error);
    return null;
  }
}

/**
 * Fetches GSC data for the specified number of days
 *
 * 返回值语义（关键改动）：
 * - 返回 null      → “没配置”（缺环境变量），调用方应跳过、不写库；这不是错误。
 * - 抛出异常       → “配置了但拉取失败”（鉴权失败 / API 报错），调用方应跳过写库并记为失败。
 * - 返回数组       → 拉取成功（空数组也合法，表示区间内没有任何查询数据）。
 *
 * 之前的 bug：失败时一律 return []，结果 syncGSCKpis 会把空数组当成“真的没数据”
 * 而静默跳过（且看不出是故障）。现在区分“未配置”和“真失败”，避免掩盖 token 损坏等问题。
 */
export async function fetchGSCData(days: number = 30): Promise<GSCRow[] | null> {
  // 未配置：不是错误，返回 null 让调用方静默跳过（不写库）
  if (!validateGSCConfig()) {
    return null;
  }

  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    // 配置了却拿不到 token（很可能就是 JWT 签名损坏）——这是真故障，抛错让 sync 跳过写库
    throw new Error('Failed to obtain Google access token (GSC)');
  }

  try {
    const siteUrl = process.env.GSC_SITE_URL!;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const formatDate = (d: Date): string => {
      return d.toISOString().split('T')[0];
    };

    const response = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          dimensions: ['query'],
          rowLimit: 25000,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`GSC API error: ${response.statusText}`);
    }

    const data = await response.json() as GSCAPIResponse;
    const rows: GSCRow[] = [];

    if (data.rows) {
      data.rows.forEach((row) => {
        rows.push({
          query: row.keys[0],
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: Number((row.ctr * 100).toFixed(2)), // Convert to percentage
          position: Number(row.position.toFixed(2)),
        });
      });
    }

    return rows;
  } catch (error) {
    // 关键改动：拉取过程中出错（网络/HTTP 非 200/JSON 解析等）属于真故障，
    // 不能再吞掉错误 return []，否则会被当成“真的没数据”而静默跳过。向上抛，让 sync 记为失败。
    console.error('Error fetching GSC data:', error);
    throw error;
  }
}

/**
 * Gets top performing keywords
 */
export async function getTopKeywords(limit: number = 50): Promise<GSCRow[]> {
  try {
    const rows = await fetchGSCData(30);
    // fetchGSCData 现在可能返回 null（未配置）。这是给 UI 展示用的只读路径，
    // 拿不到数据就返回空数组即可，不涉及写库，无需把错误向上抛。
    if (!rows) {
      return [];
    }
    return rows
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting top keywords:', error);
    return [];
  }
}

/**
 * Syncs GSC KPIs to database
 */
export async function syncGSCKpis(projectId: string | null = null): Promise<void> {
  // 注意：这里不再用 try/catch 把错误吞掉。
  // - fetchGSCData 返回 null（未配置）→ 直接 return 跳过，不写库。
  // - fetchGSCData 抛错（真故障）→ 让错误自然向上冒泡到调用方（cron daily 的 try/catch），
  //   由 cron 把这次同步标记为失败（kpiStatus.gsc = { ok: false }），而不是静默跳过。
  const data = await fetchGSCData(30);

  // 未配置：静默跳过，不写任何快照
  if (!data) {
    console.warn('GSC 未配置，跳过 KPI 同步');
    return;
  }

  // 拉取成功但区间内没有任何查询数据：这是真实的“无数据”，跳过写库即可
  if (data.length === 0) {
    console.warn('No GSC data fetched');
    return;
  }

  // Calculate aggregate metrics
  const totalClicks = data.reduce((sum, row) => sum + row.clicks, 0);
  const totalImpressions = data.reduce((sum, row) => sum + row.impressions, 0);
  const avgCTR = data.length > 0
    ? Number((data.reduce((sum, row) => sum + row.ctr, 0) / data.length).toFixed(2))
    : 0;
  const avgPosition = data.length > 0
    ? Number((data.reduce((sum, row) => sum + row.position, 0) / data.length).toFixed(2))
    : 0;

  // Write snapshots
  await Promise.all([
    prisma.kpiSnapshot.create({
      data: {
        projectId,
        metric: 'gsc_total_clicks',
        value: totalClicks,
        source: 'gsc',
        date: new Date(),
      },
    }),
    prisma.kpiSnapshot.create({
      data: {
        projectId,
        metric: 'gsc_total_impressions',
        value: totalImpressions,
        source: 'gsc',
        date: new Date(),
      },
    }),
    prisma.kpiSnapshot.create({
      data: {
        projectId,
        metric: 'gsc_avg_ctr',
        value: avgCTR,
        source: 'gsc',
        date: new Date(),
      },
    }),
    prisma.kpiSnapshot.create({
      data: {
        projectId,
        metric: 'gsc_avg_position',
        value: avgPosition,
        source: 'gsc',
        date: new Date(),
      },
    }),
    prisma.kpiSnapshot.create({
      data: {
        projectId,
        metric: 'gsc_unique_queries',
        value: data.length,
        source: 'gsc',
        date: new Date(),
      },
    }),
  ]);
}
