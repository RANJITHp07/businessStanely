import { NextRequest, NextResponse } from "next/server";

const NEXT_PUBLIC_WHATSAPP_BACKEND_URL =
  process.env.NEXT_PUBLIC_WHATSAPP_BACKEND_URL ?? "https://13.201.4.152.nip.io";
const SERVICE_TOKEN = process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_TOKEN ?? "";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const url = SERVICE_TOKEN
    ? `${NEXT_PUBLIC_WHATSAPP_BACKEND_URL}/send?token=${encodeURIComponent(SERVICE_TOKEN)}`
    : `${NEXT_PUBLIC_WHATSAPP_BACKEND_URL}/send`;

  const upstream = await fetch(url, {
    method: "POST",
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
