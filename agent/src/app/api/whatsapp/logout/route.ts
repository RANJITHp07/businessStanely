import { NextRequest, NextResponse } from "next/server";

const WHATSAPP_BACKEND_URL =
  process.env.WHATSAPP_BACKEND_URL ??
  process.env.NEXT_PUBLIC_WHATSAPP_BACKEND_URL ??
  "https://69.62.78.14.nip.io";
const SERVICE_TOKEN =
  process.env.WHATSAPP_SERVICE_TOKEN ??
  process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_TOKEN ??
  "";

export async function POST(req: NextRequest) {
  const url = `${WHATSAPP_BACKEND_URL}/logout`;

  const upstream = await fetch(url, {
    method: "POST",
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
