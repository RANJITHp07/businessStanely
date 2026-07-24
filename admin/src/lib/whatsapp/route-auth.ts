import { NextRequest, NextResponse } from "next/server";

import { verifyAuth } from "@/lib/auth";

export async function requireWhatsAppUser(req: NextRequest) {
  const user = await verifyAuth(req);
  return user
    ? null
    : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
