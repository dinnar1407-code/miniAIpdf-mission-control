import { NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json({
      stripe: {
        configured: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
      },
      gsc: {
        configured: !!(process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GSC_SITE_URL),
      },
      ga: {
        configured: !!(process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GA_PROPERTY_ID),
      },
      telegram: {
        configured: !!process.env.TELEGRAM_BOT_TOKEN,
      },
      twitter: {
        configured: !!process.env.TWITTER_API_KEY,
      },
      wordpress: {
        configured: false,
      },
    });
  } catch (err) {
    console.error("Integration status API error:", err);
    return NextResponse.json({
      stripe: { configured: false },
      gsc: { configured: false },
      ga: { configured: false },
      telegram: { configured: false },
      twitter: { configured: false },
      wordpress: { configured: false },
    });
  }
}
