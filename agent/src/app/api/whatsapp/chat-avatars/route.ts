import { NextRequest, NextResponse } from "next/server";

const WHATSAPP_BACKEND_URL =
  process.env.WHATSAPP_BACKEND_URL ??
  process.env.NEXT_PUBLIC_WHATSAPP_BACKEND_URL ??
  "https://69.62.78.14.nip.io";
const SERVICE_TOKEN =
  process.env.WHATSAPP_SERVICE_TOKEN ??
  process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_TOKEN ??
  "";

// Batch avatar resolution — one request for a whole page of chats instead of
// one request per chat row.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const chatIds = Array.isArray(body?.chatIds) ? body.chatIds : [];
  if (chatIds.length === 0) {
    return NextResponse.json({ urls: {} });
  }

  const url = `${WHATSAPP_BACKEND_URL}/chat-avatars`;

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 20000);
  req.signal.addEventListener("abort", () => timeoutController.abort());

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(SERVICE_TOKEN ? { "x-whatsapp-service-token": SERVICE_TOKEN } : {}),
      },
      body: JSON.stringify({ chatIds }),
      signal: timeoutController.signal,
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ urls: {} });
  } finally {
    clearTimeout(timeoutId);
  }
}
