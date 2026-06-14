/**
 * Google Analytics 4 Integration Client
 *
 * Required environment variables:
 * - GA_PROPERTY_ID: GA4 property ID (numeric)
 * - GOOGLE_SERVICE_ACCOUNT_KEY: Base64-encoded JSON service account key (shared with GSC)
 *
 * Fetches page views, sessions, users, bounce rate, and session duration from GA4 API
 */

import { prisma } from '@/lib/db';
import crypto from 'crypto';

export interface GAMetrics {
  sessions: number;
  users: number;
  pageviews: number;
  bounceRate: number;
  avgSessionDuration: number;
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

interface GA4Row {
  metricValues: Array<{ value: string }>;
}

interface GA4Response {
  rows?: GA4Row[];
  totals?: Array<{ values: string[] }>;
}

/**
 * Validates required GA4 environment variables
 */
function validateGA4Config(): boolean {
  if (!process.env.GA_PROPERTY_ID) {
    console.warn('⚠️  GA_PROPERTY_ID is not configured');
    return false;
  }
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.warn('⚠️  GOOGLE_SERVICE_ACCOUNT_KEY is not configured');
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
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
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
 * Gets Google OAuth access token for GA4
 */
async function getGoogleAccessToken(): Promise<string | null> {
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
 * Fetches GA4 metrics for the specified number of days
 *
 * 返回值语义（关键改动）：
 * - 返回 null  → 表示“没配置”（缺环境变量），调用方应当跳过、不写库；这不是错误。
 * - 抛出异常   → 表示“配置了但拉取失败”（鉴权失败 / API 报错），调用方应当跳过写库并记为失败。
 * - 返回对象   → 拉取成功，真实指标。
 *
 * 之前的 bug：无论哪种失败都 return 全 0 的对象，结果把“假的 0”写进了数据库，
 * 让仪表盘看起来“数据是真的 0”，掩盖了 token 损坏等真实故障。现在改为：
 * 未配置返回 null（静默跳过），真失败直接抛错（让 sync 记为失败、不写 0）。
 */
export async function fetchGAMetrics(days: number = 30): Promise<GAMetrics | null> {
  // 未配置：不是错误，返回 null 让调用方静默跳过（不写库）
  if (!validateGA4Config()) {
    return null;
  }

  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    // 配置了却拿不到 token（很可能就是 JWT 签名损坏）——这是真故障，抛错让 sync 跳过写库
    throw new Error('Failed to obtain Google access token (GA4)');
  }

  try {
    const propertyId = process.env.GA_PROPERTY_ID!;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const formatDate = (d: Date): string => {
      return d.toISOString().split('T')[0];
    };

    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate: formatDate(startDate),
              endDate: formatDate(endDate),
            },
          ],
          metrics: [
            { name: 'sessions' },
            { name: 'activeUsers' },
            { name: 'screenPageViews' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`GA4 API error: ${response.statusText}`);
    }

    const data = await response.json() as GA4Response;

    // Extract metrics from response
    if (data.totals && data.totals[0]) {
      const values = data.totals[0].values;
      return {
        sessions: parseInt(values[0] || '0', 10),
        users: parseInt(values[1] || '0', 10),
        pageviews: parseInt(values[2] || '0', 10),
        bounceRate: parseFloat(values[3] || '0'),
        avgSessionDuration: parseFloat(values[4] || '0'),
      };
    }

    // 走到这里说明 API 调用成功、但响应里没有 totals（即区间内确实没有任何流量），
    // 这种“真实的 0”是合法数据，可以照常返回 0 写库。
    return {
      sessions: 0,
      users: 0,
      pageviews: 0,
      bounceRate: 0,
      avgSessionDuration: 0,
    };
  } catch (error) {
    // 关键改动：拉取过程中出错（网络/HTTP 非 200/JSON 解析等）属于真故障，
    // 不能再吞掉错误 return 全 0，否则会把假的 0 写进库。这里向上抛，让 sync 跳过写库。
    console.error('Error fetching GA4 metrics:', error);
    throw error;
  }
}

/**
 * Syncs GA4 KPIs to database
 */
export async function syncGAKpis(projectId: string | null = null): Promise<void> {
  // 注意：这里不再用 try/catch 把错误吞掉。
  // - fetchGAMetrics 返回 null（未配置）→ 直接 return 跳过，不写库。
  // - fetchGAMetrics 抛错（真故障）→ 让错误自然向上冒泡到调用方（cron daily 的 try/catch），
  //   由 cron 把这次同步标记为失败（kpiStatus.ga = { ok: false }），而不是写入一堆假的 0。
  const metrics = await fetchGAMetrics(30);

  // 未配置：静默跳过，不写任何快照
  if (!metrics) {
    console.warn('GA4 未配置，跳过 KPI 同步');
    return;
  }

  await Promise.all([
    prisma.kpiSnapshot.create({
      data: {
        projectId,
        metric: 'ga_sessions',
        value: metrics.sessions,
        source: 'ga4',
        date: new Date(),
      },
    }),
    prisma.kpiSnapshot.create({
      data: {
        projectId,
        metric: 'ga_users',
        value: metrics.users,
        source: 'ga4',
        date: new Date(),
      },
    }),
    prisma.kpiSnapshot.create({
      data: {
        projectId,
        metric: 'ga_pageviews',
        value: metrics.pageviews,
        source: 'ga4',
        date: new Date(),
      },
    }),
    prisma.kpiSnapshot.create({
      data: {
        projectId,
        metric: 'ga_bounce_rate',
        value: metrics.bounceRate,
        source: 'ga4',
        date: new Date(),
      },
    }),
    prisma.kpiSnapshot.create({
      data: {
        projectId,
        metric: 'ga_avg_session_duration',
        value: metrics.avgSessionDuration,
        source: 'ga4',
        date: new Date(),
      },
    }),
  ]);
}

// ─────────────────────────────────────────────────────────────
// Realtime API — active users in the last 30 minutes
// ─────────────────────────────────────────────────────────────

export interface GARealtimeMetrics {
  activeUsers: number;
  screenPageViews: number;
}

interface GA4RealtimeResponse {
  rows?: Array<{ metricValues: Array<{ value: string }> }>;
  totals?: Array<{ metricValues: Array<{ value: string }> }>;
}

export async function fetchGARealtimeMetrics(): Promise<GARealtimeMetrics> {
  const empty: GARealtimeMetrics = { activeUsers: 0, screenPageViews: 0 };
  if (!validateGA4Config()) return empty;

  const accessToken = await getGoogleAccessToken();
  if (!accessToken) return empty;

  try {
    const propertyId = process.env.GA_PROPERTY_ID!;
    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
        }),
      }
    );
    if (!res.ok) throw new Error(`GA4 Realtime error: ${res.statusText}`);
    const data = await res.json() as GA4RealtimeResponse;
    const vals = data.totals?.[0]?.metricValues;
    if (!vals) return empty;
    return {
      activeUsers:     parseInt(vals[0]?.value ?? '0', 10),
      screenPageViews: parseInt(vals[1]?.value ?? '0', 10),
    };
  } catch (err) {
    console.error('Error fetching GA4 realtime metrics:', err);
    return empty;
  }
}

/**
 * Upserts hourly realtime KPI snapshots.
 * Returns the stored activeUsers value so callers can do anomaly detection.
 */
export async function syncGARealtimeKpis(projectId: string | null = null): Promise<number> {
  const metrics = await fetchGARealtimeMetrics();
  if (!metrics.activeUsers && !metrics.screenPageViews) return 0;

  // Hourly bucket: one row per hour, upsert on conflict
  const now = new Date();
  const hourBucket = new Date(now);
  hourBucket.setMinutes(0, 0, 0);
  const hourStr = hourBucket.toISOString().slice(0, 13); // "2026-05-23T09"
  const usersId = `ga_rt_users_${hourStr}`;
  const viewsId = `ga_rt_views_${hourStr}`;

  await Promise.all([
    prisma.kpiSnapshot.upsert({
      where:  { id: usersId },
      create: { id: usersId, date: hourBucket, projectId, source: 'ga4_realtime', metric: 'ga_realtime_users', value: metrics.activeUsers },
      update: { value: metrics.activeUsers },
    }),
    prisma.kpiSnapshot.upsert({
      where:  { id: viewsId },
      create: { id: viewsId, date: hourBucket, projectId, source: 'ga4_realtime', metric: 'ga_realtime_pageviews', value: metrics.screenPageViews },
      update: { value: metrics.screenPageViews },
    }),
  ]);

  return metrics.activeUsers;
}
