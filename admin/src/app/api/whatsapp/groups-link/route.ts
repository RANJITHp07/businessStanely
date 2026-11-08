import { NextRequest } from "next/server";

import { proxyWhatsApp } from "@/lib/whatsapp/proxy";

export const dynamic = "force-dynamic";

// QR code and link status of the WhatsApp Web linked device used for groups.
export async function GET(req: NextRequest) {
  return proxyWhatsApp(req, "/groups/link");
}

// {"action":"link"} shows a fresh QR; {"action":"unlink"} removes the linked device.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return proxyWhatsApp(req, "/groups/link", {
    method: "POST",
    body: { action: body?.action === "unlink" ? "unlink" : "link" },
  });
}
