import { NextRequest } from "next/server";
import QRCode from "qrcode";

import { requireWhatsAppAdmin } from "@/lib/whatsapp/auth";
import { subscribeWhatsAppEvent } from "@/lib/whatsapp/realtime";
import { whatsappService } from "@/lib/whatsapp/service";
import type { WhatsAppEventPayload } from "@/lib/whatsapp/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

async function toSerializableState() {
  const state = whatsappService.getState();

  return {
    ...state,
    qrCodeDataUrl: state.qr
      ? await QRCode.toDataURL(state.qr, { margin: 1, width: 320 })
      : null,
  };
}

function formatSse(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: NextRequest) {
  const { response } = await requireWhatsAppAdmin(request);

  if (response) {
    return response;
  }

  await whatsappService.ensureInitialized();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const push = (event: string, data: unknown) => {
        if (closed) {
          return;
        }

        controller.enqueue(formatSse(event, data));
      };

      push("state", await toSerializableState());

      const unsubscribeState = subscribeWhatsAppEvent("state", async () => {
        push("state", await toSerializableState());
      });

      const unsubscribeChats = subscribeWhatsAppEvent("chats-updated", () => {
        push("chats-updated", { at: Date.now() });
      });

      const unsubscribeMessage = subscribeWhatsAppEvent(
        "message",
        (payload: WhatsAppEventPayload) => {
          push("message", payload);
        },
      );

      const unsubscribeMessages = subscribeWhatsAppEvent(
        "messages-updated",
        (payload: WhatsAppEventPayload) => {
          push("messages-updated", payload);
        },
      );

      const pingInterval = setInterval(() => {
        if (!closed) {
          controller.enqueue(formatSse("ping", { at: Date.now() }));
        }
      }, 25000);

      const close = () => {
        if (closed) {
          return;
        }

        closed = true;
        clearInterval(pingInterval);
        unsubscribeState();
        unsubscribeChats();
        unsubscribeMessage();
        unsubscribeMessages();
        controller.close();
      };

      request.signal.addEventListener("abort", close);
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
