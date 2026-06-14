import { NextRequest, NextResponse } from "next/server";

const WHATSAPP_BACKEND_URL =
  process.env.WHATSAPP_BACKEND_URL ??
  process.env.NEXT_PUBLIC_WHATSAPP_BACKEND_URL ??
  "https://69.62.78.14.nip.io";
const SERVICE_TOKEN =
  process.env.WHATSAPP_SERVICE_TOKEN ??
  process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_TOKEN ??
  "";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId") ?? "";
  const limit = req.nextUrl.searchParams.get("limit") ?? "80";
  const url = `${WHATSAPP_BACKEND_URL}/messages?chatId=${encodeURIComponent(chatId)}&limit=${encodeURIComponent(limit)}`;

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

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const url = `${WHATSAPP_BACKEND_URL}/messages`;

  const upstream = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Cache-Control": "no-cache",
      ...(SERVICE_TOKEN ? { "x-whatsapp-service-token": SERVICE_TOKEN } : {}),
    },
    body: JSON.stringify(body),
    signal: req.signal,
  });

  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const url = `${WHATSAPP_BACKEND_URL}/messages`;

  const upstream = await fetch(url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Cache-Control": "no-cache",
      ...(SERVICE_TOKEN ? { "x-whatsapp-service-token": SERVICE_TOKEN } : {}),
    },
    body: JSON.stringify(body),
    signal: req.signal,
  });

  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
