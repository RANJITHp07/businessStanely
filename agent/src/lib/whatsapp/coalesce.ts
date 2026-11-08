// Identical GETs to the WhatsApp backend that are in flight at the same time
// share one upstream request (e.g. many people opening the chat list at once,
// or everyone reloading it after the same "chats-updated" event). Nothing is
// kept after the response arrives, so callers never see stale data.

type UpstreamResult = { status: number; body: string; contentType: string };

const inFlight = new Map<string, Promise<UpstreamResult>>();

export function sharedGet(url: string, headers: Record<string, string>, timeoutMs = 25_000) {
  const existing = inFlight.get(url);
  if (existing) return existing;
  const request = fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) })
    .then(async (response) => ({
      status: response.status,
      body: await response.text(),
      contentType: response.headers.get("content-type") ?? "application/json",
    }))
    .finally(() => inFlight.delete(url));
  inFlight.set(url, request);
  return request;
}
