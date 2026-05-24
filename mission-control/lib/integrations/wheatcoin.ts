/**
 * Wheatcoin Integration
 *
 * 数据来源：
 * 1. wheatcommunity.app/api/jarvis/stats — 社区运营数据（用户投稿、申领等）
 * 2. pump.fun frontend API — 代币市场数据（市值、持仓、交易量）
 *
 * 需要在 wheatcommunity.app 上添加 /api/jarvis/stats 端点（见注释底部代码示例）
 */

import { prisma } from '@/lib/db';

const WHEATCOIN_PROJECT_ID = 'cmo21zr1100009rvsgd32vgki';
const WHC_MINT = '4sehcoU2vrr11HPEGpEmWMvDL1ddwveDpvAVY5d8pump';
const COMMUNITY_STATS_URL = 'https://wheatcommunity.app/api/jarvis/stats';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface CommunityStats {
  contributors: number;
  products_approved: number;
  claims_approved: number;
  claims_pending: number;
  total_votes: number;
  leads: number;
}

export interface PumpFunToken {
  mint: string;
  name: string;
  symbol: string;
  market_cap: number;       // USD
  usd_market_cap: number;
  holder_count: number;
  reply_count: number;
  volume_24h: number;       // may need to derive from trades
  price: number;
}

// ─────────────────────────────────────────────
// Fetchers
// ─────────────────────────────────────────────

export async function fetchCommunityStats(): Promise<CommunityStats | null> {
  try {
    const res = await fetch(COMMUNITY_STATS_URL, {
      headers: { 'Accept': 'application/json' },
      // 5 秒超时
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`[Wheatcoin] Community stats API returned ${res.status}`);
      return null;
    }
    return await res.json() as CommunityStats;
  } catch (err) {
    console.error('[Wheatcoin] fetchCommunityStats error:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function fetchPumpFunToken(): Promise<PumpFunToken | null> {
  try {
    const res = await fetch(`https://frontend-api.pump.fun/coins/${WHC_MINT}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://pump.fun/',
        'Origin': 'https://pump.fun',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[Wheatcoin] pump.fun API returned ${res.status}`);
      return null;
    }
    return await res.json() as PumpFunToken;
  } catch (err) {
    console.error('[Wheatcoin] fetchPumpFunToken error:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ─────────────────────────────────────────────
// Sync — upsert daily KpiSnapshots
// ─────────────────────────────────────────────

export async function syncWheatcoinKpis(): Promise<{ community: boolean; token: boolean }> {
  const result = { community: false, token: false };
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const now   = new Date();

  // Helper to upsert a single KPI metric
  const upsert = (metric: string, value: number, source: string) =>
    prisma.kpiSnapshot.upsert({
      where:  { id: `wheatcoin_${metric}_${today}` },
      create: {
        id:        `wheatcoin_${metric}_${today}`,
        projectId: WHEATCOIN_PROJECT_ID,
        metric,
        value,
        source,
        date: now,
      },
      update: { value },
    });

  // 1. Community stats
  const community = await fetchCommunityStats();
  if (community) {
    await Promise.all([
      upsert('whc_contributors',     community.contributors,     'wheatcommunity'),
      upsert('whc_products_approved',community.products_approved,'wheatcommunity'),
      upsert('whc_claims_approved',  community.claims_approved,  'wheatcommunity'),
      upsert('whc_claims_pending',   community.claims_pending,   'wheatcommunity'),
      upsert('whc_total_votes',      community.total_votes,      'wheatcommunity'),
      upsert('whc_leads',            community.leads,            'wheatcommunity'),
    ]);
    result.community = true;
    console.log('[Wheatcoin] Community stats synced:', community);
  }

  // 2. pump.fun token data
  const token = await fetchPumpFunToken();
  if (token) {
    const marketCapUsd = token.usd_market_cap ?? token.market_cap ?? 0;
    await Promise.all([
      upsert('whc_market_cap_usd', marketCapUsd,       'pump_fun'),
      upsert('whc_holder_count',   token.holder_count ?? 0, 'pump_fun'),
      upsert('whc_reply_count',    token.reply_count  ?? 0, 'pump_fun'),
      upsert('whc_volume_24h',     token.volume_24h   ?? 0, 'pump_fun'),
    ]);
    result.token = true;
    console.log('[Wheatcoin] Token stats synced: market_cap=', marketCapUsd, 'holders=', token.holder_count);
  }

  return result;
}

/*
─────────────────────────────────────────────────────────────────────────────
wheatcommunity.app server.js — 添加 /api/jarvis/stats 端点

在 server.js 中找到路由区域，加入以下代码：

  } else if (pathname === '/api/jarvis/stats' && req.method === 'GET') {
    // Jarvis Mission Control 数据接口
    try {
      const contributors = db.prepare(
        "SELECT COUNT(DISTINCT user_id) as cnt FROM products WHERE status = 'approved'"
      ).get();
      const productsApproved = db.prepare(
        "SELECT COUNT(*) as cnt FROM products WHERE status = 'approved'"
      ).get();
      const claimsApproved = db.prepare(
        "SELECT COUNT(*) as cnt FROM claims WHERE status = 'approved'"
      ).get();
      const claimsPending = db.prepare(
        "SELECT COUNT(*) as cnt FROM claims WHERE status = 'pending'"
      ).get();
      const totalVotes = db.prepare(
        "SELECT COALESCE(SUM(votes), 0) as cnt FROM products"
      ).get();
      const leads = db.prepare(
        "SELECT COUNT(*) as cnt FROM leads"
      ).get();

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({
        contributors:     contributors?.cnt    ?? 0,
        products_approved:productsApproved?.cnt ?? 0,
        claims_approved:  claimsApproved?.cnt   ?? 0,
        claims_pending:   claimsPending?.cnt     ?? 0,
        total_votes:      totalVotes?.cnt        ?? 0,
        leads:            leads?.cnt             ?? 0,
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal' }));
    }

  } else if ...（继续原来的路由）

注意：实际表名/列名以你的 SQLite schema 为准，按需调整。
─────────────────────────────────────────────────────────────────────────────
*/
