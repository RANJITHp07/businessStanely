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
const TTL_NONE_MS = 5 * 60 * 1000; // 5m for "no avatar" so new photos appear
const STORAGE_PREFIX = "wa-avatar:";

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
