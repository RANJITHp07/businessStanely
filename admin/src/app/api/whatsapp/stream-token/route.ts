import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const SERVICE_TOKEN =
  process.env.WHATSAPP_SERVICE_TOKEN ??
  process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_TOKEN ??
  "";

// Short-lived token TTL. Only needs to cover the SSE connection handshake — once
// connected the stream stays open regardless of expiry.
const TTL_MS = 60_000;

// Mints a short-lived, HMAC-signed token so the browser can open the WhatsApp
// backend's /stream directly (Amplify/CloudFront can't proxy SSE). The real
// service token is signed with but never exposed to the client.
export async function GET() {
  if (!SERVICE_TOKEN) {
    return NextResponse.json(
      { error: "WhatsApp service token not configured." },
      { status: 500 },
    );
  }

  const payload = String(Date.now() + TTL_MS);
  const signature = crypto
    .createHmac("sha256", SERVICE_TOKEN)
    .update(payload)
    .digest("hex");

  return NextResponse.json(
    { token: `${payload}.${signature}`, expiresIn: Math.floor(TTL_MS / 1000) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
