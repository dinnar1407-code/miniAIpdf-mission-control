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
  const signature = base64urlEncode(sign.sign(serviceAccount.private_key, 'base64'));

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
 */
export async function fetchGSCData(days: number = 30): Promise<GSCRow[]> {
  if (!validateGSCConfig()) {
    return [];
  }

  try {
    const accessToken = await getGoogleAccessToken();
    if (!accessToken) {
      console.error('Failed to obtain Google access token');
      return [];
    }

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
    console.error('Error fetching GSC data:', error);
    return [];
  }
}

/**
 * Gets top performing keywords
 */
export async function getTopKeywords(limit: number = 50): Promise<GSCRow[]> {
  try {
    const rows = await fetchGSCData(30);
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
  try {
    const data = await fetchGSCData(30);

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
  } catch (error) {
    console.error('Error syncing GSC KPIs:', error);
  }
}
