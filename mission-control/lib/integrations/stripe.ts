/**
 * Stripe Integration Client
 *
 * Required environment variables:
 * - STRIPE_SECRET_KEY: Stripe secret API key for authentication
 * - STRIPE_WEBHOOK_SECRET: Webhook secret for signature verification (optional)
 *
 * Fetches MRR, subscriptions, and churn metrics from Stripe API
 */

import { prisma } from '@/lib/db';

interface StripeSubscription {
  id: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  items: {
    data: Array<{
      price: {
        amount: number | null;
        currency: string;
      };
    }>;
  };
}

interface StripeMRRResult {
  mrr: number;
  activeSubscriptions: number;
  newThisMonth: number;
  cancelledThisMonth: number;
}

/**
 * Validates required Stripe environment variables
 */
function validateStripeConfig(): boolean {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('⚠️  STRIPE_SECRET_KEY is not configured');
    return false;
  }
  return true;
}

/**
 * Fetches MRR and subscription metrics from Stripe API
 */
export async function fetchStripeMRR(): Promise<StripeMRRResult> {
  if (!validateStripeConfig()) {
    return {
      mrr: 0,
      activeSubscriptions: 0,
      newThisMonth: 0,
      cancelledThisMonth: 0,
    };
  }

  try {
    const secretKey = process.env.STRIPE_SECRET_KEY!;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartUnix = Math.floor(monthStart.getTime() / 1000);

    // Fetch active subscriptions for MRR calculation
    const activeSubsResponse = await fetch(
      'https://api.stripe.com/v1/subscriptions?status=active&limit=100',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (!activeSubsResponse.ok) {
      throw new Error(`Stripe API error: ${activeSubsResponse.statusText}`);
    }

    const activeSubsData = await activeSubsResponse.json() as {
      data: StripeSubscription[];
      has_more?: boolean;
    };

    // Calculate MRR from active subscriptions
    let mrr = 0;
    activeSubsData.data.forEach((sub) => {
      sub.items.data.forEach((item) => {
        if (item.price.amount) {
          mrr += item.price.amount / 100; // Convert cents to dollars
        }
      });
    });

    const activeSubscriptions = activeSubsData.data.length;

    // Fetch new subscriptions this month
    const newSubsResponse = await fetch(
      `https://api.stripe.com/v1/subscriptions?created[gte]=${monthStartUnix}&limit=100`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (!newSubsResponse.ok) {
      throw new Error(`Stripe API error: ${newSubsResponse.statusText}`);
    }

    const newSubsData = await newSubsResponse.json() as {
      data: StripeSubscription[];
    };
    const newThisMonth = newSubsData.data.length;

    // Fetch cancelled subscriptions this month
    const cancelledSubsResponse = await fetch(
      `https://api.stripe.com/v1/subscriptions?status=canceled&created[gte]=${monthStartUnix}&limit=100`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (!cancelledSubsResponse.ok) {
      throw new Error(`Stripe API error: ${cancelledSubsResponse.statusText}`);
    }

    const cancelledSubsData = await cancelledSubsResponse.json() as {
      data: StripeSubscription[];
    };
    const cancelledThisMonth = cancelledSubsData.data.length;

    return {
      mrr: Math.round(mrr * 100) / 100,
      activeSubscriptions,
      newThisMonth,
      cancelledThisMonth,
    };
  } catch (error) {
    console.error('Error fetching Stripe MRR:', error);
    return {
      mrr: 0,
      activeSubscriptions: 0,
      newThisMonth: 0,
      cancelledThisMonth: 0,
    };
  }
}

/**
 * Writes a KPI metric snapshot to the database
 */
export async function writeKpiSnapshot(
  projectId: string | null,
  metric: string,
  value: number,
  delta?: number,
  source: string = 'stripe'
): Promise<void> {
  try {
    await prisma.kpiSnapshot.create({
      data: {
        projectId,
        metric,
        value,
        delta,
        source,
        date: new Date(),
      },
    });
  } catch (error) {
    console.error('Error writing KPI snapshot:', error);
  }
}

/**
 * Syncs Stripe KPIs to database
 */
export async function syncStripeKpis(projectId: string | null = null): Promise<void> {
  try {
    const metrics = await fetchStripeMRR();

    await Promise.all([
      writeKpiSnapshot(projectId, 'stripe_mrr', metrics.mrr, undefined, 'stripe'),
      writeKpiSnapshot(projectId, 'stripe_active_subscriptions', metrics.activeSubscriptions, undefined, 'stripe'),
      writeKpiSnapshot(projectId, 'stripe_new_subscriptions', metrics.newThisMonth, undefined, 'stripe'),
      writeKpiSnapshot(projectId, 'stripe_cancelled_subscriptions', metrics.cancelledThisMonth, undefined, 'stripe'),
    ]);
  } catch (error) {
    console.error('Error syncing Stripe KPIs:', error);
  }
}
