import { NextRequest, NextResponse } from "next/server";

import { requireWhatsAppAdmin } from "@/lib/whatsapp/auth";
import { whatsappService } from "@/lib/whatsapp/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { response } = await requireWhatsAppAdmin(request);

  if (response) {
    return response;
  }

  await whatsappService.logout();
  return NextResponse.json({ ok: true });
}
