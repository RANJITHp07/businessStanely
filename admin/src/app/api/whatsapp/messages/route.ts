import { NextRequest, NextResponse } from "next/server";

import { requireWhatsAppAdmin } from "@/lib/whatsapp/auth";
import { whatsappService } from "@/lib/whatsapp/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveMessageRouteErrorStatus(message: string) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("not ready") ||
    normalized.includes("reconnecting") ||
    normalized.includes("detached frame") ||
    normalized.includes("target closed") ||
    normalized.includes("session closed") ||
    normalized.includes("browser has been closed")
  ) {
    return 503;
  }

  if (normalized.includes("not found")) {
    return 404;
  }

  if (normalized.includes("only sent messages")) {
    return 403;
  }

  if (
    normalized.includes("cannot be edited") ||
    normalized.includes("within 15 minutes") ||
    normalized.includes("only text messages") ||
    normalized.includes("media messages")
  ) {
    return 422;
  }

  if (normalized.includes("required")) {
    return 400;
  }

  if (normalized.includes("edit") || normalized.includes("message")) {
    return 422;
  }

  return 500;
}

export async function GET(request: NextRequest) {
  const { response } = await requireWhatsAppAdmin(request);

  if (response) {
    return response;
  }

  const chatId = request.nextUrl.searchParams.get("chatId");

  if (!chatId) {
    return NextResponse.json({ error: "chatId is required." }, { status: 400 });
  }

  try {
    const messages = await whatsappService.listMessages(chatId);
    return NextResponse.json({ messages });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load messages.";
    return NextResponse.json(
      { error: message },
      { status: resolveMessageRouteErrorStatus(message) },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const { response } = await requireWhatsAppAdmin(request);

  if (response) {
    return response;
  }

  const payload = await request.json().catch(() => null);
  const messageId = payload?.messageId;
  const body = payload?.body;

  if (!messageId || !body) {
    return NextResponse.json(
      { error: "messageId and body are required." },
      { status: 400 },
    );
  }

  try {
    const message = await whatsappService.editMessage(messageId, body);
    return NextResponse.json({ message });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to edit message.";
    return NextResponse.json(
      { error: message },
      { status: resolveMessageRouteErrorStatus(message) },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { response } = await requireWhatsAppAdmin(request);

  if (response) {
    return response;
  }

  const payload = await request.json().catch(() => null);
  const messageId = payload?.messageId;
  const everyone = payload?.everyone !== false;

  if (!messageId) {
    return NextResponse.json(
      { error: "messageId is required." },
      { status: 400 },
    );
  }

  try {
    const result = await whatsappService.deleteMessage(messageId, everyone);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete message.";
    return NextResponse.json(
      { error: message },
      { status: resolveMessageRouteErrorStatus(message) },
    );
  }
}
