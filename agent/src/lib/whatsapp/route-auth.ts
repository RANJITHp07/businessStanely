import { NextRequest, NextResponse } from "next/server";

import { getCurrentAgent } from "@/lib/auth";

export async function requireWhatsAppUser(req: NextRequest) {
  const agent = await getCurrentAgent(req);
  return agent
    ? null
    : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
