import { NextRequest, NextResponse } from "next/server";

import { requireWhatsAppAdmin } from "@/lib/whatsapp/auth";
import { whatsappService } from "@/lib/whatsapp/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { response } = await requireWhatsAppAdmin(request);

  if (response) {
    return response;
  }

  const search = request.nextUrl.searchParams.get("search") ?? "";

  try {
    const chats = await whatsappService.listChats(search);
    return NextResponse.json({ chats });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load chats.";

    console.error("[WhatsApp] Failed to load chats:", message);

    if (message.startsWith("WhatsApp is not ready yet.")) {
      const state = whatsappService.getState();
      return NextResponse.json(
        {
          error: message,
          code: "WHATSAPP_NOT_READY",
          state: {
            status: state.status,
            lastUpdatedAt: state.lastUpdatedAt,
            error: state.error,
          },
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
