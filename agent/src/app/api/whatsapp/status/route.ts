import { NextRequest, NextResponse } from "next/server";

const NEXT_PUBLIC_WHATSAPP_BACKEND_URL =
  process.env.NEXT_PUBLIC_WHATSAPP_BACKEND_URL ?? "https://13.201.4.152.nip.io";
const SERVICE_TOKEN = process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_TOKEN ?? "";

export async function GET(req: NextRequest) {
  const url = SERVICE_TOKEN
    ? `${NEXT_PUBLIC_WHATSAPP_BACKEND_URL}/status?token=${encodeURIComponent(SERVICE_TOKEN)}`
    : `${NEXT_PUBLIC_WHATSAPP_BACKEND_URL}/status`;

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
