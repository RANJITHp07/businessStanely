import { NextRequest, NextResponse } from "next/server";

import { requireWhatsAppUser } from "@/lib/whatsapp/route-auth";

export async function POST(req: NextRequest) {
  const unauthorized = await requireWhatsAppUser(req);
  if (unauthorized) return unauthorized;

  // The WhatsApp session is shared by every agent. Only the admin application
  // may disconnect it; allowing one agent to log out would interrupt everyone.
  return NextResponse.json(
    { error: "Only an administrator can disconnect the WhatsApp session." },
    { status: 403 },
  );
}
