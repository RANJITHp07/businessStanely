import fs from "fs";
import os from "os";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execp = promisify(exec);

import type { Chat, Client as WhatsAppClient, Message } from "whatsapp-web.js";
import pkg from "whatsapp-web.js";

import { publishWhatsAppEvent } from "./realtime.js";
import type {
  WhatsAppChatSummary,
  WhatsAppMessage,
  WhatsAppState,
} from "./types.js";

const { Client, LocalAuth, MessageMedia } = pkg;

const LOG = (msg: string, ...args: unknown[]) => {
  try {
    console.log(`[WhatsApp] ${msg}`, ...args);
  } catch {}
};

function resolveSessionDir() {
  const configured = process.env.WHATSAPP_SESSION_DIR?.trim();

  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }

  // /var/task and similar deployment roots are read-only on many serverless hosts.
  if (process.env.NODE_ENV === "production") {
    return "/home/ubuntu/whatsapp-session";
  }

  return path.resolve(process.cwd(), ".wwebjs_auth");
}

const SESSION_DIR = resolveSessionDir();
// Last-known chat list + avatar URLs are mirrored here so a process restart can
// serve a warm cache immediately instead of waiting ~30–60s for Puppeteer to
// re-read WhatsApp Web's store. Lives next to the session so it survives deploys.
const CACHE_FILE = path.join(SESSION_DIR, "wa-cache.json");

/**
 * Clean up stuck lockfiles from crashed sessions (useful for local dev)
 */
function cleanupStuckLockfiles() {
  try {
    const sessionPath = path.join(SESSION_DIR, "session-admin-whatsapp");
    const candidates = [
      "lockfile",
      "LOCK",
      "SingletonLock",
      "SingletonSocket",
      "DevToolsActivePort",
    ];

    for (const name of candidates) {
      const p = path.join(sessionPath, name);
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
          // DevToolsActivePort is always left behind on abrupt exit — not worth logging.
          if (name !== "DevToolsActivePort") {
            console.log(`[WhatsApp] Cleaned up stuck lockfile: ${name}`);
          }
        } catch (e) {
          // Ignore, file might still be in use
        }
      }
    }
  } catch (e) {
    // Ignore cleanup errors
  }
}

/**
 * Attempt to kill any browser processes that reference the session directory.
 * This uses platform-specific commands and will ignore failures.
 */
async function killBrowserProcessesReferencing(sessionPath: string) {
  try {
    const marker = path.basename(sessionPath) || "session-admin-whatsapp";
    if (process.platform === "win32") {
      // Use PowerShell to find processes whose command line references the marker
      const cmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine -match '${marker}' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`;
      await execp(cmd);
      LOG(
        "killBrowserProcessesReferencing: attempted PowerShell stop for marker",
        marker,
      );
      return;
    }

    // POSIX: try to kill by matching the marker in the command line
    // This command finds matching PIDs and kills them; ignore failures.
    const cmd = `ps aux | grep -F '${marker}' | grep -v grep | awk '{print $2}' | xargs -r kill -9`;
    await execp(cmd);
    LOG(
      "killBrowserProcessesReferencing: attempted POSIX kill for marker",
      marker,
    );
  } catch (e) {
    LOG(
      "killBrowserProcessesReferencing: error while killing processes",
      String(e),
    );
  }
}

function ensureSessionDirectoryWritable() {
  fs.mkdirSync(SESSION_DIR, { recursive: true });

  // Validate write access early to avoid opaque puppeteer auth failures.
  const probePath = path.join(
    SESSION_DIR,
    `.wwebjs-write-test-${process.pid}-${Date.now()}`,
  );

  try {
    fs.writeFileSync(probePath, "ok");
  } finally {
    try {
      if (fs.existsSync(probePath)) {
        fs.unlinkSync(probePath);
      }
    } catch {
      // Ignore cleanup errors.
    }
  }
}

const chromiumExecutablePath =
  process.env.WHATSAPP_CHROMIUM_EXECUTABLE_PATH?.trim() || undefined;
// Bound Chromium's on-disk HTTP/media cache so the session profile under
// WHATSAPP_SESSION_DIR can't grow unbounded over weeks of use. Default 64 MB
// each; override via env if needed. 0 disables Chromium caching entirely.
const chromiumDiskCacheBytes = Number(
  process.env.WHATSAPP_DISK_CACHE_BYTES ?? 64 * 1024 * 1024,
);
const chromiumMediaCacheBytes = Number(
  process.env.WHATSAPP_MEDIA_CACHE_BYTES ?? 64 * 1024 * 1024,
);
const protocolTimeoutMs = Number(
  process.env.WHATSAPP_PROTOCOL_TIMEOUT_MS ?? 180000,
);
const chatFetchTimeoutMs = Number(
  process.env.WHATSAPP_CHAT_FETCH_TIMEOUT_MS ?? 180000,
);
const chatCacheTtlMs = Number(process.env.WHATSAPP_CHAT_CACHE_TTL_MS ?? 60000);
// Max time the /chats request will block on a cold cache before returning what
// it has (usually empty) and letting the refresh finish in the background. Kept
// well under the frontend proxy's 25s abort so a slow Puppeteer read returns a
// fast 200 (which the frontend retries) instead of timing out as a 503.
const coldChatWaitMs = Number(process.env.WHATSAPP_COLD_CHAT_WAIT_MS ?? 8000);
// Cache resolved profile-picture URLs so repeated /chat-avatar requests (one per
// chat row, per browser) don't each trigger an expensive Puppeteer evaluation.
// Found avatars are cached for hours; "no avatar" results for only a few minutes
// so a contact that later adds a photo still shows up reasonably soon.
const avatarCacheOkTtlMs = Number(
  process.env.WHATSAPP_AVATAR_CACHE_TTL_MS ?? 6 * 60 * 60 * 1000,
);
const avatarCacheNullTtlMs = Number(
  process.env.WHATSAPP_AVATAR_NULL_CACHE_TTL_MS ?? 5 * 60 * 1000,
);
// Lower default chat fetch limit for performance
const chatFetchLimit = Number(process.env.WHATSAPP_CHAT_FETCH_LIMIT ?? 50);
const operationConcurrencyLimit = Number(
  process.env.WHATSAPP_OPERATION_CONCURRENCY ?? 12,
);
const reconnectBaseDelayMs = Number(
  process.env.WHATSAPP_RECONNECT_BASE_DELAY_MS ?? 2000,
);
const reconnectMaxDelayMs = Number(
  process.env.WHATSAPP_RECONNECT_MAX_DELAY_MS ?? 60000,
);
const reconnectJitterMs = Number(
  process.env.WHATSAPP_RECONNECT_JITTER_MS ?? 1200,
);
const autoClearSessionOnAuthFailure =
  process.env.WHATSAPP_CLEAR_SESSION_ON_AUTH_FAILURE === "true";
const authFailureClearThreshold = Number(
  process.env.WHATSAPP_AUTH_FAILURE_CLEAR_THRESHOLD ?? 3,
);
const authFailureWindowMs = Number(
  process.env.WHATSAPP_AUTH_FAILURE_WINDOW_MS ?? 10 * 60 * 1000,
);
const WHATSAPP_EDIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Returns true for Puppeteer/Chrome crash errors that require a full client reset.
 */
function isFatalBrowserError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  // Transient: the Chromium page navigated / reloaded but the browser process
  // is still alive. wwebjs will re-inject itself — no client reset needed.
  if (
    normalized.includes("execution context was destroyed") ||
    normalized.includes("execution context with id")
  ) {
    return false;
  }

  // Transient: protocol-level timeout on a single CDP call, not a crash.
  if (
    normalized.includes("timed out") &&
    normalized.includes("runtime.callfunctionon")
  ) {
    return false;
  }

  return (
    normalized.includes("detached frame") ||
    normalized.includes("target closed") ||
    normalized.includes("session closed") ||
    normalized.includes("protocol error") ||
    normalized.includes("browser has been closed")
  );
}

/**
 * Returns true when the Puppeteer execution context was destroyed because the
 * WhatsApp Web page navigated (common during authentication / reconnection).
 * Both fast-path evaluate() and getChats() will fail with this error, so
 * refreshChats should short-circuit instead of retrying.
 */
function isContextDestroyedError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  const norm = msg.toLowerCase();
  return (
    norm.includes("execution context was destroyed") ||
    norm.includes("execution context with id")
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function toEditableMessageError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("detached frame") ||
    normalized.includes("target closed") ||
    normalized.includes("session closed") ||
    normalized.includes("protocol error") ||
    normalized.includes("browser has been closed")
  ) {
    return new Error(
      "WhatsApp web session is reconnecting. Please wait a moment and try again.",
    );
  }

  if (
    normalized.includes("15") &&
    (normalized.includes("minute") || normalized.includes("minutes"))
  ) {
    return new Error(
      "This message can no longer be edited. WhatsApp allows edits only within 15 minutes.",
    );
  }

  if (
    normalized.includes("not a function") ||
    normalized.includes("cannot edit") ||
    normalized.includes("evaluation failed") ||
    normalized.includes("not a text") ||
    normalized.includes("unsupported")
  ) {
    return new Error("This message type cannot be edited in WhatsApp.");
  }

  if (normalized.includes("not found")) {
    return new Error("Message was not found or is no longer available.");
  }

  return new Error(message || "Failed to edit message.");
}

function createDefaultState(): WhatsAppState {
  return {
    status: "idle",
    qr: null,
    clientInfo: {
      pushname: null,
      wid: null,
      platform: null,
    },
    error: null,
    lastUpdatedAt: new Date().toISOString(),
  };
}

function toSafeMessageBody(body: string | undefined | null) {
  if (!body) {
    return "";
  }

  return body.trim();
}

type MessageInternalData = {
  notifyName?: string;
  mimetype?: string;
  filename?: string;
};

function toSendMessageError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("message body is required") ||
    (normalized.includes("body") && normalized.includes("required"))
  ) {
    return new Error(
      "Attachment payload could not be parsed by WhatsApp. Please reselect the file and try again.",
    );
  }

  if (
    normalized.includes("detached frame") ||
    normalized.includes("target closed") ||
    normalized.includes("session closed") ||
    normalized.includes("protocol error") ||
    normalized.includes("browser has been closed")
  ) {
    return new Error(
      "WhatsApp web session is reconnecting. Please wait a moment and try again.",
    );
  }

  if (normalized.includes("413") || normalized.includes("too large")) {
    return new Error("Attachment is too large to send.");
  }

  if (normalized.includes("unsupported") || normalized.includes("mimetype")) {
    return new Error("Unsupported attachment format.");
  }

  return new Error(message || "Failed to send message.");
}

type MessageLike = {
  body?: string | null;
  hasMedia?: boolean;
  type?: string | null;
};

const MEDIA_TYPE_LABELS: Record<string, string> = {
  image: "📷 Photo",
  video: "🎥 Video",
  audio: "🎵 Audio",
  ptt: "🎤 Voice message",
  document: "📄 Document",
  sticker: "🎉 Sticker",
};

const SYSTEM_TYPE_LABELS: Record<string, string> = {
  call_log: "📞 Call",
  revoked: "🚫 Message deleted",
  e2e_notification: "🔐 Security notification",
  notification_template: "ℹ️ Notification",
  vcard: "👤 Contact",
  multi_vcard: "👥 Contacts",
  location: "📍 Location",
  live_location: "📡 Live location",
  gp2: "👥 Group update",
  protocol: "⚙️ System message",
};

function getMessageTypeLabel(type?: string | null, hasMedia = false) {
  if (!type) {
    return hasMedia ? "📎 Attachment" : "";
  }

  if (hasMedia) {
    return MEDIA_TYPE_LABELS[type] ?? "📎 Attachment";
  }

  if (type === "chat") {
    return "";
  }

  return SYSTEM_TYPE_LABELS[type] ?? " ";
}

function normalizeWhatsAppIdentifier(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  // JIDs can be like 9198xxxxxxx@c.us or 9198xxxxxxx:12@c.us.
  // For UI labels, show the contact number/identifier part only.
  if (trimmed.includes("@")) {
    const jidHead = trimmed.split("@")[0] || trimmed;
    const normalized = jidHead.split(":")[0] || jidHead;
    return normalized || trimmed;
  }

  return trimmed;
}

function mapMessage(message: Message): WhatsAppMessage {
  const internalData = message as Message & {
    _data?: MessageInternalData;
  };

  const rawBody = toSafeMessageBody(message.body);
  const fallbackLabel = getMessageTypeLabel(message.type, false);

  return {
    id: message.id._serialized,
    chatId: message.fromMe ? message.to : message.from,
    body: rawBody || fallbackLabel || "Unsupported message",
    timestamp: Number(message.timestamp ?? 0) * 1000,
    fromMe: message.fromMe,
    author: normalizeWhatsAppIdentifier(
      internalData._data?.notifyName || message.author || null,
    ),
    ack: typeof message.ack === "number" ? message.ack : undefined,
    hasMedia: Boolean(message.hasMedia),
    mediaType: message.type || null,
    mimetype: internalData._data?.mimetype || null,
    filename: internalData._data?.filename || null,
  };
}

function getLastMessagePreview(message: MessageLike | null | undefined) {
  if (!message) {
    return "Open chat to view messages";
  }

  const body = toSafeMessageBody(message.body);
  const label = getMessageTypeLabel(message.type, Boolean(message.hasMedia));

  if (message.hasMedia) {
    return body ? `${label}: ${body}` : label;
  }

  return body || label || "Open chat to view messages";
}

function mapChat(chat: Chat): WhatsAppChatSummary {
  const lastTimestamp =
    typeof chat.timestamp === "number" ? chat.timestamp * 1000 : null;
  const lastMessage = getLastMessagePreview(chat.lastMessage as MessageLike);
  const displayName = normalizeWhatsAppIdentifier(chat.name);
  const displayIdUser = normalizeWhatsAppIdentifier(chat.id.user);

  return {
    id: chat.id._serialized,
    name: displayName || displayIdUser || "Unknown contact",
    lastMessage,
    timestamp: lastTimestamp,
    unreadCount: chat.unreadCount ?? 0,
    avatarSeed: chat.id.user || chat.id._serialized,
    avatarUrl: null,
    isGroup: Boolean(chat.isGroup),
    isMuted: Boolean(chat.isMuted),
    isPinned: Boolean(chat.pinned),
  };
}

function getChatAvatarSeed(chatId: string) {
  return chatId.split("@")[0] || chatId;
}

function createOptimisticChatSummary(
  message: WhatsAppMessage,
): WhatsAppChatSummary {
  return {
    id: message.chatId,
    name: getChatAvatarSeed(message.chatId),
    lastMessage: message.body,
    timestamp: message.timestamp,
    unreadCount: message.fromMe ? 0 : 1,
    avatarSeed: getChatAvatarSeed(message.chatId),
    avatarUrl: null,
    isGroup: message.chatId.endsWith("@g.us"),
    isMuted: false,
    isPinned: false,
  };
}

class WhatsAppService {
  private client: WhatsAppClient | null = null;
  private initializingPromise: Promise<void> | null = null;
  private state: WhatsAppState = createDefaultState();
  private chatsCache: WhatsAppChatSummary[] = [];
  private chatsCacheAt = 0;
  private chatsRefreshPromise: Promise<WhatsAppChatSummary[]> | null = null;
  // chatId -> resolved avatar URL (or null when the contact has no picture).
  private avatarCache: Map<string, { url: string | null; at: number }> =
    new Map();
  // Deduplicates concurrent avatar lookups for the same chatId.
  private avatarFetchInProgress: Map<string, Promise<string | null>> =
    new Map();
  // Deduplicates concurrent listMessages calls for the same chatId+limit so that
  // multiple agents viewing the same chat don't each issue a separate Puppeteer
  // fetchMessages call.
  private messagesFetchInProgress: Map<string, Promise<WhatsAppMessage[]>> =
    new Map();
  private isManualLogoutInProgress = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private authFailureTimestamps: number[] = [];
  private activeOperationCount = 0;
  private operationQueue: Array<() => void> = [];
  private cachePersistTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Warm the in-memory caches from disk at startup so the very first /chats
    // after a restart is served instantly while the browser reconnects.
    this.loadPersistedCaches();
  }

  getState() {
    return this.state;
  }

  private loadPersistedCaches() {
    try {
      if (!fs.existsSync(CACHE_FILE)) {
        return;
      }
      const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) as {
        chats?: WhatsAppChatSummary[];
        chatsAt?: number;
        avatars?: Array<[string, { url: string | null; at: number }]>;
      };

      if (Array.isArray(parsed.chats) && parsed.chats.length > 0) {
        this.chatsCache = parsed.chats;
        this.chatsCacheAt =
          typeof parsed.chatsAt === "number" ? parsed.chatsAt : 0;
      }

      if (Array.isArray(parsed.avatars)) {
        const now = Date.now();
        for (const [id, entry] of parsed.avatars) {
          if (!entry) continue;
          const ttl = entry.url ? avatarCacheOkTtlMs : avatarCacheNullTtlMs;
          if (now - entry.at <= ttl) {
            this.avatarCache.set(id, entry);
          }
        }
      }

      LOG(
        `loadPersistedCaches: restored ${this.chatsCache.length} chats, ${this.avatarCache.size} avatars`,
      );
    } catch (e) {
      LOG("loadPersistedCaches: failed", String(e));
    }
  }

  // Debounced so a burst of updates results in a single write.
  private persistCachesDebounced() {
    if (this.cachePersistTimer) {
      return;
    }
    this.cachePersistTimer = setTimeout(() => {
      this.cachePersistTimer = null;
      this.persistCachesNow();
    }, 2000);
  }

  private persistCachesNow() {
    try {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
      fs.writeFileSync(
        CACHE_FILE,
        JSON.stringify({
          savedAt: Date.now(),
          chats: this.chatsCache,
          chatsAt: this.chatsCacheAt,
          avatars: Array.from(this.avatarCache.entries()),
        }),
      );
    } catch (e) {
      LOG("persistCachesNow: failed", String(e));
    }
  }

  private deletePersistedCaches() {
    try {
      if (this.cachePersistTimer) {
        clearTimeout(this.cachePersistTimer);
        this.cachePersistTimer = null;
      }
      if (fs.existsSync(CACHE_FILE)) {
        fs.unlinkSync(CACHE_FILE);
      }
    } catch {
      // Best-effort.
    }
  }

  private upsertChatSummary(chat: WhatsAppChatSummary) {
    const nextChats = this.chatsCache.filter((entry) => entry.id !== chat.id);
    nextChats.unshift(chat);
    this.chatsCache = nextChats.sort(
      (left, right) => (right.timestamp ?? 0) - (left.timestamp ?? 0),
    );
    this.chatsCacheAt = Date.now();
    this.persistCachesDebounced();
  }

  private setState(next: Partial<WhatsAppState>) {
    this.state = {
      ...this.state,
      ...next,
      clientInfo: {
        ...this.state.clientInfo,
        ...next.clientInfo,
      },
      lastUpdatedAt: new Date().toISOString(),
    };

    publishWhatsAppEvent("state", { state: this.state });
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearAuthFailureHistory() {
    this.authFailureTimestamps = [];
  }

  private registerAuthFailureAndShouldClearSession() {
    const now = Date.now();
    const windowMs =
      Number.isFinite(authFailureWindowMs) && authFailureWindowMs > 0
        ? authFailureWindowMs
        : 10 * 60 * 1000;

    this.authFailureTimestamps = this.authFailureTimestamps.filter(
      (ts) => now - ts <= windowMs,
    );
    this.authFailureTimestamps.push(now);

    const threshold =
      Number.isFinite(authFailureClearThreshold) &&
      authFailureClearThreshold > 0
        ? authFailureClearThreshold
        : 3;

    return autoClearSessionOnAuthFailure
      ? true
      : this.authFailureTimestamps.length >= threshold;
  }

  private scheduleReconnect(trigger: string) {
    if (this.isManualLogoutInProgress || this.reconnectTimer) {
      return;
    }

    const boundedAttempt = Math.min(this.reconnectAttempts, 8);
    const baseDelay = Math.min(
      reconnectBaseDelayMs * 2 ** boundedAttempt,
      reconnectMaxDelayMs,
    );
    const jitter = Math.floor(Math.random() * Math.max(reconnectJitterMs, 0));
    const delay = baseDelay + jitter;

    LOG(
      `scheduleReconnect: trigger=${trigger} attempt=${this.reconnectAttempts + 1} delayMs=${delay}`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts += 1;
      this.ensureInitialized().catch((error: unknown) => {
        LOG(
          "scheduleReconnect: ensureInitialized failed",
          error instanceof Error ? error.message : String(error),
        );
        this.scheduleReconnect("reconnect-failed");
      });
    }, delay);
  }

  private async acquireOperationSlot() {
    const limit =
      Number.isFinite(operationConcurrencyLimit) &&
      operationConcurrencyLimit > 0
        ? operationConcurrencyLimit
        : 6;

    if (this.activeOperationCount < limit) {
      this.activeOperationCount += 1;
      return;
    }

    await new Promise<void>((resolve) => {
      this.operationQueue.push(resolve);
    });
    this.activeOperationCount += 1;
  }

  private releaseOperationSlot() {
    this.activeOperationCount = Math.max(0, this.activeOperationCount - 1);
    const next = this.operationQueue.shift();
    if (next) {
      next();
    }
  }

  private async withOperationSlot<T>(work: () => Promise<T>) {
    await this.acquireOperationSlot();
    try {
      return await work();
    } finally {
      this.releaseOperationSlot();
    }
  }

  async ensureInitialized() {
    if (this.client) {
      LOG("ensureInitialized: already initialized");
      return;
    }

    if (this.initializingPromise) {
      return this.initializingPromise;
    }

    this.initializingPromise = this.initializeClient();
    return this.initializingPromise.finally(() => {
      this.initializingPromise = null;
    });
  }

  private async initializeClient() {
    this.setState({ status: "initializing", error: null, qr: null });
    LOG("initializeClient: starting");

    try {
      ensureSessionDirectoryWritable();

      // Clean up any stuck lockfiles before starting
      cleanupStuckLockfiles();

      // Ensure the session subdirectory exists and try to kill any lingering
      // browser processes that may be holding the profile open. This prevents
      // a loop where lockfiles are removed but the browser immediately
      // recreates them.
      try {
        const sessionPath = path.join(SESSION_DIR, "session-admin-whatsapp");
        fs.mkdirSync(sessionPath, { recursive: true });

        const lockCandidates = [
          path.join(sessionPath, "lockfile"),
          path.join(sessionPath, "LOCK"),
          path.join(sessionPath, "SingletonLock"),
          path.join(sessionPath, "SingletonSocket"),
          path.join(sessionPath, "DevToolsActivePort"),
        ];

        const anyLockExists = lockCandidates.some((p) => fs.existsSync(p));
        if (anyLockExists) {
          LOG(
            "initializeClient: lockfiles detected, attempting to kill browser processes referencing session",
          );
          // best-effort kill; ignore errors
          await killBrowserProcessesReferencing(sessionPath);
          // allow filesystem settle
          await new Promise((r) => setTimeout(r, 400));
          // attempt cleanup again
          cleanupStuckLockfiles();
        }
      } catch (e) {
        LOG("initializeClient: session pre-setup failed", String(e));
      }

      const client = new Client({
        authStrategy: new LocalAuth({
          clientId: "admin-whatsapp",
          dataPath: SESSION_DIR,
        }),
        // Extra time for WhatsApp Web to inject and authenticate.
        authTimeoutMs: 180000,
        puppeteer: {
          headless: process.env.WHATSAPP_HEADLESS !== "false",
          executablePath: chromiumExecutablePath,
          protocolTimeout: Number.isFinite(protocolTimeoutMs)
            ? protocolTimeoutMs
            : 180000,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--disable-gpu",
            "--disable-extensions",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",
            // Disable site-isolation to keep Chromium in a single renderer
            // process — saves ~100 MB RAM on memory-constrained instances.
            "--disable-features=site-per-process",
            // Cap the on-disk HTTP/media cache so the session profile cannot
            // grow without bound (the main disk-space risk for a long-lived
            // shared session). Values are bytes; see chromiumDiskCacheBytes.
            ...(Number.isFinite(chromiumDiskCacheBytes)
              ? [`--disk-cache-size=${chromiumDiskCacheBytes}`]
              : []),
            ...(Number.isFinite(chromiumMediaCacheBytes)
              ? [`--media-cache-size=${chromiumMediaCacheBytes}`]
              : []),
            "--window-size=1280,800",
          ],
        },
        // Pin a known-good WA Web version fetched from the wppconnect archive.
        // Using type:'local' (live WhatsApp CDN) breaks wwebjs when WA ships a new
        // version that hasn't been patched yet, causing auth / ready events to never
        // fire and effectively logging everyone out.
        webVersion: process.env.WHATSAPP_WEB_VERSION || "2.2412.54",
        webVersionCache: {
          type: "remote",
          remotePath:
            "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html",
        },
      });

      client.on("qr", (qr: string) => {
        LOG("event: qr received");
        this.setState({ status: "qr", qr, error: null });
      });

      client.on("authenticated", () => {
        LOG("event: authenticated");
        this.clearAuthFailureHistory();
        this.setState({ status: "authenticated", error: null });
      });

      client.on("ready", () => {
        LOG("event: ready");
        this.clearAuthFailureHistory();
        this.reconnectAttempts = 0;
        this.clearReconnectTimer();
        this.setState({
          status: "ready",
          qr: null,
          error: null,
          clientInfo: {
            pushname: client.info?.pushname || null,
            wid: client.info?.wid?._serialized || null,
            platform: client.info?.platform || null,
          },
        });

        // Delay the initial chat fetch so WhatsApp Web has time to fully
        // sync its internal chat list after the session becomes ready.
        // We fire-and-forget so it never blocks the ready event itself.
        // Use this.client (live reference) not the captured local variable —
        // if the session reconnects before the 15 s fires, the captured
        // client would be a destroyed object whose internals are undefined.
        // Pre-warm the chat cache after WhatsApp Web has had time to load
        // its full chat list. Retries up to 3 times (first at 3 s, then 6 s,
        // 12 s) if the Store hasn't populated enough real chats yet. Starting
        // at 3 s (instead of 15 s) gets chats on screen much sooner; the disk
        // cache already covers the gap before the Store is ready.
        const warmCache = async (attempt: number) => {
          const liveClient = this.client;
          if (!liveClient || this.state.status !== "ready") {
            LOG("Chat cache pre-warm skipped: client no longer ready");
            return;
          }
          try {
            // Clear any partial cache before retrying so refreshChats
            // doesn't short-circuit with the stale 1-chat result.
            if (this.chatsCache.length <= 1) {
              this.chatsCache = [];
              this.chatsCacheAt = 0;
              this.chatsRefreshPromise = null;
            }
            await this.refreshChats(liveClient);
            if (this.chatsCache.length <= 1 && attempt < 3) {
              LOG(
                `Chat cache pre-warm attempt ${attempt}: only ${this.chatsCache.length} chat(s) loaded, retrying shortly`,
              );
              setTimeout(
                () => warmCache(attempt + 1),
                attempt === 1 ? 6000 : 12000,
              );
            } else {
              LOG(
                `Chat cache pre-warmed successfully (${this.chatsCache.length} chats, attempt ${attempt})`,
              );
              publishWhatsAppEvent("chats-updated");
            }
          } catch (e) {
            LOG(`Chat cache pre-warm attempt ${attempt} failed:`, String(e));
            if (attempt < 3) {
              setTimeout(
                () => warmCache(attempt + 1),
                attempt === 1 ? 6000 : 12000,
              );
            }
          }
        };
        setTimeout(() => warmCache(1), 3000); // first attempt after 3 s
      });

      client.on("auth_failure", (message: string) => {
        LOG("event: auth_failure", message);
        const shouldClearSession =
          this.registerAuthFailureAndShouldClearSession();

        const brokenClient = this.client;
        this.client = null;
        this.initializingPromise = null;

        if (brokenClient) {
          brokenClient.destroy().catch(() => {
            // Ignore destroy errors on auth failure.
          });
        }

        const sessionPath = path.join(SESSION_DIR, "session-admin-whatsapp");

        if (shouldClearSession) {
          // Repeated auth failures usually mean the linked device/session is
          // truly invalid, so clear it and force a fresh QR.
          try {
            if (fs.existsSync(sessionPath)) {
              fs.rmSync(sessionPath, { recursive: true, force: true });
              LOG("auth_failure: cleared stale session directory");
            }
          } catch (e) {
            LOG("auth_failure: failed to clear session directory", String(e));
          }

          this.setState({
            status: "error",
            error:
              message ||
              "WhatsApp session expired. Please rescan the QR code to reconnect.",
          });
        } else {
          // Single auth_failure events can be transient. Keep session files and
          // attempt reconnect before forcing a logout.
          this.setState({
            status: "disconnected",
            qr: null,
            error:
              message ||
              "Authentication hiccup detected. Reconnecting automatically...",
            clientInfo: createDefaultState().clientInfo,
          });
        }

        this.scheduleReconnect("auth_failure");
      });

      client.on("disconnected", (reason: string) => {
        LOG("event: disconnected", reason);
        this.clearReconnectTimer();
        this.client = null;
        this.setState({
          status: "disconnected",
          qr: null,
          error: reason || "WhatsApp client disconnected.",
          clientInfo: createDefaultState().clientInfo,
        });
        publishWhatsAppEvent("chats-updated");

        if (!this.isManualLogoutInProgress) {
          this.scheduleReconnect(`disconnected:${reason || "unknown"}`);
        }
      });

      client.on("error", (error: Error) => {
        LOG("event: client error", error.message);
        if (isFatalBrowserError(error)) {
          this.handleFatalBrowserError(error);
          return;
        }
        // "Execution context was destroyed" is thrown when the WhatsApp Web
        // page navigates (QR page → auth page → chat page). wwebjs handles
        // page recovery internally — do not set error status or reset client.
        if (isContextDestroyedError(error)) {
          LOG(
            "event: client error (transient — page navigating, ignoring):",
            error.message,
          );
          return;
        }
        this.setState({
          status: "error",
          error: error.message || "WhatsApp client encountered an error.",
        });
      });

      client.on("message", async (message: Message) => {
        LOG("event: message received", message.id?._serialized ?? "<no-id>");
        try {
          const mapped = mapMessage(message);
          let eventChat =
            this.chatsCache.find((c) => c.id === mapped.chatId) ?? null;

          if (!eventChat) {
            try {
              const chat = await this.withOperationSlot(() =>
                message.getChat(),
              );
              eventChat = mapChat(chat);
            } catch (chatError) {
              LOG(
                "message event: failed to resolve chat metadata, using optimistic summary",
                chatError instanceof Error
                  ? chatError.message
                  : String(chatError),
              );
              eventChat = createOptimisticChatSummary(mapped);
            }

            this.upsertChatSummary({
              ...eventChat,
              lastMessage: mapped.body,
              timestamp: mapped.timestamp,
              unreadCount: mapped.fromMe
                ? 0
                : Math.max(eventChat.unreadCount, 1),
            });
            eventChat =
              this.chatsCache.find((c) => c.id === mapped.chatId) ?? eventChat;
          } else {
            this.upsertChatSummary({
              ...eventChat,
              lastMessage: mapped.body,
              timestamp: mapped.timestamp,
              unreadCount: mapped.fromMe
                ? eventChat.unreadCount
                : eventChat.unreadCount + 1,
            });
            eventChat =
              this.chatsCache.find((c) => c.id === mapped.chatId) ?? eventChat;
          }

          publishWhatsAppEvent("message", {
            chatId: mapped.chatId,
            chat: eventChat,
            message: mapped,
          });
          publishWhatsAppEvent("chats-updated", { chatId: mapped.chatId });
        } catch (error) {
          this.handleFatalBrowserError(error);
        }
      });

      client.on("message_create", async (message: Message) => {
        LOG("event: message_create", message.id?._serialized ?? "<no-id>");
        if (!message.fromMe) {
          return;
        }

        try {
          const mapped = mapMessage(message);
          const existingChat = this.chatsCache.find(
            (c) => c.id === mapped.chatId,
          );
          const updatedChat = {
            ...(existingChat ?? createOptimisticChatSummary(mapped)),
            lastMessage: mapped.body,
            timestamp: mapped.timestamp,
          };

          this.upsertChatSummary(updatedChat);

          publishWhatsAppEvent("message", {
            chatId: mapped.chatId,
            chat: updatedChat,
            message: mapped,
          });
          publishWhatsAppEvent("chats-updated", { chatId: mapped.chatId });
        } catch (error) {
          this.handleFatalBrowserError(error);
        }
      });

      this.client = client;
      try {
        await client.initialize();
        LOG("initializeClient: initialize() completed");
      } catch (initError) {
        const msg =
          initError instanceof Error ? initError.message : String(initError);
        const normalized = msg.toLowerCase();

        if (
          normalized.includes("already running") ||
          normalized.includes("user data directory is already in use") ||
          normalized.includes("the browser is already running")
        ) {
          console.warn(
            "[WhatsApp] Browser profile in use. Cleaning locks and retrying initialization once.",
          );
          cleanupStuckLockfiles();
          await new Promise((r) => setTimeout(r, 500));
          await client.initialize();
        } else {
          throw initError;
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown initialization error.";
      LOG("Initialization failed:", errorMessage);

      // "Execution context was destroyed" has two very different meanings
      // depending on when it fires:
      //
      // CASE A — status is past "initializing" (qr/authenticated/ready):
      //   The QR was already generated and the page navigated to the auth
      //   screen. wwebjs has listeners set up and will fire qr/ready events.
      //   → Ignore: treat as transient, let events drive state.
      //
      // CASE B — status is still "initializing" (QR never fired):
      //   Chromium started but the page navigated before WhatsApp Web could
      //   render (common on EC2 when the remote webVersionCache fetch is slow
      //   or the page reloads). The client object is broken.
      //   → Null the client so the next ensureInitialized() call (from the
      //     frontend's 3-second poll while status === "initializing") creates
      //     a fresh browser and retries.
      if (isContextDestroyedError(error)) {
        if (this.state.status !== "initializing") {
          LOG(
            "initializeClient: context destroyed during initialize() — transient, ignoring (status:",
            this.state.status,
            ")",
          );
          return;
        }

        LOG(
          "initializeClient: context destroyed before QR generated — resetting client for retry",
        );
        // Destroy the broken browser and AWAIT completion before returning.
        // Without awaiting, the next retry (triggered 3 s later by the
        // frontend poll) launches a new Chromium while the old one is still
        // shutting down — the old process still holds session directory
        // lockfiles, so the new Chromium immediately fails with the same
        // "context destroyed" error, creating an infinite loop.
        if (this.client) {
          const brokenClient = this.client;
          this.client = null;
          try {
            await brokenClient.destroy();
          } catch {}
        } else {
          this.client = null;
        }
        // Extra settle time for the OS to release file handles / lockfiles
        // from the destroyed browser process before the next retry.
        await new Promise((r) => setTimeout(r, 800));
        // Keep status as "initializing" — the frontend polls every 3 s while
        // status is "initializing" and will trigger ensureInitialized() again.
        return;
      }

      this.setState({
        status: "error",
        error: errorMessage,
      });
      this.client = null;
      this.scheduleReconnect("initialize-failed");
    }
  }

  private async requireReadyClient() {
    await this.ensureInitialized();

    if (!this.client || this.state.status !== "ready") {
      const currentStatus = this.state.status;
      const error = this.state.error;
      throw new Error(
        `WhatsApp is not ready yet. Status: ${currentStatus}${error ? `. Error: ${error}` : ""}`,
      );
    }

    return this.client;
  }

  /**
   * Reset the client (for recovery after crashes)
   */
  resetClient() {
    if (this.client) {
      try {
        LOG("resetClient: destroying client");
        this.client.destroy().catch(() => {
          // Ignore errors during destroy
        });
      } catch {
        // Ignore
      }
    }
    this.client = null;
    this.initializingPromise = null;
    this.chatsCache = [];
    this.chatsCacheAt = 0;
    this.chatsRefreshPromise = null;
    this.messagesFetchInProgress.clear();
    this.avatarCache.clear();
    this.avatarFetchInProgress.clear();
    this.clearReconnectTimer();
    this.reconnectAttempts = 0;
    // Recovery (not logout): re-warm from the last persisted snapshot so the UI
    // has chats/avatars to show while the browser reconnects.
    this.loadPersistedCaches();
    this.setState(createDefaultState());
  }

  private async handleFatalBrowserError(error: unknown) {
    if (!isFatalBrowserError(error)) {
      return;
    }

    LOG(
      "Fatal browser error detected:",
      error instanceof Error ? error.message : String(error),
    );

    const brokenClient = this.client;

    this.client = null;
    this.initializingPromise = null;

    this.setState({
      status: "error",
      error: "WhatsApp browser session crashed. Reconnecting...",
      qr: null,
      clientInfo: createDefaultState().clientInfo,
    });

    publishWhatsAppEvent("chats-updated");

    if (brokenClient) {
      try {
        await brokenClient.destroy();
        LOG("Destroyed broken WhatsApp client");
      } catch (e) {
        LOG("Failed to destroy broken client", String(e));
      }
    }

    try {
      cleanupStuckLockfiles();
    } catch {}

    await new Promise((r) => setTimeout(r, 3000));
    this.scheduleReconnect("fatal-browser-error");
  }

  private async getChatAvatarUrl(chat: Chat) {
    const candidate = chat as Chat & {
      getProfilePicUrl?: () => Promise<string | null | undefined>;
    };

    if (typeof candidate.getProfilePicUrl !== "function") {
      return null;
    }

    try {
      const url = await candidate.getProfilePicUrl();
      if (!url || typeof url !== "string") {
        return null;
      }

      const normalized = url.trim();
      return normalized || null;
    } catch {
      return null;
    }
  }

  async getChatAvatarUrlById(chatId: string): Promise<string | null> {
    // Serve from cache when fresh — avoids a Puppeteer round-trip per request.
    const cached = this.avatarCache.get(chatId);
    if (cached) {
      const ttl = cached.url ? avatarCacheOkTtlMs : avatarCacheNullTtlMs;
      if (Date.now() - cached.at <= ttl) {
        return cached.url;
      }
    }

    // Collapse concurrent lookups for the same chat into one in-flight request.
    const inFlight = this.avatarFetchInProgress.get(chatId);
    if (inFlight) {
      return inFlight;
    }

    const promise = this.resolveChatAvatarUrlById(chatId)
      .then((url) => {
        this.avatarCache.set(chatId, { url, at: Date.now() });
        this.persistCachesDebounced();
        return url;
      })
      .finally(() => {
        this.avatarFetchInProgress.delete(chatId);
      });

    this.avatarFetchInProgress.set(chatId, promise);
    return promise;
  }

  // Resolve many avatars in one call (used by the frontend's batch prefetch so
  // a chat list issues a single request instead of one per row). Cached ids are
  // instant; misses are resolved with limited concurrency so we don't flood the
  // single Puppeteer page.
  async getChatAvatarUrlsByIds(
    chatIds: string[],
  ): Promise<Record<string, string | null>> {
    const result: Record<string, string | null> = {};
    const concurrency = 4;
    let index = 0;

    const worker = async () => {
      while (index < chatIds.length) {
        const id = chatIds[index++];
        if (!id) continue;
        try {
          result[id] = await this.getChatAvatarUrlById(id);
        } catch {
          result[id] = null;
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, chatIds.length) }, () =>
        worker(),
      ),
    );

    return result;
  }

  private async resolveChatAvatarUrlById(
    chatId: string,
  ): Promise<string | null> {
    LOG("API: getChatAvatarUrlById", { chatId });
    const client = await this.requireReadyClient();

    const pupPage = (client as unknown as { pupPage?: unknown }).pupPage as
      | {
          evaluate(
            fn: (...a: unknown[]) => unknown,
            ...args: unknown[]
          ): Promise<unknown>;
        }
      | undefined;

    // Primary: direct Puppeteer Store evaluation.
    // wwebjs wraps profilePicFind results in a Backbone model whose attributes
    // live under .get() — accessing .eurl directly returns undefined on some
    // versions. This evaluate handles both plain-object and Backbone-model
    // shapes and works for own WID (no chat needed).
    if (pupPage?.evaluate) {
      try {
        const storeUrl = await withTimeout(
          pupPage.evaluate(async (id: unknown) => {
            try {
              /* eslint-disable @typescript-eslint/no-explicit-any */
              const store = (window as any).Store;
              if (!store?.WidFactory || !store?.ProfilePic) return null;
              const wid = store.WidFactory.createWid(id as string);
              const result = await store.ProfilePic.profilePicFind(wid);
              if (!result) return null;
              // Plain object (newer wwebjs) or Backbone model (.get accessor)
              return (
                result.eurl ||
                (typeof result.get === "function"
                  ? result.get("eurl")
                  : null) ||
                null
              );
            } catch {
              return null;
            }
          }, chatId) as Promise<string | null>,
          10000,
          `profilePicFind(${chatId})`,
        );
        if (storeUrl && typeof storeUrl === "string") {
          const normalized = storeUrl.trim();
          if (normalized) {
            LOG("getChatAvatarUrlById: store eval succeeded", chatId);
            return normalized;
          }
        }
      } catch (e) {
        LOG(
          "getChatAvatarUrlById: store eval failed",
          e instanceof Error ? e.message : String(e),
        );
      }
    }

    // Fallback: wwebjs wrapper (may still succeed on some versions / contacts).
    try {
      const wClient = client as WhatsAppClient & {
        getProfilePicUrl?: (contactId: string) => Promise<string | undefined>;
      };
      if (typeof wClient.getProfilePicUrl === "function") {
        const directUrl = await withTimeout(
          wClient.getProfilePicUrl(chatId),
          8000,
          `wClient.getProfilePicUrl(${chatId})`,
        );
        if (directUrl && typeof directUrl === "string") {
          const normalized = directUrl.trim();
          if (normalized) {
            LOG("getChatAvatarUrlById: wClient fallback succeeded", chatId);
            return normalized;
          }
        }
      }
    } catch (e) {
      LOG(
        "getChatAvatarUrlById: wClient fallback failed",
        e instanceof Error ? e.message : String(e),
      );
    }

    LOG("getChatAvatarUrlById: all methods returned null for", chatId);
    return null;
  }

  private async sendMediaWithFallbacks(
    client: WhatsAppClient,
    chatId: string,
    media: { data: string; mimetype: string; filename: string },
    content: string,
  ) {
    const mediaPayload = new MessageMedia(
      media.mimetype || "application/octet-stream",
      media.data,
      media.filename || "attachment",
    );

    const baseOptions: Record<string, unknown> = {
      // Some environments reject media sends without a body; a single space keeps
      // attachment-only sends compatible while remaining visually unobtrusive.
      caption: content || " ",
    };

    if ((media.mimetype || "").startsWith("application/")) {
      baseOptions.sendMediaAsDocument = true;
    }

    try {
      return Object.keys(baseOptions).length > 0
        ? await client.sendMessage(chatId, mediaPayload, baseOptions)
        : await client.sendMessage(chatId, mediaPayload);
    } catch (firstError) {
      const firstMessage =
        firstError instanceof Error ? firstError.message : String(firstError);

      if (!firstMessage.toLowerCase().includes("message body is required")) {
        throw firstError;
      }

      // Fallback 1: force a non-empty caption for environments that incorrectly
      // require a body with media payloads.
      try {
        return await client.sendMessage(chatId, mediaPayload, {
          ...baseOptions,
          caption: content || " ",
        });
      } catch {
        // Continue to the next fallback.
      }

      // Fallback 2: send media loaded from a temporary file path.
      const extension = (() => {
        const byName = path.extname(media.filename || "").trim();
        if (byName) {
          return byName;
        }
        const byType = media.mimetype?.split("/")[1]?.split(";")[0]?.trim();
        return byType ? `.${byType}` : "";
      })();

      const tempFilePath = path.join(
        os.tmpdir(),
        `wa-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`,
      );

      try {
        fs.writeFileSync(tempFilePath, Buffer.from(media.data, "base64"));
        const filePayload = MessageMedia.fromFilePath(tempFilePath);

        return Object.keys(baseOptions).length > 0
          ? await client.sendMessage(chatId, filePayload, baseOptions)
          : await client.sendMessage(chatId, filePayload);
      } finally {
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        } catch {
          // Ignore cleanup errors.
        }
      }
    }
  }

  // Add pagination to chat list
  // Accept page and pageSize for pagination
  private filterAndSortChats(
    chats: WhatsAppChatSummary[],
    normalizedSearch: string,
    page: number = 1,
    pageSize: number = chatFetchLimit,
  ) {
    const filtered = chats
      .filter((chat) => {
        if (!normalizedSearch) {
          return true;
        }
        const searchableText = [chat.name, chat.lastMessage, chat.id]
          .join(" ")
          .toLowerCase();
        return searchableText.includes(normalizedSearch);
      })
      .sort((left, right) => (right.timestamp ?? 0) - (left.timestamp ?? 0));
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }

  // Expose a paginated chat list API
  public async getPaginatedChats(
    search = "",
    page = 1,
    pageSize = chatFetchLimit,
  ) {
    return this.withOperationSlot(async () => {
      await this.ensureInitialized();
      const client = await this.requireReadyClient();

      const hasCachedData = this.chatsCache.length > 0;
      // Treat a cache that only has system/broadcast entries (≤1 real chat)
      // as effectively empty — it means WhatsApp Web hadn't finished loading
      // when the cache was last populated.
      const hasUsableCachedData = this.chatsCache.length > 1;
      const hasFreshCache =
        hasUsableCachedData && Date.now() - this.chatsCacheAt <= chatCacheTtlMs;

      if (!hasUsableCachedData) {
        // Cold start or partial-load cache. Kick off a refresh, but only wait a
        // bounded time for it — a slow Puppeteer read must not block past the
        // frontend's 25s proxy timeout (which surfaces as a 503). If it's slow,
        // return what we have (likely empty) and let the refresh complete in the
        // background; the frontend retries on an empty list and picks up the
        // chats on a subsequent fast request.
        const refresh = this.refreshChats(client).catch((e) => {
          LOG("getPaginatedChats: cold refresh failed:", String(e));
          return this.chatsCache;
        });
        await Promise.race([
          refresh,
          new Promise((resolve) => setTimeout(resolve, coldChatWaitMs)),
        ]);
      } else if (!hasFreshCache) {
        // Stale cache — return immediately and refresh in the background.
        // Re-read this.client at the time the background task runs so we
        // never pass a stale/destroyed client reference into refreshChats().
        const capturedClient = this.client;
        if (capturedClient && this.state.status === "ready") {
          this.refreshChats(capturedClient).catch((e) =>
            LOG("background chat refresh failed:", String(e)),
          );
        }
      }
      // hasFreshCache — serve from cache with no background work needed.

      const normalizedSearch = search.trim().toLowerCase();
      return this.filterAndSortChats(
        this.chatsCache,
        normalizedSearch,
        page,
        pageSize,
      );
    });
  }

  private async refreshChats(client: WhatsAppClient) {
    if (!client) {
      LOG("refreshChats: client is undefined or not ready");
      throw new Error("WhatsApp is reconnecting, please wait a moment.");
    }
    if (this.chatsRefreshPromise) {
      return this.chatsRefreshPromise;
    }

    this.chatsRefreshPromise = (async () => {
      const limit =
        Number.isFinite(chatFetchLimit) && chatFetchLimit > 0
          ? chatFetchLimit
          : 200;
      const timeoutMs = Number.isFinite(chatFetchTimeoutMs)
        ? chatFetchTimeoutMs
        : 180000;

      // ── Fast path ────────────────────────────────────────────────────────
      const pupPage = (client as unknown as { pupPage?: unknown }).pupPage as
        | {
            evaluate(
              fn: (...a: unknown[]) => unknown,
              ...args: unknown[]
            ): Promise<unknown>;
          }
        | undefined;

      if (pupPage?.evaluate) {
        try {
          type RawChat = {
            id: string;
            name: string;
            idUser: string;
            timestamp: number | null;
            unreadCount: number;
            isGroup: boolean;
            isMuted: boolean;
            isPinned: boolean;
            lastMessageBody: string | null;
            lastMessageHasMedia: boolean;
            lastMessageType: string | null;
          };

          const raw = (await withTimeout(
            pupPage.evaluate((lim: unknown) => {
              try {
                /* eslint-disable @typescript-eslint/no-explicit-any */
                const store = (window as any).Store;
                if (!store?.Chat) return null;
                if (!Array.isArray(store.Chat.models)) return null;
                const models: any[] = store.Chat.models;

                return models
                  .filter(
                    (c: any) =>
                      c?.id?.server !== "status" &&
                      c?.id?.server !== "broadcast" &&
                      c?.id?._serialized,
                  )
                  .slice(0, lim as number)
                  .map((c: any) => {
                    try {
                      const lm = c.lastMessage ?? c.msgs?.last ?? null;
                      return {
                        id: c.id._serialized,
                        name: c.formattedTitle || c.name || c.id?.user || "",
                        idUser: c.id?.user || "",
                        timestamp: typeof c.t === "number" ? c.t : null,
                        unreadCount:
                          typeof c.unreadCount === "number" ? c.unreadCount : 0,
                        isGroup: Boolean(c.isGroup),
                        isMuted: Boolean(c.mute?.expiration),
                        isPinned: Boolean(c.pin),
                        lastMessageBody:
                          typeof lm?.body === "string" ? lm.body : null,
                        lastMessageHasMedia: Boolean(lm?.hasMedia),
                        lastMessageType:
                          typeof lm?.type === "string" ? lm.type : null,
                      };
                    } catch {
                      return null;
                    }
                  })
                  .filter((c: any) => c !== null);
                /* eslint-enable @typescript-eslint/no-explicit-any */
              } catch {
                return null;
              }
            }, limit) as Promise<RawChat[] | null>,
            timeoutMs,
            "WhatsApp chat store read",
          )) as RawChat[] | null;

          if (Array.isArray(raw) && raw.length > 0) {
            LOG(`refreshChats: fast path returned ${raw.length} chats`);
            const mappedChats: WhatsAppChatSummary[] = raw.map((r) => ({
              id: r.id,
              name: r.name || r.idUser || "Unknown contact",
              lastMessage: getLastMessagePreview(
                r.lastMessageBody !== null || r.lastMessageHasMedia
                  ? {
                      body: r.lastMessageBody,
                      hasMedia: r.lastMessageHasMedia,
                      type: r.lastMessageType,
                    }
                  : null,
              ),
              timestamp: r.timestamp !== null ? r.timestamp * 1000 : null,
              unreadCount: r.unreadCount,
              avatarSeed: r.idUser || r.id,
              avatarUrl: null,
              isGroup: r.isGroup,
              isMuted: r.isMuted,
              isPinned: r.isPinned,
            }));

            this.chatsCache = mappedChats;
            this.chatsCacheAt = Date.now();
            this.persistCachesDebounced();
            return mappedChats;
          }

          LOG(
            "refreshChats: fast path returned empty/null, falling back to getChats()",
          );
        } catch (fastErr) {
          if (isContextDestroyedError(fastErr)) {
            LOG(
              "refreshChats: execution context destroyed during fast path — page is navigating",
            );
            if (this.chatsCache.length > 0) return this.chatsCache;
            throw new Error("WhatsApp is reconnecting, please wait a moment.");
          }
          LOG(
            "refreshChats: fast path error, falling back to getChats():",
            fastErr instanceof Error ? fastErr.message : String(fastErr),
          );
        }
      }

      // ── Fallback: standard getChats() ────────────────────────────────────
      LOG("refreshChats: using getChats() fallback");
      if (!client) {
        LOG("refreshChats: client is undefined in fallback");
        throw new Error("WhatsApp is reconnecting, please wait a moment.");
      }
      // Guard: if client was destroyed between the fast-path and fallback
      // (e.g. reconnect happened), bail out rather than calling getChats()
      // on a dead object whose internals are undefined.
      if (!this.client || this.state.status !== "ready") {
        LOG("refreshChats: client disconnected before fallback could run");
        if (this.chatsCache.length > 0) return this.chatsCache;
        throw new Error("WhatsApp is reconnecting, please wait a moment.");
      }
      const attemptFetch = () =>
        withTimeout(client.getChats(), timeoutMs, "WhatsApp chat fetch");

      let chats;
      try {
        chats = await attemptFetch();
      } catch (firstError) {
        if (isContextDestroyedError(firstError)) {
          LOG(
            "refreshChats: execution context destroyed in fallback — page is navigating",
          );
          if (this.chatsCache.length > 0) return this.chatsCache;
          throw new Error("WhatsApp is reconnecting, please wait a moment.");
        }
        LOG(
          "refreshChats: first attempt failed, retrying after 5 s delay:",
          firstError instanceof Error ? firstError.message : String(firstError),
        );
        await new Promise((r) => setTimeout(r, 5000));
        chats = await attemptFetch();
      }

      const filteredChats = chats
        .filter(
          (chat) =>
            chat.id.server !== "status" && chat.id.server !== "broadcast",
        )
        .slice(0, limit);
      const mappedChats = filteredChats.map((chat) => mapChat(chat));

      this.chatsCache = mappedChats;
      this.chatsCacheAt = Date.now();
      this.persistCachesDebounced();
      return mappedChats;
    })();

    try {
      return await this.chatsRefreshPromise;
    } finally {
      this.chatsRefreshPromise = null;
    }
  }

  async listChats(search = "") {
    LOG("API: listChats", { search });
    const client = await this.requireReadyClient();
    const normalizedSearch = search.trim().toLowerCase();
    const hasFreshCache =
      this.chatsCache.length > 0 &&
      Date.now() - this.chatsCacheAt <= chatCacheTtlMs;

    if (hasFreshCache) {
      return this.filterAndSortChats(this.chatsCache, normalizedSearch);
    }

    try {
      const mappedChats = await this.refreshChats(client);
      return this.filterAndSortChats(mappedChats, normalizedSearch);
    } catch (error) {
      this.handleFatalBrowserError(error);

      if (this.chatsCache.length > 0) {
        console.warn(
          "[WhatsApp] listChats failed, returning cached chats:",
          error instanceof Error ? error.message : String(error),
        );
        return this.filterAndSortChats(this.chatsCache, normalizedSearch);
      }

      const errorMessage =
        error instanceof Error ? error.message : "Failed to load chats.";
      throw new Error(
        `Failed to load chats from WhatsApp Web. ${errorMessage}`,
      );
    }
  }

  async listMessages(chatId: string, limit = 80) {
    LOG("API: listMessages", { chatId, limit });
    const client = await this.requireReadyClient();

    // Deduplicate concurrent calls for the same chat+limit. When 15-20 agents
    // are all connected and an event fires, they can all call fetchMessages at
    // the same time. A single Puppeteer CDP call is reused for all of them.
    const key = `${chatId}:${limit}`;
    const existing = this.messagesFetchInProgress.get(key);
    if (existing) {
      LOG(`listMessages: deduplicating in-flight request for chatId=${chatId}`);
      return existing;
    }

    const fetchPromise = this.withOperationSlot(async () => {
      const chat = await client.getChatById(chatId);
      const messages = await chat.fetchMessages({ limit });
      return messages
        .map(mapMessage)
        .sort((left, right) => left.timestamp - right.timestamp);
    });

    this.messagesFetchInProgress.set(key, fetchPromise);
    try {
      return await fetchPromise;
    } catch (error) {
      this.handleFatalBrowserError(error);
      throw error;
    } finally {
      this.messagesFetchInProgress.delete(key);
    }
  }

  async sendMessage(
    chatId: string,
    body: string,
    media?: { data: string; mimetype: string; filename: string },
  ) {
    LOG("API: sendMessage", {
      chatId,
      hasMedia: Boolean(media),
      bodyLength: String(body ?? "").length,
    });
    const client = await this.requireReadyClient();
    const content = body.trim();

    if (!content && !media) {
      throw new Error("Message body or media is required.");
    }

    try {
      let message: Message;

      if (media) {
        message = await this.withOperationSlot(() =>
          this.sendMediaWithFallbacks(client, chatId, media, content),
        );
      } else {
        message = await this.withOperationSlot(() =>
          client.sendMessage(chatId, content),
        );
      }

      const mapped = mapMessage(message);
      publishWhatsAppEvent("message", { chatId, message: mapped });
      publishWhatsAppEvent("chats-updated", { chatId });
      return mapped;
    } catch (error) {
      this.handleFatalBrowserError(error);
      throw toSendMessageError(error);
    }
  }

  async editMessage(messageId: string, body: string) {
    LOG("API: editMessage", { messageId });
    const client = await this.requireReadyClient();
    const content = body.trim();

    if (!content) {
      throw new Error("Message body is required.");
    }

    try {
      const message = await this.withOperationSlot(() =>
        client.getMessageById(messageId),
      );

      if (!message) {
        throw new Error("Message not found.");
      }

      if (!message.fromMe) {
        throw new Error("Only sent messages can be edited.");
      }

      if (message.type !== "chat") {
        throw new Error("Only text messages can be edited.");
      }

      if (message.hasMedia) {
        throw new Error("Media messages cannot be edited.");
      }

      const existingContent = toSafeMessageBody(message.body);
      if (existingContent === content) {
        return mapMessage(message);
      }

      const messageTimestamp = Number(message.timestamp ?? 0) * 1000;
      if (messageTimestamp > 0) {
        const ageMs = Date.now() - messageTimestamp;
        if (ageMs > WHATSAPP_EDIT_WINDOW_MS) {
          throw new Error(
            "This message can no longer be edited. WhatsApp allows edits only within 15 minutes.",
          );
        }
      }

      await this.withOperationSlot(() => message.edit(content));

      const updated = await this.withOperationSlot(() =>
        client.getMessageById(messageId),
      );
      const mapped = mapMessage(updated ?? message);

      publishWhatsAppEvent("message", {
        chatId: mapped.chatId,
        message: mapped,
      });
      publishWhatsAppEvent("messages-updated", { chatId: mapped.chatId });
      publishWhatsAppEvent("chats-updated", { chatId: mapped.chatId });

      return mapped;
    } catch (error) {
      this.handleFatalBrowserError(error);
      throw toEditableMessageError(error);
    }
  }

  async deleteMessage(messageId: string, everyone = true) {
    LOG("API: deleteMessage", { messageId, everyone });
    const client = await this.requireReadyClient();

    try {
      const message = await this.withOperationSlot(() =>
        client.getMessageById(messageId),
      );

      if (!message) {
        throw new Error("Message not found.");
      }

      if (everyone && !message.fromMe) {
        throw new Error("Only sent messages can be deleted for everyone.");
      }

      const chatId = message.fromMe ? message.to : message.from;
      await this.withOperationSlot(() => message.delete(everyone));

      publishWhatsAppEvent("messages-updated", { chatId });
      publishWhatsAppEvent("chats-updated", { chatId });

      return { chatId };
    } catch (error) {
      this.handleFatalBrowserError(error);
      throw error;
    }
  }

  async getMedia(messageId: string) {
    LOG("API: getMedia", { messageId });
    const client = await this.requireReadyClient();
    try {
      const message = await this.withOperationSlot(() =>
        client.getMessageById(messageId),
      );
      if (!message) {
        throw new Error("Message not found.");
      }
      if (!message.hasMedia) {
        throw new Error("Message has no media.");
      }
      const media = await this.withOperationSlot(() => message.downloadMedia());
      if (!media) {
        throw new Error("Failed to download media.");
      }
      return media;
    } catch (error) {
      this.handleFatalBrowserError(error);
      throw error;
    }
  }

  async logout() {
    LOG("API: logout called");
    this.isManualLogoutInProgress = true;
    this.clearReconnectTimer();
    const sessionPath = path.join(SESSION_DIR, "session-admin-whatsapp");
    if (!this.client) {
      LOG("logout: no client, resetting state");
      // Clear chat cache and related state
      this.chatsCache = [];
      this.chatsCacheAt = 0;
      this.chatsRefreshPromise = null;
      this.avatarCache.clear();
      this.avatarFetchInProgress.clear();
      this.deletePersistedCaches();
      // Remove session directory from disk
      try {
        if (fs.existsSync(sessionPath)) {
          await fs.promises.rm(sessionPath, { recursive: true, force: true });
          LOG("logout: removed session directory", sessionPath);
        }
      } catch (e) {
        LOG("logout: failed to remove session directory", String(e));
      }
      this.setState(createDefaultState());
      this.isManualLogoutInProgress = false;
      return;
    }

    try {
      LOG("logout: calling client.logout()");
      await this.client.logout();
      LOG("logout: calling client.destroy()");
      await this.client.destroy();
    } finally {
      try {
        cleanupStuckLockfiles();
      } catch {}
      this.client = null;
      // Clear chat cache and related state
      this.chatsCache = [];
      this.chatsCacheAt = 0;
      this.chatsRefreshPromise = null;
      this.avatarCache.clear();
      this.avatarFetchInProgress.clear();
      this.deletePersistedCaches();
      // Remove session directory from disk
      try {
        if (fs.existsSync(sessionPath)) {
          await fs.promises.rm(sessionPath, { recursive: true, force: true });
          LOG("logout: removed session directory", sessionPath);
        }
      } catch (e) {
        LOG("logout: failed to remove session directory", String(e));
      }
      this.setState({
        ...createDefaultState(),
        status: "disconnected",
      });
      publishWhatsAppEvent("chats-updated");
      LOG("logout: complete, client cleared");
      this.isManualLogoutInProgress = false;
    }
  }

  /**
   * Force clear the session directory, kill lingering browser processes,
   * and attempt to reinitialize a fresh client. This is destructive and will
   * remove saved WhatsApp authentication (QR required to re-link).
   */
  /**
   * Gracefully destroy the Chromium browser without touching the auth session.
   * Called on SIGINT / SIGTERM so the browser cleans up its own lockfiles.
   */
  async shutdownClient() {
    if (!this.client) {
      return;
    }
    const c = this.client;
    this.client = null;
    this.initializingPromise = null;
    this.clearReconnectTimer();
    try {
      LOG("shutdownClient: destroying browser");
      await c.destroy();
      LOG("shutdownClient: done");
    } catch (e) {
      LOG("shutdownClient: error during destroy", String(e));
    }
  }

  async forceClearSession() {
    LOG("forceClearSession: starting");
    this.clearReconnectTimer();

    const sessionPath = path.join(SESSION_DIR, "session-admin-whatsapp");

    // Destroy client if present
    if (this.client) {
      try {
        LOG("forceClearSession: destroying client");
        await this.client.destroy();
      } catch (e) {
        LOG("forceClearSession: error destroying client", String(e));
      }
    }

    this.client = null;
    this.initializingPromise = null;
    this.chatsCache = [];
    this.chatsCacheAt = 0;
    this.chatsRefreshPromise = null;
    this.avatarCache.clear();
    this.avatarFetchInProgress.clear();
    this.deletePersistedCaches();

    try {
      cleanupStuckLockfiles();
    } catch (e) {
      LOG("forceClearSession: cleanupStuckLockfiles failed", String(e));
    }

    try {
      await killBrowserProcessesReferencing(sessionPath);
    } catch (e) {
      LOG(
        "forceClearSession: killBrowserProcessesReferencing failed",
        String(e),
      );
    }

    try {
      // Remove session directory
      if (fs.existsSync(sessionPath)) {
        await fs.promises.rm(sessionPath, { recursive: true, force: true });
        LOG("forceClearSession: removed session directory", sessionPath);
      } else {
        LOG("forceClearSession: session directory not present", sessionPath);
      }
    } catch (e) {
      LOG("forceClearSession: failed to remove session directory", String(e));
    }

    // Reset state and try to re-initiate a new client instance
    this.setState(createDefaultState());

    try {
      await this.ensureInitialized();
      LOG("forceClearSession: reinitialization attempted");
    } catch (e) {
      LOG("forceClearSession: reinitialization failed", String(e));
      this.scheduleReconnect("force-clear-session-reinit-failed");
      throw e;
    }
  }
}

export const whatsappService = new WhatsAppService();
