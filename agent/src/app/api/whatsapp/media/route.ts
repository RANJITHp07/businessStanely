import { NextRequest } from "next/server";

const WHATSAPP_BACKEND_URL =
  process.env.WHATSAPP_BACKEND_URL ??
  process.env.NEXT_PUBLIC_WHATSAPP_BACKEND_URL ??
  "";
const SERVICE_TOKEN =
  process.env.WHATSAPP_SERVICE_TOKEN ??
  process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_TOKEN ??
  "";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get("messageId");
  if (!messageId) {
    return new Response("Missing messageId", { status: 400 });
  }

  // Get backend URL and token from env
  if (!WHATSAPP_BACKEND_URL) {
    return new Response("Backend URL not configured", { status: 500 });
  }

  const url = `${WHATSAPP_BACKEND_URL.replace(/\/$/, "")}/media?messageId=${encodeURIComponent(messageId)}`;

  // Proxy the request to backend
  const backendRes = await fetch(url, {
    method: "GET",
    cache: "no-store",
    signal: req.signal,
    headers: {
      ...(SERVICE_TOKEN ? { "x-whatsapp-service-token": SERVICE_TOKEN } : {}),
      ...(req.headers.get("range")
        ? { Range: req.headers.get("range") as string }
        : {}),
    },
  });

  if (!backendRes.ok) {
    return new Response(await backendRes.text(), { status: backendRes.status });
  }

  const headers = new Headers();
  const contentType =
    backendRes.headers.get("content-type") || "application/octet-stream";
  const contentLength = backendRes.headers.get("content-length");
  const cacheControl = backendRes.headers.get("cache-control");
  const acceptRanges = backendRes.headers.get("accept-ranges");
  const contentRange = backendRes.headers.get("content-range");

  headers.set("Content-Type", contentType);
  headers.set("Content-Disposition", "inline");
  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }
  if (cacheControl) {
    headers.set("Cache-Control", cacheControl);
  }
  if (acceptRanges) {
    headers.set("Accept-Ranges", acceptRanges);
  }
  if (contentRange) {
    headers.set("Content-Range", contentRange);
  }

  return new Response(backendRes.body, {
    status: backendRes.status,
    headers,
  });
}
