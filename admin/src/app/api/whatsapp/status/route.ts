import { NextRequest, NextResponse } from "next/server";

const WHATSAPP_BACKEND_URL =
  process.env.WHATSAPP_BACKEND_URL ?? "http://13.201.4.152";
const SERVICE_TOKEN = process.env.WHATSAPP_SERVICE_TOKEN ?? "";

export async function GET(req: NextRequest) {
  console.log(WHATSAPP_BACKEND_URL, SERVICE_TOKEN);
  const url = SERVICE_TOKEN
    ? `${WHATSAPP_BACKEND_URL}/status?token=${encodeURIComponent(SERVICE_TOKEN)}`
    : `${WHATSAPP_BACKEND_URL}/status`;

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
