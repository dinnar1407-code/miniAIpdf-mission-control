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
  const signature = base64urlEncode(sign.sign(serviceAccount.private_key, 'base64'));

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
 */
export async function fetchGAMetrics(days: number = 30): Promise<GAMetrics> {
  if (!validateGA4Config()) {
    return {
      sessions: 0,
      users: 0,
      pageviews: 0,
      bounceRate: 0,
      avgSessionDuration: 0,
    };
  }

  try {
    const accessToken = await getGoogleAccessToken();
    if (!accessToken) {
      console.error('Failed to obtain Google access token');
      return {
        sessions: 0,
        users: 0,
        pageviews: 0,
        bounceRate: 0,
        avgSessionDuration: 0,
      };
    }

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

    return {
      sessions: 0,
      users: 0,
      pageviews: 0,
      bounceRate: 0,
      avgSessionDuration: 0,
    };
  } catch (error) {
    console.error('Error fetching GA4 metrics:', error);
    return {
      sessions: 0,
      users: 0,
      pageviews: 0,
      bounceRate: 0,
      avgSessionDuration: 0,
    };
  }
}

/**
 * Syncs GA4 KPIs to database
 */
export async function syncGAKpis(projectId: string | null = null): Promise<void> {
  try {
    const metrics = await fetchGAMetrics(30);

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
  } catch (error) {
    console.error('Error syncing GA4 KPIs:', error);
  }
}
