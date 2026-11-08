import { NextRequest, NextResponse } from "next/server";

import { sharedGet } from "@/lib/whatsapp/coalesce";
import { requireWhatsAppUser } from "@/lib/whatsapp/route-auth";

const WHATSAPP_BACKEND_URL =
  process.env.WHATSAPP_BACKEND_URL ??
  process.env.NEXT_PUBLIC_WHATSAPP_BACKEND_URL ??
  "https://69.62.78.14.nip.io";
const SERVICE_TOKEN =
  process.env.WHATSAPP_SERVICE_TOKEN ??
  process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_TOKEN ??
  "";

export async function GET(req: NextRequest) {
  const unauthorized = await requireWhatsAppUser(req);
  if (unauthorized) return unauthorized;

  const url = `${WHATSAPP_BACKEND_URL}/status`;

  try {
    // Concurrent status checks share one upstream call.
    const upstream = await sharedGet(url, {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      ...(SERVICE_TOKEN ? { "x-whatsapp-service-token": SERVICE_TOKEN } : {}),
    }, 15_000);
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.contentType, "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "WhatsApp service is unreachable." }, { status: 502 });
  }
}
