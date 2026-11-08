import { NextRequest, NextResponse } from "next/server";

import { verifyAuth } from "@/lib/auth";

// The WhatsApp page makes many small requests (chats, messages, avatars,
// status). Checking the session against the database on every one of them is
// the main cost when many people use it at once, so a successful check is
// remembered per token for a short time. Logout / deactivation still takes
// effect within SESSION_CACHE_MS.
const SESSION_CACHE_MS = 30_000;
const MAX_CACHED_SESSIONS = 1000;
const verifiedSessions = new Map<string, number>(); // token -> valid until (ms)

export async function requireWhatsAppUser(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value;
  const now = Date.now();
  if (token && (verifiedSessions.get(token) ?? 0) > now) return null;

  const user = await verifyAuth(req);
  if (!user) {
    if (token) verifiedSessions.delete(token);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (token) {
    if (verifiedSessions.size >= MAX_CACHED_SESSIONS) {
      for (const [key, until] of verifiedSessions) {
        if (until <= now || verifiedSessions.size >= MAX_CACHED_SESSIONS) verifiedSessions.delete(key);
        if (verifiedSessions.size < MAX_CACHED_SESSIONS / 2) break;
      }
    }
    verifiedSessions.set(token, now + SESSION_CACHE_MS);
  }
  return null;
}
