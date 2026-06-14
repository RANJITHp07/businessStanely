"use client";

import { resolveAvatarsBatch } from "@/lib/whatsapp/avatar-cache";

// Don't re-warm on every dashboard mount / rapid reload.
const MIN_INTERVAL_MS = 45_000;
const STORAGE_KEY = "wa-prefetch-at";
let startedThisLoad = false;

function recentlyPrefetched(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    const at = Number(sessionStorage.getItem(STORAGE_KEY) ?? 0);
    return Number.isFinite(at) && Date.now() - at < MIN_INTERVAL_MS;
  } catch {
    return false;
  }
}

function markPrefetched() {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/**
 * Warms WhatsApp data while the user is elsewhere in the dashboard, so the first
 * paint of the WhatsApp page is instant:
 *   - hits /status; only proceeds when the session is "ready",
 *   - hits /chats once, which populates the backend's 60s chat cache,
 *   - batch-resolves avatars (warms the backend cache + browser sessionStorage).
 * Best-effort and fire-and-forget — failures are ignored, and it runs at most
 * once per page load (and not more than once per 45s across reloads).
 */
export function prefetchWhatsApp(): void {
  if (startedThisLoad || recentlyPrefetched()) return;
  startedThisLoad = true;

  const run = async () => {
    try {
      const statusRes = await fetch("/api/whatsapp/status", {
        cache: "no-store",
      });
      if (!statusRes.ok) return;
      const state = (await statusRes.json()) as { status?: string };
      if (state?.status !== "ready") return;

      const chatsRes = await fetch("/api/whatsapp/chats?page=1&pageSize=15", {
        cache: "no-store",
      });
      if (!chatsRes.ok) return;
      const data = (await chatsRes.json()) as { chats?: Array<{ id: string }> };
      const ids = Array.isArray(data?.chats)
        ? data.chats.map((chat) => chat.id).filter(Boolean)
        : [];
      if (ids.length > 0) {
        resolveAvatarsBatch(ids);
      }
      markPrefetched();
    } catch {
      // Best-effort warming — ignore network/abort errors.
    }
  };

  if (typeof window === "undefined") return;
  const ric = (
    window as unknown as {
      requestIdleCallback?: (
        fn: () => void,
        opts?: { timeout: number },
      ) => void;
    }
  ).requestIdleCallback;
  if (ric) {
    ric(run, { timeout: 3000 });
  } else {
    setTimeout(run, 1200);
  }
}
