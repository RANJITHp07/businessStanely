import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

import { requireWhatsAppAdmin } from "@/lib/whatsapp/auth";
import { whatsappService } from "@/lib/whatsapp/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function serializeState() {
  const state = whatsappService.getState();

  return {
    ...state,
    qrCodeDataUrl: state.qr
      ? await QRCode.toDataURL(state.qr, { margin: 1, width: 320 })
      : null,
  };
}

export async function GET(request: NextRequest) {
  const { response } = await requireWhatsAppAdmin(request);

  if (response) {
    return response;
  }

  await whatsappService.ensureInitialized();

  return NextResponse.json(await serializeState());
}
