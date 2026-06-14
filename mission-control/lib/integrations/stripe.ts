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
  created: number;
  // canceled_at：订阅被取消的 Unix 时间戳；只有已取消的订阅才有值，活跃订阅为 null。
  // churn（流失）口径必须用这个字段判断"本月取消"，而不是用 created（创建时间）。
  canceled_at: number | null;
  current_period_start: number;
  current_period_end: number;
  items: {
    data: Array<{
      // quantity：该订阅项的数量（例如一个团队买了 5 个席位，quantity 就是 5）。
      // 计算 MRR 时必须乘上 quantity，否则多席位订阅会被低估。
      quantity: number;
      price: {
        unit_amount: number | null;
        currency: string;
        // recurring.interval：计费周期，常见值为 'month'（月付）或 'year'（年付）。
        // 归一到「月」时：年付要除以 12，这样年付订阅才不会被当成月价导致 MRR 虚高 12 倍。
        recurring: {
          interval: 'day' | 'week' | 'month' | 'year';
          // interval_count：每个周期的间隔倍数（例如 interval=month、interval_count=3 表示每 3 个月计费一次）。
          interval_count: number;
        } | null;
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
 * 遍历 Stripe 某个列表接口的全部分页数据。
 *
 * 为什么需要它：Stripe 的列表接口单次最多只返回 limit=100 条，超过 100 条时
 * 响应里 has_more=true，需要用最后一条记录的 id 作为 starting_after 游标继续翻页。
 * 如果只取第一页（limit=100），当活跃订阅 > 100 时 MRR 会被严重低估。
 *
 * @param baseUrl 不含分页参数的 Stripe 列表接口 URL（查询参数用 ? 起头，本函数会用 & 追加）
 * @param secretKey Stripe 密钥
 * @returns 拼接好的全部订阅记录数组
 * @throws 当任意一页请求失败时抛错（由上层决定如何处理，绝不静默吞掉）
 */
async function fetchAllStripeSubscriptions(
  baseUrl: string,
  secretKey: string
): Promise<StripeSubscription[]> {
  const allSubs: StripeSubscription[] = [];
  // startingAfter 是游标：第一页为空，之后每页都是上一页最后一条记录的 id。
  let startingAfter: string | undefined = undefined;

  // 只要 has_more 为 true 就继续翻页；这里没有写死翻页上限，
  // 因为我们必须把全部活跃订阅都拉完才能算准 MRR。
  while (true) {
    // 每页都基于 baseUrl 拼上 limit 和（除第一页外的）starting_after 游标。
    const pageUrl = startingAfter
      ? `${baseUrl}&limit=100&starting_after=${startingAfter}`
      : `${baseUrl}&limit=100`;

    const response = await fetch(pageUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      // 任意一页失败都直接抛错，让上层 catch 决定返回 null（而不是返回半页数据，那会算出错误的 MRR）。
      throw new Error(`Stripe API error: ${response.statusText}`);
    }

    const pageData = (await response.json()) as {
      data: StripeSubscription[];
      has_more?: boolean;
    };

    allSubs.push(...pageData.data);

    // 还有更多数据且本页非空，就把本页最后一条记录的 id 作为下一页游标继续翻；否则结束。
    if (pageData.has_more && pageData.data.length > 0) {
      startingAfter = pageData.data[pageData.data.length - 1].id;
    } else {
      break;
    }
  }

  return allSubs;
}

/**
 * 把单个订阅的月度经常性收入（MRR 贡献）算出来。
 *
 * 关键点：必须按计费周期归一到「月」。
 * - unit_amount 是「以分为单位」的金额，要 /100 换成元/美元。
 * - 按 price.recurring.interval 归一：年付(year) /12、周付(week) ×约 4.345、日付(day) ×约 30.44。
 * - interval_count 表示几个周期计费一次（如每 3 个月一次），要把单价摊到每个月，所以再除以 interval_count。
 * - 再乘以 quantity（席位/数量）。
 *
 * 如果不归一、直接把所有 unit_amount 当月价累加，年付订阅会被当成月价，导致 MRR 虚高 12 倍。
 *
 * @param sub 单个订阅对象
 * @returns 该订阅每月贡献的金额（元/美元，未做最终四舍五入）
 */
function calculateSubscriptionMrr(sub: StripeSubscription): number {
  let monthlyTotal = 0;

  sub.items.data.forEach((item) => {
    // 没有金额或没有计费周期信息的订阅项跳过（例如计量计费 metered，unit_amount 可能为 null）。
    if (!item.price.unit_amount || !item.price.recurring) {
      return;
    }

    // 先把分换算成元/美元。
    const amount = item.price.unit_amount / 100;
    const interval = item.price.recurring.interval;
    // interval_count 至少为 1，做个兜底防止除以 0 或缺失。
    const intervalCount = item.price.recurring.interval_count || 1;
    // quantity 至少为 1，做个兜底防止缺失时贡献被算成 0。
    const quantity = item.quantity || 1;

    // 把不同计费周期都换算成「每月金额」。
    // 最终月价 = 单周期金额换算到月 / intervalCount（每几个周期计费一次要再摊到每月）。
    let monthlyAmount = 0;
    switch (interval) {
      case 'year':
        // 年付：一年 = 12 个月，所以 /12。
        monthlyAmount = amount / (12 * intervalCount);
        break;
      case 'month':
        // 月付：直接除以 interval_count（如每 3 个月一次，则月价为 amount/3）。
        monthlyAmount = amount / intervalCount;
        break;
      case 'week':
        // 周付：一个月约 4.345 周（365.25/12/7），换算成月价。
        monthlyAmount = (amount * 4.345) / intervalCount;
        break;
      case 'day':
        // 日付：一个月约 30.44 天（365.25/12），换算成月价。
        monthlyAmount = (amount * 30.44) / intervalCount;
        break;
      default:
        // 未知周期，保守起见按月价处理（这是兜底分支，正常走不到）。
        monthlyAmount = amount / intervalCount;
    }

    // 最后乘以数量（席位数）。
    monthlyTotal += monthlyAmount * quantity;
  });

  return monthlyTotal;
}

/**
 * Fetches MRR and subscription metrics from Stripe API
 *
 * 返回类型说明：成功返回 StripeMRRResult；
 * 配置缺失或 API 出错时返回 null —— 让上层 sync 跳过写入、保留上一个快照，
 * 绝不静默返回全 0（否则会被 Observer 当成 -100% 暴跌而触发虚假洞察）。
 */
export async function fetchStripeMRR(): Promise<StripeMRRResult | null> {
  if (!validateStripeConfig()) {
    // 配置缺失：返回 null 而不是全 0，让上层跳过写入。
    return null;
  }

  try {
    const secretKey = process.env.STRIPE_SECRET_KEY!;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartUnix = Math.floor(monthStart.getTime() / 1000);

    // ── 1) 活跃订阅：分页拉全部，再按计费周期归一算 MRR ──
    // 用 fetchAllStripeSubscriptions 遵循 has_more 游标分页，避免活跃订阅 > 100 时被截断。
    const activeSubs = await fetchAllStripeSubscriptions(
      // expand items 的 price 才能拿到 recurring（计费周期）信息，确保归一计算可用。
      'https://api.stripe.com/v1/subscriptions?status=active&expand[]=data.items.data.price',
      secretKey
    );

    // 累加每个订阅归一到月的 MRR 贡献。
    let mrr = 0;
    activeSubs.forEach((sub) => {
      mrr += calculateSubscriptionMrr(sub);
    });

    const activeSubscriptions = activeSubs.length;

    // ── 2) 本月新增订阅：用 created>=本月初 过滤，同样分页拉全 ──
    const newSubs = await fetchAllStripeSubscriptions(
      `https://api.stripe.com/v1/subscriptions?created[gte]=${monthStartUnix}`,
      secretKey
    );
    const newThisMonth = newSubs.length;

    // ── 3) 本月取消订阅（churn）：按 canceled_at 落在本月来过滤 ──
    // 为什么不能用 status=canceled && created>=本月初：
    //   - created 是"订阅创建时间"，一个订阅可能几个月前创建、本月才取消，那样会被漏掉；
    //   - 也可能本月创建本月取消，但更早创建本月取消的才是本月真正的流失主体。
    // 正确口径：拉取已取消的订阅，再在内存里用 canceled_at >= 本月初 过滤。
    // 注意：Stripe 没有直接按 canceled_at 范围过滤的列表参数，所以这里先拉 status=canceled 列表
    // （分页拉全），再本地按 canceled_at 时间戳筛选本月。
    const canceledSubs = await fetchAllStripeSubscriptions(
      'https://api.stripe.com/v1/subscriptions?status=canceled',
      secretKey
    );
    const cancelledThisMonth = canceledSubs.filter(
      (sub) => sub.canceled_at !== null && sub.canceled_at >= monthStartUnix
    ).length;

    return {
      mrr: Math.round(mrr * 100) / 100,
      activeSubscriptions,
      newThisMonth,
      cancelledThisMonth,
    };
  } catch (error) {
    // API 出错：打日志后返回 null（不返回全 0），让上层 sync 跳过写入、保留上一个快照。
    console.error('Error fetching Stripe MRR:', error);
    return null;
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
 *
 * 注意：fetchStripeMRR 现在可能返回 null（配置缺失或 API 出错）。
 * 当返回 null 时必须跳过写入，绝不写 0 —— 否则保留不了上一个快照，
 * Observer 会把"这次没拿到数据"误判成"指标暴跌到 0"。
 */
export async function syncStripeKpis(projectId: string | null = null): Promise<void> {
  try {
    const metrics = await fetchStripeMRR();

    // metrics 为 null 表示本次没有有效数据（配置缺失或 API 出错）：
    // 直接 return，不写任何快照，让上一个快照原样保留。
    if (metrics === null) {
      console.warn('⚠️  Stripe metrics unavailable, skipping KPI snapshot write to preserve last snapshot');
      return;
    }

    await Promise.all([
      writeKpiSnapshot(projectId, 'mrr', metrics.mrr, undefined, 'stripe'),
      writeKpiSnapshot(projectId, 'active_subscriptions', metrics.activeSubscriptions, undefined, 'stripe'),
      writeKpiSnapshot(projectId, 'stripe_new_subscriptions', metrics.newThisMonth, undefined, 'stripe'),
      writeKpiSnapshot(projectId, 'stripe_cancelled_subscriptions', metrics.cancelledThisMonth, undefined, 'stripe'),
    ]);
  } catch (error) {
    console.error('Error syncing Stripe KPIs:', error);
  }
}
