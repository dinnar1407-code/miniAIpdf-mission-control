import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET;

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/api/admin/verify') {
    return NextResponse.next();
  }

  if (!ADMIN_TOKEN || !CRON_SECRET) {
    return new NextResponse('Server auth not configured', { status: 500 });
  }

  // Path 1: Bearer token (cron / server-to-server)
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${CRON_SECRET}`) {
    return NextResponse.next();
  }

  // Path 2: Admin cookie (browser)
  const adminCookie = request.cookies.get('admin_token')?.value;
  if (adminCookie === ADMIN_TOKEN) {
    return NextResponse.next();
  }

  return new NextResponse('Unauthorized', { status: 401 });
}

export const config = {
  matcher: ['/api/autopilot/:path*', '/api/admin/:path*', '/api/dashboard/:path*'],
};
