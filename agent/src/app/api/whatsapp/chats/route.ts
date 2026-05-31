import { NextRequest, NextResponse } from "next/server";

const WHATSAPP_BACKEND_URL =
  process.env.WHATSAPP_BACKEND_URL ??
  process.env.NEXT_PUBLIC_WHATSAPP_BACKEND_URL ??
  "https://13.201.4.152.nip.io";
const SERVICE_TOKEN =
  process.env.WHATSAPP_SERVICE_TOKEN ??
  process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_TOKEN ??
  "";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("search") ?? "";
  const page = req.nextUrl.searchParams.get("page") ?? "1";
  const pageSize = req.nextUrl.searchParams.get("pageSize") ?? "50";
  const url = `${WHATSAPP_BACKEND_URL}/chats?search=${encodeURIComponent(search)}&page=${encodeURIComponent(page)}&pageSize=${encodeURIComponent(pageSize)}`;

  const upstream = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      ...(SERVICE_TOKEN ? { "x-whatsapp-service-token": SERVICE_TOKEN } : {}),
    },
    signal: req.signal,
  });

  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
