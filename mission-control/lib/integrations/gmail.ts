/**
 * Gmail API 集成 — FurMates 邮件自动化
 *
 * 使用 OAuth2（Refresh Token 方式，适合服务端无人值守）
 *
 * 环境变量：
 * - GMAIL_CLIENT_ID       Google OAuth2 Client ID
 * - GMAIL_CLIENT_SECRET   Google OAuth2 Client Secret
 * - GMAIL_REFRESH_TOKEN   一次性授权后获得的 Refresh Token
 * - GMAIL_FROM_EMAIL      发件人邮箱（如 terry@furmales.com）
 *
 * 获取 Refresh Token：
 * 1. Google Cloud Console → APIs → Gmail API → 启用
 * 2. 创建 OAuth2 凭证（Desktop App 类型）
 * 3. 运行：node -e "..." 或使用 OAuth Playground 获取 refresh_token
 */

// ==================== OAuth2 Token 刷新 ====================

let _cachedAccessToken: string | null  = null;
let _tokenExpiresAt:    number         = 0;

async function getAccessToken(): Promise<string> {
  if (_cachedAccessToken && Date.now() < _tokenExpiresAt - 60_000) {
    return _cachedAccessToken;
  }

  const clientId     = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Gmail OAuth2 凭证未配置（GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN）");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail token 刷新失败: ${err}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  _cachedAccessToken = data.access_token;
  _tokenExpiresAt    = Date.now() + data.expires_in * 1000;
  return _cachedAccessToken;
}

// ==================== 发送邮件 ====================

export interface EmailOptions {
  to:      string;
  subject: string;
  html:    string;
  text?:   string;   // 纯文本备用版本
  from?:   string;   // 默认读取 GMAIL_FROM_EMAIL
}

/**
 * 通过 Gmail API 发送邮件
 */
export async function sendEmail(opts: EmailOptions): Promise<{ messageId: string }> {
  const accessToken = await getAccessToken();
  const from        = opts.from ?? process.env.GMAIL_FROM_EMAIL ?? "me";

  // 构建 RFC 2822 邮件格式
  const boundary = `boundary_${Date.now()}`;
  const rawLines = [
    `From: ${from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    opts.text ?? opts.html.replace(/<[^>]+>/g, ""),
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    opts.html,
    ``,
    `--${boundary}--`,
  ];

  const raw = Buffer.from(rawLines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail 发送失败 ${res.status}: ${err}`);
  }

  const data = await res.json() as { id: string };
  return { messageId: data.id };
}

// ==================== FurMates 邮件模板 ====================

export interface EmailTemplateVars {
  name:       string;   // 客户名
  email:      string;
  couponCode?: string;  // 优惠码
  productUrl?: string;  // 产品链接
  storeUrl?:   string;  // 店铺链接
}

const STORE_URL  = "https://furmales.com";
const BRAND_NAME = "FurMates";
const BRAND_COLOR = "#F59E0B";

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr><td style="background:${BRAND_COLOR};padding:24px 32px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:24px">🐾 ${BRAND_NAME}</h1>
        </td></tr>
        <tr><td style="padding:32px">
          ${content}
        </td></tr>
        <tr><td style="background:#f3f4f6;padding:20px 32px;text-align:center">
          <p style="margin:0;color:#6b7280;font-size:13px">
            © ${new Date().getFullYear()} ${BRAND_NAME} ·
            <a href="${STORE_URL}" style="color:${BRAND_COLOR}">Visit Store</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export const EMAIL_TEMPLATES = {

  // Day 0 — 欢迎邮件
  welcome: (vars: EmailTemplateVars) => ({
    subject: `Welcome to the ${BRAND_NAME} Family! 🐾`,
    html: emailWrapper(`
      <h2 style="color:#111827;margin-top:0">Hi ${vars.name}! 👋</h2>
      <p style="color:#374151;line-height:1.6">
        Welcome to <strong>${BRAND_NAME}</strong> — we're so excited to have you here!
        We're on a mission to make every pet's life happier and healthier.
      </p>
      <p style="color:#374151;line-height:1.6">
        Here's what you can expect from us:
      </p>
      <ul style="color:#374151;line-height:1.8">
        <li>🎁 Exclusive deals and early access to new products</li>
        <li>🐶 Expert pet care tips and advice</li>
        <li>💌 Personalized recommendations for your furry friend</li>
      </ul>
      <div style="text-align:center;margin:32px 0">
        <a href="${vars.storeUrl ?? STORE_URL}"
           style="background:${BRAND_COLOR};color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Shop Now →
        </a>
      </div>
      <p style="color:#6b7280;font-size:14px">With love,<br>The ${BRAND_NAME} Team 🐾</p>
    `),
  }),

  // Day 3 — 产品介绍
  productIntro: (vars: EmailTemplateVars) => ({
    subject: `What makes ${BRAND_NAME} different? 🌟`,
    html: emailWrapper(`
      <h2 style="color:#111827;margin-top:0">Hey ${vars.name}!</h2>
      <p style="color:#374151;line-height:1.6">
        You joined ${BRAND_NAME} a few days ago, and we want to share what makes us special.
      </p>
      <div style="background:#fef3c7;border-radius:8px;padding:20px;margin:20px 0">
        <h3 style="color:#92400e;margin-top:0">Why pet owners love us:</h3>
        <ul style="color:#92400e;line-height:1.8;margin:0">
          <li>✅ Premium quality, vet-approved products</li>
          <li>✅ Free shipping on orders over $35</li>
          <li>✅ 30-day hassle-free returns</li>
          <li>✅ Dedicated pet care support team</li>
        </ul>
      </div>
      <div style="text-align:center;margin:32px 0">
        <a href="${vars.productUrl ?? STORE_URL}"
           style="background:${BRAND_COLOR};color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Browse Products →
        </a>
      </div>
    `),
  }),

  // Day 7 — 限时优惠
  limitedOffer: (vars: EmailTemplateVars) => ({
    subject: `${vars.name}, a special offer just for you 🎁`,
    html: emailWrapper(`
      <h2 style="color:#111827;margin-top:0">Hi ${vars.name}! 🎉</h2>
      <p style="color:#374151;line-height:1.6">
        We want to make your first ${BRAND_NAME} experience unforgettable.
      </p>
      <div style="background:linear-gradient(135deg,#fef3c7,#fde68a);border-radius:12px;padding:28px;text-align:center;margin:24px 0">
        <p style="margin:0 0 8px;color:#92400e;font-size:14px;font-weight:600">YOUR EXCLUSIVE CODE</p>
        <p style="margin:0;font-size:36px;font-weight:900;color:#92400e;letter-spacing:4px">
          ${vars.couponCode ?? "FURMATES10"}
        </p>
        <p style="margin:8px 0 0;color:#78350f;font-size:14px">10% off your first order · Expires in 7 days</p>
      </div>
      <div style="text-align:center;margin:32px 0">
        <a href="${vars.storeUrl ?? STORE_URL}"
           style="background:${BRAND_COLOR};color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Redeem Offer →
        </a>
      </div>
    `),
  }),

  // Day 14 — 最后提醒
  lastChance: (vars: EmailTemplateVars) => ({
    subject: `Last chance, ${vars.name}! Your offer expires soon ⏰`,
    html: emailWrapper(`
      <h2 style="color:#111827;margin-top:0">Hey ${vars.name} — don't miss out!</h2>
      <p style="color:#374151;line-height:1.6">
        Your exclusive discount code <strong>${vars.couponCode ?? "FURMATES10"}</strong> is expiring soon.
        This is your last chance to save on your first order!
      </p>
      <div style="background:#fee2e2;border-radius:8px;padding:16px;margin:20px 0;text-align:center">
        <p style="margin:0;color:#991b1b;font-weight:600">⏰ Offer expires in 24 hours</p>
      </div>
      <div style="text-align:center;margin:32px 0">
        <a href="${vars.storeUrl ?? STORE_URL}"
           style="background:#ef4444;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Shop Before It Expires →
        </a>
      </div>
    `),
  }),

  // Day 21 — 唤醒
  wakeUp: (vars: EmailTemplateVars) => ({
    subject: `Hey ${vars.name}, still looking for the perfect pet products? 🐾`,
    html: emailWrapper(`
      <h2 style="color:#111827;margin-top:0">Hi ${vars.name}! 👋</h2>
      <p style="color:#374151;line-height:1.6">
        We noticed you haven't had a chance to explore ${BRAND_NAME} yet.
        No pressure — but we'd love to help you find the perfect products for your furry friend.
      </p>
      <p style="color:#374151;line-height:1.6">
        We've recently added new arrivals we think you'll love. Come take a look!
      </p>
      <div style="text-align:center;margin:32px 0">
        <a href="${vars.storeUrl ?? STORE_URL}"
           style="background:${BRAND_COLOR};color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          See What's New →
        </a>
      </div>
      <p style="color:#6b7280;font-size:14px">
        Have questions? Just reply to this email — we're always here to help! 😊
      </p>
    `),
  }),

  // Angel 客户欢迎（50% OFF）
  angelWelcome: (vars: EmailTemplateVars) => ({
    subject: `🌟 You're a ${BRAND_NAME} Angel Customer — Special Reward Inside!`,
    html: emailWrapper(`
      <h2 style="color:#111827;margin-top:0">Congratulations, ${vars.name}! 🎉</h2>
      <p style="color:#374151;line-height:1.6">
        You've been selected as a <strong>${BRAND_NAME} Angel Customer</strong> —
        an exclusive group of our most valued community members.
      </p>
      <div style="background:linear-gradient(135deg,#fef3c7,#fde68a);border-radius:12px;padding:28px;text-align:center;margin:24px 0">
        <p style="margin:0 0 8px;color:#92400e;font-size:14px;font-weight:600">ANGEL EXCLUSIVE CODE</p>
        <p style="margin:0;font-size:40px;font-weight:900;color:#92400e;letter-spacing:4px">
          ${vars.couponCode ?? "ANGEL50"}
        </p>
        <p style="margin:8px 0 0;color:#78350f;font-weight:600">50% OFF your next order</p>
        <p style="margin:4px 0 0;color:#78350f;font-size:13px">No minimum order · Valid for 30 days</p>
      </div>
      <p style="color:#374151;line-height:1.6">
        As an Angel Customer, you'll receive:
      </p>
      <ul style="color:#374151;line-height:1.8">
        <li>👼 Early access to new products</li>
        <li>🎁 Exclusive discounts and surprises</li>
        <li>📣 Your feedback shapes our products</li>
        <li>💬 Direct line to our founder</li>
      </ul>
      <div style="text-align:center;margin:32px 0">
        <a href="${vars.storeUrl ?? STORE_URL}"
           style="background:${BRAND_COLOR};color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Redeem Your Angel Reward →
        </a>
      </div>
      <p style="color:#6b7280;font-size:14px">
        Thank you for being part of our journey. 🐾<br>
        With love, The ${BRAND_NAME} Team
      </p>
    `),
  }),

};

export type EmailTemplateKey = keyof typeof EMAIL_TEMPLATES;
