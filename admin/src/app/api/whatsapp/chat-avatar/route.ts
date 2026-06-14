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
  if (!chatId) {
    return NextResponse.json({ error: "chatId is required." }, { status: 400 });
  }

  const url = `${WHATSAPP_BACKEND_URL}/chat-avatar?chatId=${encodeURIComponent(chatId)}`;

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 12000);
  req.signal.addEventListener("abort", () => timeoutController.abort());

  try {
    const upstream = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(SERVICE_TOKEN ? { "x-whatsapp-service-token": SERVICE_TOKEN } : {}),
      },
      signal: timeoutController.signal,
    });
    const data = await upstream.json();
    return NextResponse.json(data, {
      status: upstream.status,
      // Let the browser disk-cache the avatar URL briefly too, on top of the
      // in-memory + sessionStorage caches.
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch {
    return NextResponse.json({ url: null });
  } finally {
    clearTimeout(timeoutId);
  }
}
