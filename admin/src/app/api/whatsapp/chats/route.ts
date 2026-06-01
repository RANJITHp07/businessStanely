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
  const pageSize = req.nextUrl.searchParams.get("pageSize") ?? "15";
  const url = `${WHATSAPP_BACKEND_URL}/chats?search=${encodeURIComponent(search)}&page=${encodeURIComponent(page)}&pageSize=${encodeURIComponent(pageSize)}`;

  // Hard cap the outbound request at 25 s so Next.js never reaches the
  // ALB / Vercel 30 s timeout and returns a clean 503 instead of a 504.
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 25000);

  // Combine the route's own abort signal with the timeout signal so that
  // cancelling the browser request also cancels the upstream fetch.
  req.signal.addEventListener("abort", () => timeoutController.abort());

  try {
    const upstream = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
        ...(SERVICE_TOKEN ? { "x-whatsapp-service-token": SERVICE_TOKEN } : {}),
      },
      signal: timeoutController.signal,
    });

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err: unknown) {
    const isTimeout =
      err instanceof Error &&
      (err.name === "AbortError" || err.message.includes("aborted"));
    return NextResponse.json(
      {
        error: isTimeout
          ? "WhatsApp backend timed out. Please try again."
          : "Failed to fetch chats.",
      },
      { status: isTimeout ? 503 : 502 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
