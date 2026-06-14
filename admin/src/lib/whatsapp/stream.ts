"use client";

// Opens the realtime SSE connection.
//
// Amplify/CloudFront cannot proxy streaming responses, so the same-origin
// `/api/whatsapp/stream` route does not work in production. Instead we connect
// the browser's EventSource *directly* to the WhatsApp backend (a long-lived
// Node server that streams correctly), authenticated with a short-lived signed
// token fetched from our own server (so the real service token never reaches the
// browser). When the backend URL isn't configured we fall back to the proxy
// route, which still works for local/non-Amplify hosting.

const BACKEND_URL = process.env.NEXT_PUBLIC_WHATSAPP_BACKEND_URL;

export async function openWhatsAppStream(): Promise<EventSource> {
  if (BACKEND_URL) {
    try {
      const res = await fetch("/api/whatsapp/stream-token", {
        cache: "no-store",
      });
      if (res.ok) {
        const { token } = (await res.json()) as { token?: string };
        if (token) {
          const base = BACKEND_URL.replace(/\/$/, "");
          return new EventSource(
            `${base}/stream?token=${encodeURIComponent(token)}`,
          );
        }
      }
    } catch {
      // Fall through to the same-origin proxy route.
    }
  }

  return new EventSource("/api/whatsapp/stream");
}
