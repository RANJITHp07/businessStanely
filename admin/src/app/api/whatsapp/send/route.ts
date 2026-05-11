import { NextRequest, NextResponse } from "next/server";

import { requireWhatsAppAdmin } from "@/lib/whatsapp/auth";
import { whatsappService } from "@/lib/whatsapp/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeBase64Payload(input: string) {
  const trimmed = input.trim();
  const withoutPrefix = trimmed.replace(/^data:[^;]+;base64,/i, "");
  const compact = withoutPrefix.replace(/\s+/g, "");
  return compact;
}

function resolveSendErrorStatus(message: string) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("attachment payload") ||
    normalized.includes("could not be parsed")
  ) {
    return 422;
  }

  if (normalized.includes("required")) {
    return 400;
  }

  if (normalized.includes("not ready") || normalized.includes("reconnect")) {
    return 503;
  }

  if (normalized.includes("too large") || normalized.includes("unsupported")) {
    return 422;
  }

  return 500;
}

export async function POST(request: NextRequest) {
  const { response } = await requireWhatsAppAdmin(request);

  if (response) {
    return response;
  }

  const contentType = request.headers.get("content-type") || "";

  let chatId = "";
  let body = "";
  let media: { data: string; mimetype: string; filename: string } | undefined;
  let attachmentRequested = false;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    chatId = String(
      formData.get("chatId") ||
        formData.get("chat_id") ||
        formData.get("chatID") ||
        "",
    ).trim();
    body = String(formData.get("body") || formData.get("caption") || "").trim();

    const fileEntry =
      formData.get("file") ||
      formData.get("media") ||
      formData.get("attachment");

    attachmentRequested =
      formData.has("file") ||
      formData.has("media") ||
      formData.has("attachment");

    if (fileEntry && typeof fileEntry !== "string") {
      const blob = fileEntry as Blob & { name?: string; type?: string };
      const arrayBuffer = await blob.arrayBuffer();

      if (arrayBuffer.byteLength > 0) {
        const buffer = Buffer.from(arrayBuffer);
        media = {
          data: buffer.toString("base64"),
          mimetype: blob.type || "application/octet-stream",
          filename: blob.name || "attachment",
        };
      }
    }

    if (!media) {
      // Fallback: pick the first binary part if field names are unexpected.
      for (const [, value] of formData.entries()) {
        if (typeof value === "string") {
          continue;
        }

        attachmentRequested = true;
        const blob = value as Blob & { name?: string; type?: string };
        const arrayBuffer = await blob.arrayBuffer();
        if (arrayBuffer.byteLength === 0) {
          continue;
        }

        const buffer = Buffer.from(arrayBuffer);
        media = {
          data: buffer.toString("base64"),
          mimetype: blob.type || "application/octet-stream",
          filename: blob.name || "attachment",
        };
        break;
      }
    }
  } else {
    const payload = await request.json().catch(() => null);
    chatId = String(payload?.chatId || "").trim();
    body = String(payload?.body || "").trim();

    if (
      payload?.media &&
      typeof payload.media === "object" &&
      typeof payload.media.data === "string" &&
      payload.media.data.length > 0
    ) {
      const normalizedData = normalizeBase64Payload(payload.media.data);
      media = {
        data: normalizedData,
        mimetype:
          typeof payload.media.mimetype === "string"
            ? payload.media.mimetype
            : "application/octet-stream",
        filename:
          typeof payload.media.filename === "string"
            ? payload.media.filename
            : "attachment",
      };
      attachmentRequested = true;
    }
  }

  if (media && !media.data) {
    media = undefined;
  }

  if (!chatId || (!body && !media)) {
    return NextResponse.json(
      { error: "chatId and at least one of body or file are required." },
      { status: 400 },
    );
  }

  if (attachmentRequested && !media) {
    return NextResponse.json(
      {
        error:
          "Attachment could not be processed. Please reselect the file and try again.",
      },
      { status: 400 },
    );
  }

  try {
    const message = await whatsappService.sendMessage(chatId, body, media);
    return NextResponse.json({ message });
  } catch (error) {
    console.log(error);
    const message =
      error instanceof Error ? error.message : "Failed to send message.";
    return NextResponse.json(
      { error: message },
      { status: resolveSendErrorStatus(message) },
    );
  }
}
