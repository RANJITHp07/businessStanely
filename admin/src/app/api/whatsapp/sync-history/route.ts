import { NextRequest } from "next/server";

import { proxyWhatsApp } from "@/lib/whatsapp/proxy";

export async function POST(req: NextRequest) {
  return proxyWhatsApp(req, "/sync-history", { method: "POST" });
}
