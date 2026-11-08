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

  const search = req.nextUrl.searchParams.get("search") ?? "";
  const page = req.nextUrl.searchParams.get("page") ?? "1";
  const pageSize = req.nextUrl.searchParams.get("pageSize") ?? "15";
  const url = `${WHATSAPP_BACKEND_URL}/chats?search=${encodeURIComponent(search)}&page=${encodeURIComponent(page)}&pageSize=${encodeURIComponent(pageSize)}`;

  try {
    // Concurrent identical requests share one upstream call. Capped at 25 s so
    // the hosting 30 s timeout never hits; a clean 503 is returned instead.
    const upstream = await sharedGet(url, {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      ...(SERVICE_TOKEN ? { "x-whatsapp-service-token": SERVICE_TOKEN } : {}),
    });
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.contentType, "Cache-Control": "no-store" },
    });
  } catch (err: unknown) {
    const isTimeout =
      err instanceof Error &&
      (err.name === "AbortError" || err.name === "TimeoutError" || err.message.includes("aborted"));
    return NextResponse.json(
      {
        error: isTimeout
          ? "WhatsApp backend timed out. Please try again."
          : "Failed to fetch chats.",
      },
      { status: isTimeout ? 503 : 502 },
    );
  }
}
