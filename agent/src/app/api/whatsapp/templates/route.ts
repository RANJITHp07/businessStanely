import { NextRequest } from "next/server";

import { proxyWhatsApp } from "@/lib/whatsapp/proxy";

export async function GET(req: NextRequest) {
  const refresh = req.nextUrl.searchParams.get("refresh") === "1" ? "?refresh=1" : "";
  return proxyWhatsApp(req, `/templates${refresh}`);
}
