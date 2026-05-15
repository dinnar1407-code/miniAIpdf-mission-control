import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json() as { token?: string };
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

  if (!ADMIN_TOKEN || body.token !== ADMIN_TOKEN) {
    await new Promise(r => setTimeout(r, 200));
    return new NextResponse('Invalid token', { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('admin_token', ADMIN_TOKEN, {
    httpOnly:  true,
    secure:    true,
    sameSite:  'strict',
    maxAge:    60 * 60 * 24 * 30,
    path:      '/',
  });
  return response;
}
