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

  const messageId = request.nextUrl.searchParams.get("messageId");

  if (!messageId) {
    return NextResponse.json(
      { error: "messageId is required." },
      { status: 400 },
    );
  }

  try {
    const media = await whatsappService.getMedia(messageId);
    const buffer = Buffer.from(media.data, "base64");

    return new Response(buffer, {
      headers: {
        "Content-Type": media.mimetype,
        "Content-Disposition": media.filename
          ? `inline; filename="${media.filename.replace(/"/g, '\\"')}"`
          : "inline",
        "Cache-Control": "private, max-age=3600",
        "Content-Length": String(buffer.byteLength),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch media.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
