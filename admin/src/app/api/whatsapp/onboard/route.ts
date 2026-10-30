import { NextRequest } from "next/server";

import { proxyWhatsApp } from "@/lib/whatsapp/proxy";

// Receives the Embedded Signup result (code + phone number / WABA ids).
export async function POST(req: NextRequest) {
  return proxyWhatsApp(req, "/onboard", { method: "POST", body: await req.json() });
}
