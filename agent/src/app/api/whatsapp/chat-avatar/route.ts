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
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ url: null });
  } finally {
    clearTimeout(timeoutId);
  }
}
