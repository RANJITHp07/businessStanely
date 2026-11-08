// Delivers events to whatsapp-cloud (POST /groups/ingest) in order, batched,
// retrying until cloud accepts them, so a cloud restart loses nothing that
// arrived while this process was up.

const cloudUrl = (process.env.WHATSAPP_CLOUD_URL ?? "http://localhost:4002").trim().replace(/\/+$/, "");
const token = process.env.WHATSAPP_SERVICE_TOKEN?.trim() || "";
// History arrives in thousands; larger batches are bulk-saved on the cloud side.
const BATCH_SIZE = 500;
// Full history sync after linking can be tens of thousands of messages.
const MAX_QUEUE = 100_000;

export type IngestEvent = { kind: "message" | "status" | "media" | "chats" | "contacts" | "directChats" | "lidPhones" } & Record<string, unknown>;

const queue: IngestEvent[] = [];
let flushing = false;
let retryDelayMs = 1000;
let timer: NodeJS.Timeout | null = null;

// Chat lists and names are small and make the sidebar usable, so they jump
// ahead of a large message backlog (history sync).
const PRIORITY_KINDS = new Set(["chats", "contacts", "directChats", "lidPhones"]);

// Phone digits of the linked account; every event carries it so cloud can
// tell when a different number was linked and drop the previous one's chats.
let account: string | null = null;
export function setOutboxAccount(phone: string | null) {
  account = phone;
}

// After unlinking: events of the old account must not reach cloud tagged as
// the next one.
export function clearOutbox() {
  queue.length = 0;
}

export function enqueue(event: IngestEvent) {
  if (account && event.account === undefined) event.account = account;
  if (queue.length >= MAX_QUEUE) {
    // Cloud has been down for a long time; drop the oldest event.
    queue.shift();
    console.warn("[WhatsApp Groups] Outbox full, dropped the oldest event.");
  }
  if (PRIORITY_KINDS.has(event.kind)) {
    // After any priority events already queued, before everything else.
    let index = 0;
    while (index < queue.length && PRIORITY_KINDS.has(queue[index]!.kind)) index++;
    queue.splice(index, 0, event);
  } else {
    queue.push(event);
  }
  schedule(50);
}

function schedule(delayMs: number) {
  if (timer || flushing) return;
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, delayMs);
}

async function flush() {
  if (flushing || queue.length === 0) return;
  flushing = true;
  try {
    while (queue.length) {
      // Media events carry base64 files; send them one at a time.
      const batch =
        queue[0]!.kind === "media"
          ? [queue[0]!]
          : queue.slice(0, BATCH_SIZE).filter((_, i, all) => all.slice(0, i + 1).every((e) => e.kind !== "media"));
      const response = await fetch(`${cloudUrl}/groups/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-whatsapp-service-token": token },
        body: JSON.stringify({ events: batch }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`cloud returned ${response.status} ${text.slice(0, 200)}`);
      }
      // Priority events may have been inserted at the front while this batch
      // was in flight, so remove exactly the items that were sent.
      for (const sent of batch) {
        const index = queue.indexOf(sent);
        if (index !== -1) queue.splice(index, 1);
      }
      retryDelayMs = 1000;
    }
  } catch (error) {
    console.warn(
      `[WhatsApp Groups] Could not deliver ${queue.length} event(s) to ${cloudUrl}, retrying in ${retryDelayMs / 1000}s:`,
      error instanceof Error ? error.message : String(error),
    );
    flushing = false;
    schedule(retryDelayMs);
    retryDelayMs = Math.min(retryDelayMs * 2, 60_000);
    return;
  }
  flushing = false;
  if (queue.length) schedule(50);
}

export function outboxSize() {
  return queue.length;
}
