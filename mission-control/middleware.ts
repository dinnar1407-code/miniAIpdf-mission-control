import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET;

// 公开路由白名单：这些端点有各自独立的鉴权方式，或本就是公开信息，不走管理员 cookie / Bearer。
// 除此之外，/api 下所有路由默认一律要求鉴权（default-deny，见下方 matcher）。
const PUBLIC_API_PREFIXES = [
  '/api/webhooks', // Shopify / Stripe / Telegram，各自做签名校验
  '/api/inngest',  // Inngest 用自己的签名校验回调本端点
  '/api/cron',     // 由各 cron 路由内部校验 CRON_SECRET
  '/api/version',  // 公开的版本信息
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 登录端点本身必须公开，否则拿不到 cookie 就无法登录
  if (pathname === '/api/admin/verify') {
    return NextResponse.next();
  }

  // 公开白名单：前缀匹配即放行，交给各端点自己的鉴权
  if (PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  if (!ADMIN_TOKEN || !CRON_SECRET) {
    return new NextResponse('Server auth not configured', { status: 500 });
  }

  // 鉴权方式 1：Bearer token（cron / server-to-server）
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${CRON_SECRET}`) {
    return NextResponse.next();
  }

  // 鉴权方式 2：管理员 cookie（浏览器）
  const adminCookie = request.cookies.get('admin_token')?.value;
  if (adminCookie === ADMIN_TOKEN) {
    return NextResponse.next();
  }

  return new NextResponse('Unauthorized', { status: 401 });
}

export const config = {
  // 默认对所有 /api 路由生效；公开端点在函数内部通过白名单放行（default-deny）
  matcher: ['/api/:path*'],
};
