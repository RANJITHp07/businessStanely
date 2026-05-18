import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const WHATSAPP_BACKEND_URL =
  process.env.WHATSAPP_BACKEND_URL ?? "http://13.201.224.117";
const SERVICE_TOKEN = process.env.WHATSAPP_SERVICE_TOKEN ?? "";

export async function GET(req: NextRequest) {
  const backendStreamUrl = SERVICE_TOKEN
    ? `${WHATSAPP_BACKEND_URL}/stream?token=${encodeURIComponent(SERVICE_TOKEN)}`
    : `${WHATSAPP_BACKEND_URL}/stream`;

  let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        const upstream = await fetch(backendStreamUrl, {
          headers: {
            Accept: "text/event-stream",
            "Cache-Control": "no-cache",
          },
          signal: req.signal,
        });

        if (!upstream.ok || !upstream.body) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ error: "WhatsApp backend unavailable" })}\n\n`,
            ),
          );
          controller.close();
          return;
        }

        upstreamReader = upstream.body.getReader();

        while (true) {
          const { done, value } = await upstreamReader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch (err: unknown) {
        // Suppress expected disconnection errors silently:
        //  - AbortError    → req.signal fired (browser navigated away / closed tab)
        //  - ResponseAborted → Next.js throws this when writing to a response whose
        //                      client has already disconnected (empty message "")
        const isDisconnect =
          err instanceof Error &&
          (err.name === "AbortError" ||
            err.name === "ResponseAborted" ||
            // Fallback: Next.js ResponseAborted has an empty message
            (err.message === "" && err.name !== "Error"));

        if (!isDisconnect) {
          try {
            controller.enqueue(
              new TextEncoder().encode(
                `event: error\ndata: ${JSON.stringify({ error: "Stream connection lost" })}\n\n`,
              ),
            );
          } catch {
            // controller may already be closed
          }
        }
      } finally {
        // cancel() returns a Promise — must attach .catch() or await it,
        // otherwise a rejection (e.g. stream already errored) becomes an
        // unhandled rejection in Node.js.
        upstreamReader?.cancel().catch(() => {});
        try {
          controller.close();
        } catch {
          // ignore
        }
      }
    },
    cancel() {
      upstreamReader?.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
