import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/auth";

export async function requireWhatsAppAdmin(request: NextRequest) {
  const admin = await getCurrentAdmin(request);

  if (!admin) {
    return {
      admin: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { admin, response: null };
}
