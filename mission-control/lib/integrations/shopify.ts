/**
 * Shopify Admin API Client — FurMates
 *
 * 凭证读取优先级：
 * 1. 函数参数直接传入
 * 2. DB ChannelCredential（channelId = "shopify"）
 * 3. 环境变量 SHOPIFY_SHOP_DOMAIN + SHOPIFY_ACCESS_TOKEN
 */
import { prisma } from "@/lib/db";
import crypto from "crypto";

// ==================== 类型定义 ====================

export interface ShopifyConfig {
  shopDomain:  string;   // xcwpr0-du.myshopify.com
  accessToken: string;   // shpat_xxx
  apiVersion?: string;   // 默认 "2024-01"
}

export interface ShopifyProduct {
  id: string;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  status: "active" | "draft" | "archived";
  tags: string;
  variants: ShopifyVariant[];
  images: Array<{ src: string }>;
  created_at: string;
  updated_at: string;
}

export interface ShopifyVariant {
  id: string;
  product_id: string;
  title: string;
  price: string;
  sku: string;
  inventory_quantity: number;
  inventory_item_id: string;
}

export interface ShopifyOrder {
  id: string;
  order_number: number;
  email: string;
  financial_status: string;
  fulfillment_status: string | null;
  total_price: string;
  currency: string;
  created_at: string;
  line_items: ShopifyLineItem[];
  customer?: ShopifyCustomer;
  shipping_address?: Record<string, string>;
  note: string | null;
  tags: string;
}

export interface ShopifyLineItem {
  id: string;
  title: string;
  quantity: number;
  price: string;
  sku: string;
  variant_id: string;
}

export interface ShopifyCustomer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  orders_count: number;
  total_spent: string;
  tags: string;
  note: string | null;
  accepts_marketing: boolean;
  created_at: string;
}

export interface ShopifyInventoryLevel {
  inventory_item_id: string;
  location_id: string;
  available: number;
  updated_at: string;
}

export interface ShopifyLocation {
  id: string;
  name: string;
  address1: string;
  city: string;
  country: string;
  active: boolean;
}

// ==================== 客户端 ====================

export class ShopifyClient {
  private shopDomain:  string;
  private accessToken: string;
  private apiVersion:  string;
  private baseUrl:     string;

  constructor(config: ShopifyConfig) {
    this.shopDomain  = config.shopDomain.replace(/\/$/, "");
    this.accessToken = config.accessToken;
    this.apiVersion  = config.apiVersion ?? "2024-01";
    this.baseUrl     = `https://${this.shopDomain}/admin/api/${this.apiVersion}`;
  }

  private async request<T>(
    endpoint: string,
    options: { method?: string; body?: unknown } = {}
  ): Promise<T> {
    const url    = this.baseUrl + endpoint;
    const method = options.method ?? "GET";
    const headers: Record<string, string> = {
      "Content-Type":             "application/json",
      "X-Shopify-Access-Token":   this.accessToken,
    };

    let retries = 3;
    while (retries > 0) {
      const res = await fetch(url, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      // Rate limit
      if (res.status === 429) {
        const retryAfter = parseFloat(res.headers.get("Retry-After") ?? "2") * 1000;
        await new Promise(r => setTimeout(r, retryAfter));
        retries--;
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Shopify API ${res.status}: ${text}`);
      }

      return res.json() as Promise<T>;
    }
    throw new Error("Shopify request failed after retries");
  }

  private qs(params: Record<string, unknown>): string {
    const entries = Object.entries(params).filter(([, v]) => v != null);
    if (!entries.length) return "";
    return "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
  }

  // ── Products ──────────────────────────────────────────────
  listProducts(p: { limit?: number; status?: string; vendor?: string; product_type?: string } = {}) {
    return this.request<{ products: ShopifyProduct[] }>(`/products.json${this.qs(p)}`);
  }
  getProduct(id: string) {
    return this.request<{ product: ShopifyProduct }>(`/products/${id}.json`);
  }
  createProduct(data: Partial<ShopifyProduct>) {
    return this.request<{ product: ShopifyProduct }>("/products.json", { method: "POST", body: { product: data } });
  }
  updateProduct(id: string, data: Partial<ShopifyProduct>) {
    return this.request<{ product: ShopifyProduct }>(`/products/${id}.json`, { method: "PUT", body: { product: data } });
  }
  deleteProduct(id: string) {
    return this.request<Record<string, never>>(`/products/${id}.json`, { method: "DELETE" });
  }

  // ── Orders ────────────────────────────────────────────────
  listOrders(p: { status?: string; limit?: number; created_at_min?: string; financial_status?: string } = {}) {
    return this.request<{ orders: ShopifyOrder[] }>(`/orders.json${this.qs(p)}`);
  }
  getOrder(id: string) {
    return this.request<{ order: ShopifyOrder }>(`/orders/${id}.json`);
  }
  updateOrder(id: string, data: Partial<ShopifyOrder>) {
    return this.request<{ order: ShopifyOrder }>(`/orders/${id}.json`, { method: "PUT", body: { order: data } });
  }
  cancelOrder(id: string, reason?: string) {
    return this.request<{ order: ShopifyOrder }>(`/orders/${id}/cancel.json`, {
      method: "POST",
      body:   reason ? { reason } : {},
    });
  }
  async fulfillOrder(orderId: string, data: { tracking_number?: string; tracking_company?: string } = {}) {
    const { fulfillment_orders } = await this.request<{ fulfillment_orders: Array<{ id: string }> }>(
      `/orders/${orderId}/fulfillment_orders.json`
    );
    if (!fulfillment_orders.length) throw new Error("No fulfillment orders found");
    return this.request<{ fulfillment: unknown }>("/fulfillments.json", {
      method: "POST",
      body: {
        fulfillment: {
          line_items_by_fulfillment_order: fulfillment_orders.map(fo => ({ fulfillment_order_id: fo.id })),
          ...data,
        },
      },
    });
  }
  createRefund(orderId: string, data: unknown) {
    return this.request(`/orders/${orderId}/refunds.json`, { method: "POST", body: { refund: data } });
  }
  addOrderNote(id: string, note: string) {
    return this.updateOrder(id, { note } as Partial<ShopifyOrder>);
  }

  // ── Customers ─────────────────────────────────────────────
  listCustomers(p: { limit?: number; email?: string } = {}) {
    return this.request<{ customers: ShopifyCustomer[] }>(`/customers.json${this.qs(p)}`);
  }
  getCustomer(id: string) {
    return this.request<{ customer: ShopifyCustomer }>(`/customers/${id}.json`);
  }
  updateCustomer(id: string, data: Partial<ShopifyCustomer>) {
    return this.request<{ customer: ShopifyCustomer }>(`/customers/${id}.json`, { method: "PUT", body: { customer: data } });
  }
  searchCustomers(query: string) {
    return this.request<{ customers: ShopifyCustomer[] }>(`/customers/search.json?query=${encodeURIComponent(query)}`);
  }

  // ── Inventory ─────────────────────────────────────────────
  getInventoryLevels(params: { location_id?: string; inventory_item_ids?: string[] } = {}) {
    const p: Record<string, string> = {};
    if (params.location_id)            p.location_ids = params.location_id;
    if (params.inventory_item_ids?.length) p.inventory_item_ids = params.inventory_item_ids.join(",");
    return this.request<{ inventory_levels: ShopifyInventoryLevel[] }>(`/inventory_levels.json${this.qs(p)}`);
  }
  listLocations() {
    return this.request<{ locations: ShopifyLocation[] }>("/locations.json");
  }
  setInventoryLevel(data: { inventory_item_id: string; location_id: string; available: number }) {
    return this.request<{ inventory_level: ShopifyInventoryLevel }>("/inventory_levels/set.json", { method: "POST", body: data });
  }
  adjustInventoryLevel(data: { inventory_item_id: string; location_id: string; available_adjustment: number }) {
    return this.request<{ inventory_level: ShopifyInventoryLevel }>("/inventory_levels/adjust.json", { method: "POST", body: data });
  }

  // ── 统计 ──────────────────────────────────────────────────
  async getOrderSummary(days = 7): Promise<{
    totalOrders: number;
    totalRevenue: number;
    currency: string;
    avgOrderValue: number;
    pendingFulfillment: number;
  }> {
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    const { orders } = await this.listOrders({ status: "any", limit: 250, created_at_min: since });
    const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total_price), 0);
    const pending      = orders.filter(o => o.fulfillment_status === null && o.financial_status === "paid").length;
    return {
      totalOrders:        orders.length,
      totalRevenue:       Math.round(totalRevenue * 100) / 100,
      currency:           orders[0]?.currency ?? "USD",
      avgOrderValue:      orders.length > 0 ? Math.round((totalRevenue / orders.length) * 100) / 100 : 0,
      pendingFulfillment: pending,
    };
  }
}

// ==================== 工厂函数 ====================

let _cachedClient: ShopifyClient | null = null;

export async function getShopifyClient(): Promise<ShopifyClient | null> {
  // 优先读 DB（Settings → Channels 配置后生效）
  try {
    const cred = await prisma.channelCredential.findUnique({ where: { channelId: "shopify" } });
    if (cred?.enabled) {
      const c = JSON.parse(cred.credentials) as Record<string, string>;
      if (c.shopDomain && c.accessToken) {
        return new ShopifyClient({ shopDomain: c.shopDomain, accessToken: c.accessToken });
      }
    }
  } catch {}

  // 回退到环境变量
  const shopDomain  = process.env.SHOPIFY_SHOP_DOMAIN;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  if (shopDomain && accessToken) {
    return new ShopifyClient({ shopDomain, accessToken });
  }

  return null;
}

// ==================== Webhook 签名验证 ====================

export function verifyShopifyWebhook(body: string, hmacHeader: string): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) return false;
  const computed = crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64");
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hmacHeader));
}
