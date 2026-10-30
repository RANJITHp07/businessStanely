import { NextRequest, NextResponse } from "next/server";

import { requireWhatsAppUser } from "@/lib/whatsapp/route-auth";

const WHATSAPP_BACKEND_URL =
  process.env.WHATSAPP_BACKEND_URL ??
  process.env.NEXT_PUBLIC_WHATSAPP_BACKEND_URL ??
  "https://69.62.78.14.nip.io";
const SERVICE_TOKEN =
  process.env.WHATSAPP_SERVICE_TOKEN ??
  process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_TOKEN ??
  "";

// Authenticated pass-through to the WhatsApp backend for the Cloud API routes.
export async function proxyWhatsApp(
  req: NextRequest,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
) {
  const unauthorized = await requireWhatsAppUser(req);
  if (unauthorized) return unauthorized;

  try {
    const upstream = await fetch(`${WHATSAPP_BACKEND_URL}${path}`, {
      method: init.method,
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(SERVICE_TOKEN ? { "x-whatsapp-service-token": SERVICE_TOKEN } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: req.signal,
    });
    const data = await upstream.json().catch(() => ({ error: "Invalid response from WhatsApp service." }));
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "WhatsApp service is unreachable." }, { status: 502 });
  }
}
