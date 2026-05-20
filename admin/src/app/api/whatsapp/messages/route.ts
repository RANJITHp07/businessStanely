import { NextRequest, NextResponse } from "next/server";

const NEXT_PUBLIC_WHATSAPP_BACKEND_URL =
  process.env.NEXT_PUBLIC_WHATSAPP_BACKEND_URL ?? "https://13.201.4.152.nip.io";
const SERVICE_TOKEN = process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_TOKEN ?? "";

export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get("chatId") ?? "";
  const limit = req.nextUrl.searchParams.get("limit") ?? "80";
  const url = SERVICE_TOKEN
    ? `${NEXT_PUBLIC_WHATSAPP_BACKEND_URL}/messages?chatId=${encodeURIComponent(chatId)}&limit=${encodeURIComponent(limit)}&token=${encodeURIComponent(SERVICE_TOKEN)}`
    : `${NEXT_PUBLIC_WHATSAPP_BACKEND_URL}/messages?chatId=${encodeURIComponent(chatId)}&limit=${encodeURIComponent(limit)}`;

  const upstream = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
    signal: req.signal,
  });

  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const url = SERVICE_TOKEN
    ? `${NEXT_PUBLIC_WHATSAPP_BACKEND_URL}/messages?token=${encodeURIComponent(SERVICE_TOKEN)}`
    : `${NEXT_PUBLIC_WHATSAPP_BACKEND_URL}/messages`;

  const upstream = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify(body),
    signal: req.signal,
  });

  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const url = SERVICE_TOKEN
    ? `${NEXT_PUBLIC_WHATSAPP_BACKEND_URL}/messages?token=${encodeURIComponent(SERVICE_TOKEN)}`
    : `${NEXT_PUBLIC_WHATSAPP_BACKEND_URL}/messages`;

  const upstream = await fetch(url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify(body),
    signal: req.signal,
  });

  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
