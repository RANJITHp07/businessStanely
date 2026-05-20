import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get("messageId");
  if (!messageId) {
    return new Response("Missing messageId", { status: 400 });
  }

  // Get backend URL and token from env
  const backendUrl = process.env.NEXT_PUBLIC_WHATSAPP_BACKEND_URL;
  const token = process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_TOKEN || "change_me";
  if (!backendUrl) {
    return new Response("Backend URL not configured", { status: 500 });
  }

  // Build backend media URL
  const url = `${backendUrl.replace(/\/$/, "")}/media?messageId=${encodeURIComponent(messageId)}&token=${encodeURIComponent(token)}`;

  // Proxy the request to backend
  const backendRes = await fetch(url, {
    method: "GET",
    headers: {
      // Forward cookies or auth headers if needed
    },
  });

  if (!backendRes.ok) {
    return new Response(await backendRes.text(), { status: backendRes.status });
  }

  // Stream the media response
  const contentType =
    backendRes.headers.get("content-type") || "application/octet-stream";
  return new Response(backendRes.body, {
    status: 200,
  });
}
