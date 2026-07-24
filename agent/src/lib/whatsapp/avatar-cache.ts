"use client";

// Shared, app-wide cache for WhatsApp profile-picture URLs.
//
// Without this, every chat row mounts its own avatar <img> and fires a separate
// `/api/whatsapp/chat-avatar` request — and refetches again whenever the row
// remounts (navigation, list refresh, re-render). This module:
//   1. caches resolved URLs in memory for the session,
//   2. persists them to sessionStorage so a reload within the tab is instant,
//   3. de-duplicates concurrent lookups for the same chat into one request.
//
// WhatsApp avatar URLs are signed and can eventually expire, so entries carry a
// TTL and the <img> still falls back to initials on a load error.

type AvatarEntry = { url: string | null; expiresAt: number };

const TTL_FOUND_MS = 6 * 60 * 60 * 1000; // 6h for a real avatar URL
const TTL_NONE_MS = 30 * 1000; // retry transient/null results quickly
// Bump the cache namespace when the backend avatar resolver changes. This
// prevents previously persisted null results from hiding newly resolved
// profile photos after a deployment or dev-server reload.
const STORAGE_PREFIX = "wa-avatar:v4:";

const memoryCache = new Map<string, AvatarEntry>();
const inFlight = new Map<string, Promise<string | null>>();

function readStorage(chatId: string): AvatarEntry | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + chatId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AvatarEntry;
    if (!parsed || typeof parsed.expiresAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(chatId: string, entry: AvatarEntry) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_PREFIX + chatId, JSON.stringify(entry));
  } catch {
    // sessionStorage may be full or unavailable — caching is best-effort.
  }
}

/**
 * Returns the cached avatar URL when fresh:
 *   - a string URL,
 *   - `null` when we know the contact has no avatar,
 *   - `undefined` when nothing is cached and a fetch is needed.
 */
export function getCachedAvatar(chatId: string): string | null | undefined {
  const now = Date.now();

  const mem = memoryCache.get(chatId);
  if (mem && mem.expiresAt > now) return mem.url;

  const stored = readStorage(chatId);
  if (stored && stored.expiresAt > now) {
    memoryCache.set(chatId, stored);
    return stored.url;
  }

  return undefined;
}

/**
 * Resolves a chat's avatar URL, using the cache and de-duplicating concurrent
 * requests. Always resolves (never throws); returns `null` on failure.
 */
export function resolveAvatar(chatId: string): Promise<string | null> {
  const cached = getCachedAvatar(chatId);
  if (cached !== undefined) return Promise.resolve(cached);

  const existing = inFlight.get(chatId);
  if (existing) return existing;

  const request = (async () => {
    try {
      const response = await fetch(
        `/api/whatsapp/chat-avatar?chatId=${encodeURIComponent(chatId)}`,
      );
      if (!response.ok) {
        throw new Error("WhatsApp avatar service is not ready.");
      }
      const data = (await response.json()) as { url?: string | null };
      const url = data?.url ?? null;
      const entry: AvatarEntry = {
        url,
        expiresAt: Date.now() + (url ? TTL_FOUND_MS : TTL_NONE_MS),
      };
      memoryCache.set(chatId, entry);
      writeStorage(chatId, entry);
      return url;
    } catch {
      return null;
    } finally {
      inFlight.delete(chatId);
    }
  })();

  inFlight.set(chatId, request);
  return request;
}

/**
 * Prefetches avatars for a list of chats in a single request. Only the ids that
 * aren't already cached or in-flight are requested. Each resolved id is written
 * to the cache and registered in `inFlight`, so a subsequent `resolveAvatar(id)`
 * (e.g. from a chat row) reuses this batch instead of firing its own request.
 *
 * Call this when a page of chats loads — it turns N per-row requests into one.
 */
export function resolveAvatarsBatch(chatIds: string[]): void {
  const missing = Array.from(
    new Set(
      chatIds.filter(
        (id) => id && getCachedAvatar(id) === undefined && !inFlight.has(id),
      ),
    ),
  );
  if (missing.length === 0) return;

  const batch = (async () => {
    try {
      const response = await fetch("/api/whatsapp/chat-avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatIds: missing }),
      });
      if (!response.ok) {
        throw new Error("WhatsApp avatar service is not ready.");
      }
      const data = (await response.json()) as {
        urls?: Record<string, string | null>;
      };
      const urls = data?.urls ?? {};
      const now = Date.now();
      for (const id of missing) {
        const url = urls[id] ?? null;
        const entry: AvatarEntry = {
          url,
          expiresAt: now + (url ? TTL_FOUND_MS : TTL_NONE_MS),
        };
        memoryCache.set(id, entry);
        writeStorage(id, entry);
      }
      return urls;
    } catch {
      return {} as Record<string, string | null>;
    } finally {
      for (const id of missing) inFlight.delete(id);
    }
  })();

  // Register each id's slice of the batch so concurrent single-id lookups reuse it.
  for (const id of missing) {
    inFlight.set(
      id,
      batch.then((urls) => urls[id] ?? getCachedAvatar(id) ?? null),
    );
  }
}
