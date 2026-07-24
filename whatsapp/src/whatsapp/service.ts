import fs from "fs";
import os from "os";
import path from "path";
import { exec, spawnSync } from "child_process";
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
      try {
        // lstatSync sees dangling Singleton* symlinks; existsSync does not.
        fs.lstatSync(p);
        fs.unlinkSync(p);
        // DevToolsActivePort is always left behind on abrupt exit — not worth logging.
        if (name !== "DevToolsActivePort") {
          console.log(`[WhatsApp] Cleaned up stuck lockfile: ${name}`);
        }
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "";
        if (code !== "ENOENT") {
          LOG("cleanupStuckLockfiles: failed", name, String(error));
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
      const cmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and $_.Name -match 'chrome|chromium' -and $_.CommandLine -and $_.CommandLine -match '${marker}' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`;
      await execp(cmd);
      LOG(
        "killBrowserProcessesReferencing: attempted PowerShell stop for marker",
        marker,
      );
      return;
    }

    // POSIX: inspect the process table in Node instead of a grep/xargs shell
    // pipeline. The old pipeline could match and kill its own shell because
    // the marker also appeared in the command string.
    const { stdout } = await execp("ps -axo pid=,command=");
    const matchingPids = stdout
      .split("\n")
      .map((line) => line.match(/^\s*(\d+)\s+(.+)$/))
      .filter(
        (match): match is RegExpMatchArray =>
          Boolean(match) &&
          Number(match?.[1]) !== process.pid &&
          /(?:chrome|chromium)/i.test(match?.[2] ?? "") &&
          (match?.[2] ?? "").includes(sessionPath),
      )
      .map((match) => Number(match[1]))
      .filter((pid) => Number.isInteger(pid) && pid > 1);

    for (const pid of matchingPids) {
      try {
        process.kill(pid, "SIGTERM");
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "";
        if (code !== "ESRCH") {
          throw error;
        }
      }
    }

    if (matchingPids.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    const survivors = matchingPids.filter((pid) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    });

    for (const pid of survivors) {
      try {
        process.kill(pid, "SIGKILL");
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "";
        if (code !== "ESRCH") {
          throw error;
        }
      }
    }

    if (matchingPids.length > 0) {
      LOG(
        "killBrowserProcessesReferencing: stopped stale browser processes",
        matchingPids,
      );
    }
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

function resolveWhatsAppUserAgent() {
  const configured = process.env.WHATSAPP_USER_AGENT?.trim();
  if (configured) {
    return configured;
  }

  if (chromiumExecutablePath) {
    try {
      const result = spawnSync(chromiumExecutablePath, ["--version"], {
        encoding: "utf8",
        timeout: 3000,
      });
      const output = `${result.stdout ?? ""} ${result.stderr ?? ""}`;
      const version = output.match(/(\d+\.\d+\.\d+\.\d+)/)?.[1];
      if (version) {
        // whatsapp-web.js currently defaults to Chrome 101 even when a much
        // newer system Chrome is launched. WhatsApp can reject or stall device
        // linking for that obsolete browser identity, so advertise the actual
        // installed browser version while still hiding the HeadlessChrome tag.
        return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
      }
    } catch (error) {
      LOG("resolveWhatsAppUserAgent: browser version check failed", String(error));
    }
  }

  return undefined;
}

const whatsappUserAgent = resolveWhatsAppUserAgent();
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
// Found avatars are cached for hours. Failed/null lookups are not cached because
// they are also returned transiently while WhatsApp is reconnecting or syncing.
const avatarCacheOkTtlMs = Number(
  process.env.WHATSAPP_AVATAR_CACHE_TTL_MS ?? 6 * 60 * 60 * 1000,
);
// Lower default chat fetch limit for performance
const chatFetchLimit = Number(process.env.WHATSAPP_CHAT_FETCH_LIMIT ?? 50);
// How many times the background chat-cache pre-warm retries while WhatsApp Web
// is still syncing its store on a cold start. ~8 attempts (5s + 7×8s ≈ 60s)
// covers a slow first sync without spinning forever.
const WARM_CACHE_MAX_ATTEMPTS = Number(
  process.env.WHATSAPP_WARM_CACHE_MAX_ATTEMPTS ?? 8,
);
const operationConcurrencyLimit = Number(
  process.env.WHATSAPP_OPERATION_CONCURRENCY ?? 12,
);
const operationQueueLimit = Number(
  process.env.WHATSAPP_OPERATION_QUEUE_LIMIT ?? 200,
);
const operationQueueTimeoutMs = Number(
  process.env.WHATSAPP_OPERATION_QUEUE_TIMEOUT_MS ?? 30000,
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

function toSafeMediaCaption(body: string | undefined | null) {
  const caption = toSafeMessageBody(body);
  if (!caption) {
    return "";
  }

  // Some WhatsApp Web builds put the uploaded media payload in the returned
  // message body. It is transport data, not a user caption, and must never be
  // rendered in the conversation.
  if (/^data:[^;,]+;base64,/i.test(caption)) {
    return "";
  }
  if (
    caption.length >= 256 &&
    caption.length % 4 === 0 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(caption)
  ) {
    return "";
  }

  return caption;
}

type MessageInternalData = {
  notifyName?: string;
  mimetype?: string;
  filename?: string;
  quotedMsg?: {
    id?: { _serialized?: string };
    body?: string;
    caption?: string;
    notifyName?: string;
  };
  quotedStanzaID?: string;
};

type ChatInternalData = {
  formattedTitle?: string;
  name?: string;
  pushname?: string;
  formattedName?: string;
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

function digitsOnly(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

// Prefix a dialable phone number with "+" so the country code is visible in the
// UI. Idempotent (skips values already starting with "+"), and intentionally
// leaves WhatsApp lid-style ids untouched: real E.164 numbers carry a country
// code and run 8–13 digits, while lids are ~15+ and are not dialable.
function formatPhoneNumberForDisplay(value: string | null | undefined) {
  if (!value) return value ?? null;
  const str = String(value);
  if (str.startsWith("+")) return str;
  const digits = digitsOnly(str);
  if (digits.length < 8 || digits.length > 13) return str;
  // Format common country codes with readable spacing so the display shows
  // "+91 98765 43210" rather than the raw "+919876543210".
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 12 && digits.startsWith("44")) {
    return `+44 ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("971")) {
    return `+971 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return `+${digits}`;
}

function getPhoneNumberFromChatId(chatId: string | null | undefined) {
  // A LID is WhatsApp's internal privacy-preserving contact identifier, not a
  // dialable phone number. It must be resolved through WA's LID↔PN mapping
  // before it is exposed as a phone-number label.
  if (String(chatId ?? "").includes("@lid")) {
    return null;
  }

  const normalized = normalizeWhatsAppIdentifier(chatId);
  if (!normalized) {
    return null;
  }

  const digits = digitsOnly(normalized);
  return formatPhoneNumberForDisplay(digits || normalized);
}

function isLikelyLidIdentifier(value: string | null | undefined) {
  const normalized = normalizeWhatsAppIdentifier(value);
  if (!normalized) return false;
  // The reliable signal is the "@lid" server. The length check is only a
  // backstop for a bare phone-number field that's actually a lid-derived id:
  // real E.164 numbers top out around 13 digits (≤3 country code + ≤10), while
  // WhatsApp lids are ~15+, so 11–13 digit numbers must not be flagged.
  return (
    String(value ?? "").includes("@lid") || digitsOnly(normalized).length > 13
  );
}

function isPhoneLikeLabel(value: string, phoneNumber: string | null) {
  const valueDigits = digitsOnly(value);
  const phoneDigits = digitsOnly(phoneNumber);

  if (!valueDigits) {
    return false;
  }

  if (phoneDigits && valueDigits === phoneDigits) {
    return true;
  }

  return /^[+\d\s().:-]+$/.test(value);
}

function getDisplayNameFromCandidates(
  candidates: Array<string | null | undefined>,
  phoneNumber: string | null,
) {
  for (const candidate of candidates) {
    const normalized = normalizeWhatsAppIdentifier(candidate);
    if (!normalized) continue;
    if (isPhoneLikeLabel(normalized, phoneNumber)) continue;
    return normalized;
  }

  return phoneNumber || "";
}

// Shape of a serialized WA Web internal message (msg.serialize()) as returned
// by fetchMessagesRaw(). Only the fields we consume are typed; the rest are
// tolerated via the index signature.
type Wid = { server?: string; user?: string; _serialized?: string };
type MessageKeyData = {
  _serialized?: string;
  fromMe?: boolean;
  remote?: Wid | string;
  id?: string;
  self?: string;
};
interface MessageRawData {
  id?: MessageKeyData;
  body?: string;
  caption?: string;
  type?: string;
  t?: number;
  from?: Wid | string;
  to?: Wid | string;
  author?: Wid | string;
  notifyName?: string;
  ack?: number;
  self?: string;
  contextInfo?: {
    quotedMessage?: unknown;
    stanzaId?: string;
    participant?: Wid | string;
  };
  [k: string]: unknown;
}

function serializeWid(value: Wid | string | undefined): string {
  if (typeof value === "string") return value;
  if (value?._serialized) return value._serialized;
  if (value?.user && value?.server) return `${value.user}@${value.server}`;
  return "";
}

function serializeMessageKey(value: MessageKeyData | unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";

  const key = value as MessageKeyData & { toString?: () => string };
  if (key._serialized) return key._serialized;

  // Live WAWeb MsgKey models still stringify to the collection key even though
  // `_serialized` was removed in current 2.3000 builds.
  if (typeof key.toString === "function") {
    const serialized = key.toString();
    if (serialized && serialized !== "[object Object]") {
      return serialized;
    }
  }

  // msg.serialize() strips the MsgKey prototype. Rebuild the exact key format
  // used by WAWebCollections.Msg: fromMe_remote_id_self.
  const remote = serializeWid(key.remote);
  if (!remote || !key.id) return "";
  return `${Boolean(key.fromMe)}_${remote}_${key.id}${
    key.self ? `_${key.self}` : ""
  }`;
}

// Adapt a serialized raw message into the wwebjs Message-like object that
// mapMessage() and the group-labeling code expect. Only the accessed surface
// is reproduced (getters used by mapMessage + `author`).
function rawToMessageLike(raw: MessageRawData): Message {
  const ser = (w?: Wid | string): string =>
    typeof w === "string" ? w : w?._serialized || "";
  const quoted = raw.contextInfo?.quotedMessage;
  return {
    id: {
      _serialized: serializeMessageKey(raw.id),
      fromMe: Boolean(raw.id?.fromMe),
    },
    body: typeof raw.body === "string" ? raw.body : raw.caption || "",
    type: raw.type || "chat",
    timestamp: typeof raw.t === "number" ? raw.t : 0,
    fromMe: Boolean(raw.id?.fromMe),
    from: ser(raw.from),
    to: ser(raw.to),
    author: ser(raw.author) || undefined,
    ack: typeof raw.ack === "number" ? raw.ack : undefined,
    hasMedia: ["image", "video", "audio", "ptt", "document", "sticker"].includes(
      raw.type || "",
    ),
    _data: {
      notifyName: raw.notifyName,
      quotedStanzaID: raw.contextInfo?.stanzaId,
      quotedMsg: quoted,
      mimetype: (raw as { mimetype?: string }).mimetype,
      filename: (raw as { filename?: string }).filename,
    },
  } as unknown as Message;
}

function mapMessage(message: Message): WhatsAppMessage {
  const internalData = message as Message & {
    _data?: MessageInternalData;
  };

  const hasMedia = Boolean(message.hasMedia);
  const rawBody = hasMedia
    ? toSafeMediaCaption(message.body)
    : toSafeMessageBody(message.body);
  const fallbackLabel = getMessageTypeLabel(message.type, false);

  const quotedMsg = internalData._data?.quotedMsg;
  const quotedMessageId =
    quotedMsg?.id?._serialized || internalData._data?.quotedStanzaID || null;
  const quotedMessageBody = quotedMsg
    ? toSafeMessageBody(quotedMsg.body || quotedMsg.caption) || null
    : null;
  const quotedMessageAuthor = quotedMsg
    ? normalizeWhatsAppIdentifier(quotedMsg.notifyName || null)
    : null;

  return {
    id: serializeMessageKey(message.id),
    chatId: message.fromMe ? message.to : message.from,
    body: hasMedia ? rawBody : rawBody || fallbackLabel || "Unsupported message",
    timestamp: Number(message.timestamp ?? 0) * 1000,
    fromMe: message.fromMe,
    author: normalizeWhatsAppIdentifier(
      internalData._data?.notifyName || message.author || null,
    ),
    ack: typeof message.ack === "number" ? message.ack : undefined,
    hasMedia,
    mediaType: message.type || null,
    mimetype: internalData._data?.mimetype || null,
    filename: internalData._data?.filename || null,
    quotedMessageId,
    quotedMessageBody,
    quotedMessageAuthor,
  };
}

function getLastMessagePreview(message: MessageLike | null | undefined) {
  if (!message) {
    return "Open chat to view messages";
  }

  const body = message.hasMedia
    ? toSafeMediaCaption(message.body)
    : toSafeMessageBody(message.body);
  const label = getMessageTypeLabel(message.type, Boolean(message.hasMedia));

  if (message.hasMedia) {
    return body ? `${label}: ${body}` : label;
  }

  return body || label || "Open chat to view messages";
}

function mapChat(chat: Chat): WhatsAppChatSummary {
  const internalData = chat as Chat & {
    _data?: ChatInternalData;
  };
  const lastTimestamp =
    typeof chat.timestamp === "number" ? chat.timestamp * 1000 : null;
  const lastMessage = getLastMessagePreview(chat.lastMessage as MessageLike);
  const phoneNumber = getPhoneNumberFromChatId(chat.id._serialized);
  const displayName = getDisplayNameFromCandidates(
    [
      internalData._data?.formattedTitle,
      chat.name,
      internalData._data?.name,
      internalData._data?.formattedName,
      internalData._data?.pushname,
    ],
    phoneNumber,
  );

  return {
    id: chat.id._serialized,
    name: displayName,
    phoneNumber,
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

function applyResolvedChatIdentity(
  chat: WhatsAppChatSummary,
  resolved: { phoneNumber?: string | null; name?: string | null } | null,
) {
  if (!resolved?.phoneNumber && !resolved?.name) {
    return chat;
  }

  const phoneNumber = formatPhoneNumberForDisplay(
    resolved.phoneNumber || chat.phoneNumber,
  );
  return {
    ...chat,
    phoneNumber,
    name: getDisplayNameFromCandidates(
      [resolved.name, chat.name, phoneNumber],
      phoneNumber,
    ),
    // Avatar lookups key off the raw number, so keep "+" out of the seed.
    avatarSeed: digitsOnly(phoneNumber) || chat.avatarSeed,
  };
}

function getChatAvatarSeed(chatId: string) {
  return chatId.split("@")[0] || chatId;
}

function createOptimisticChatSummary(
  message: WhatsAppMessage,
): WhatsAppChatSummary {
  const phoneNumber = getPhoneNumberFromChatId(message.chatId);
  return {
    id: message.chatId,
    name:
      phoneNumber ||
      (message.chatId.endsWith("@lid")
        ? ""
        : getChatAvatarSeed(message.chatId)),
    phoneNumber,
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
  // participant JID -> saved contact name (null when not a saved contact).
  private contactNameCache: Map<string, { name: string | null; at: number }> =
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
  private readyRecoveryTimer: NodeJS.Timeout | null = null;
  private readyRecoveryInFlight = false;
  private activeOperationCount = 0;
  private operationQueue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }> = [];
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
        this.chatsCache = parsed.chats.map((chat) => {
          const phoneNumber = isLikelyLidIdentifier(chat.id)
            ? null
            : chat.phoneNumber || getPhoneNumberFromChatId(chat.id);
          return {
            ...chat,
            phoneNumber,
            name: getDisplayNameFromCandidates(
              [
                isLikelyLidIdentifier(chat.name) ||
                chat.name === "Unknown contact"
                  ? null
                  : chat.name,
              ],
              phoneNumber,
            ),
          };
        });
        const containsLidLabels = this.chatsCache.some(
          (chat) =>
            !chat.isGroup &&
            (isLikelyLidIdentifier(chat.id) ||
              isLikelyLidIdentifier(chat.phoneNumber)),
        );
        this.chatsCacheAt =
          containsLidLabels
            ? 0
            : typeof parsed.chatsAt === "number"
              ? parsed.chatsAt
              : 0;
      }

      if (Array.isArray(parsed.avatars)) {
        const now = Date.now();
        for (const [id, entry] of parsed.avatars) {
          // Do not restore cached "no avatar" results across restarts. A null
          // produced by an outdated WA module lookup would otherwise hide every
          // profile picture until its negative-cache TTL expires.
          if (!entry?.url) continue;
          if (now - entry.at <= avatarCacheOkTtlMs) {
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
    const tempFile = `${CACHE_FILE}.${process.pid}.tmp`;
    try {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
      fs.writeFileSync(
        tempFile,
        JSON.stringify({
          savedAt: Date.now(),
          chats: this.chatsCache,
          chatsAt: this.chatsCacheAt,
          avatars: Array.from(this.avatarCache.entries()),
        }),
      );
      // Atomic replacement prevents a process interruption from leaving a
      // partially written JSON cache that every user would inherit on restart.
      fs.renameSync(tempFile, CACHE_FILE);
    } catch (e) {
      LOG("persistCachesNow: failed", String(e));
      try {
        fs.unlinkSync(tempFile);
      } catch {}
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

  private async resolveChatIdentities(
    client: WhatsAppClient,
    chats: WhatsAppChatSummary[],
  ) {
    const ids = chats
      .filter(
        (chat) =>
          !chat.isGroup &&
          (isLikelyLidIdentifier(chat.id) ||
            isLikelyLidIdentifier(chat.phoneNumber)),
      )
      .map((chat) => chat.id);

    if (ids.length === 0) {
      return chats;
    }

    const resolvedById: Record<
      string,
      { phoneNumber: string | null; name: string | null }
    > = {};

    // Prefer whatsapp-web.js's supported LID/phone resolver. It runs lookups in
    // parallel and preserves result order, avoiding the old sequential
    // in-page loop timing out and leaving the raw LID visible in the UI.
    try {
      const pairs = await withTimeout(
        client.getContactLidAndPhone(ids),
        20000,
        "getContactLidAndPhone",
      );
      pairs.forEach((pair, index) => {
        const chatId = ids[index];
        const phoneNumber = getPhoneNumberFromChatId(pair?.pn);
        if (chatId && phoneNumber) {
          resolvedById[chatId] = { phoneNumber, name: null };
        }
      });
    } catch (error) {
      LOG("getContactLidAndPhone failed:", String(error));
    }

    const unresolvedIds = ids.filter(
      (chatId) => !resolvedById[chatId]?.phoneNumber,
    );
    if (unresolvedIds.length === 0) {
      return chats.map((chat) =>
        applyResolvedChatIdentity(chat, resolvedById[chat.id] ?? null),
      );
    }

    const pupPage = (client as unknown as { pupPage?: unknown }).pupPage as
      | {
          evaluate(
            fn: (...a: unknown[]) => unknown,
            ...args: unknown[]
          ): Promise<unknown>;
        }
      | undefined;

    if (!pupPage?.evaluate) {
      return chats;
    }

    try {
      const resolved = (await withTimeout(
        pupPage.evaluate(async (chatIds: unknown) => {
          /* eslint-disable @typescript-eslint/no-explicit-any */
          const store = (window as any).Store;
          const out: Record<
            string,
            { phoneNumber: string | null; name: string | null }
          > = {};
          const onlyDigits = (s: any) =>
            typeof s === "string" ? s.replace(/[^0-9]/g, "") : "";

          // whatsapp-web.js exposes the real WA Web internal modules through
          // window.require. The lid↔phone mapping lives in 'WAWebApiContact'
          // (getPhoneNumber / getCurrentLid), NOT Store.LidUtils on this build,
          // which is why earlier Store.LidUtils lookups silently returned null.
          const requireMod = (name: string) => {
            try {
              return (window as any).require?.(name) ?? null;
            } catch {
              return null;
            }
          };
          const apiContact = requireMod("WAWebApiContact");
          const widFactory = requireMod("WAWebWidFactory");

          const getContact = (jid: string) => {
            try {
              const c = store?.Contact?.get?.(jid);
              if (c) return c;
            } catch {}
            try {
              return (
                store?.Contact?.models?.find(
                  (m: any) => m?.id?._serialized === jid,
                ) ?? null
              );
            } catch {
              return null;
            }
          };

          // Turn a jid string (or existing Wid) into a real Wid object. The
          // phone-number lookup only works with a proper Wid, not a raw
          // "<num>@lid" string, so unsaved lid contacts fail unless we build
          // one here.
          const toWid = (val: any) => {
            if (!val) return null;
            if (typeof val === "object" && (val.user || val._serialized))
              return val;
            for (const wf of [widFactory, store?.WidFactory]) {
              for (const m of [
                "createWid",
                "createWidFromWidLike",
                "createWidFromWid",
              ]) {
                try {
                  const w = wf?.[m]?.(val);
                  if (w) return w;
                } catch {}
              }
            }
            return null;
          };

          const pnWidToDigits = (pnWid: any) => {
            if (!pnWid) return "";
            if (pnWid?.user) return onlyDigits(pnWid.user);
            if (typeof pnWid === "string") {
              const d = onlyDigits(pnWid.split("@")[0]);
              if (d) return d;
            }
            // The lookup may return only a serialized pn jid; resolve its
            // contact to read the phone-form id.
            if (pnWid?._serialized) {
              const pnc = getContact(pnWid._serialized);
              if (pnc?.id?.server === "c.us" && pnc.id.user)
                return onlyDigits(pnc.id.user);
            }
            return "";
          };

          const phoneFromLid = (wid: any) => {
            try {
              const viaApi = apiContact?.getPhoneNumber?.(wid);
              const d = pnWidToDigits(viaApi);
              if (d) return d;
            } catch {}
            try {
              return pnWidToDigits(store?.LidUtils?.getPhoneNumber?.(wid));
            } catch {}
            return "";
          };

          const phoneFromContact = (jid: string, c: any) => {
            const pn = c?.phoneNumber;
            if (pn) {
              if (typeof pn === "object" && pn.user) return onlyDigits(pn.user);
              if (typeof pn === "string") {
                const d = onlyDigits(pn.split("@")[0]);
                if (d) return d;
              }
            }
            // Try the lid → phone mapping with a real Wid (contact id first,
            // then one built from the jid string).
            for (const cand of [c?.id, toWid(jid)]) {
              const d = cand && phoneFromLid(cand);
              if (d) return d;
            }
            if (c?.id?.server === "c.us" && c.id.user)
              return onlyDigits(c.id.user);
            return "";
          };

          // Last resort for a lid whose phone mapping isn't cached locally:
          // ask WhatsApp to fetch it (enforceLidAndPnRetrieval queries the
          // server). Awaited because it's a network round-trip.
          const enforcePhone = async (jid: string) => {
            try {
              const res = await (window as any).WWebJS?.enforceLidAndPnRetrieval?.(
                jid,
              );
              return pnWidToDigits(res?.phone);
            } catch {
              return "";
            }
          };

          // Each enforcePhone() is a server round-trip; bound how many fire per
          // call so a list full of unsynced lids can't exceed the eval timeout.
          // The next refresh resolves any that were skipped this pass.
          let enforceBudget = 12;
          for (const jid of chatIds as string[]) {
            try {
              const c = getContact(jid);
              let phone = jid.includes("@c.us")
                ? onlyDigits(jid.split("@")[0])
                : phoneFromContact(jid, c);
              if (!phone && jid.includes("@lid") && enforceBudget > 0) {
                enforceBudget--;
                phone = await enforcePhone(jid);
              }
              const name =
                typeof c?.name === "string" && c.name.trim()
                  ? c.name.trim()
                  : null;
              out[jid] = {
                phoneNumber: phone || null,
                name,
              };
            } catch {
              out[jid] = { phoneNumber: null, name: null };
            }
          }

          return out;
          /* eslint-enable @typescript-eslint/no-explicit-any */
        }, unresolvedIds) as Promise<
          Record<string, { phoneNumber: string | null; name: string | null }>
        >,
        15000,
        "resolveChatIdentities",
      )) as Record<string, { phoneNumber: string | null; name: string | null }>;

      const combined = { ...resolvedById, ...resolved };
      return chats.map((chat) =>
        applyResolvedChatIdentity(chat, combined[chat.id] ?? null),
      );
    } catch (error) {
      LOG("resolveChatIdentities failed:", String(error));
      return chats.map((chat) =>
        applyResolvedChatIdentity(chat, resolvedById[chat.id] ?? null),
      );
    }
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

  private clearReadyRecoveryTimer() {
    if (this.readyRecoveryTimer) {
      clearTimeout(this.readyRecoveryTimer);
      this.readyRecoveryTimer = null;
    }
  }

  /**
   * Current WA Web 2.3000 builds can finish socket sync before whatsapp-web.js
   * attaches its `change:hasSynced` listener. In that race `authenticated`
   * fires, but `ready` never does. Re-run the already-exposed sync callback
   * once the socket reports CONNECTED/hasSynced so the library completes its
   * normal utility injection and emits `ready`.
   */
  private scheduleReadyRecovery(client: WhatsAppClient) {
    this.clearReadyRecoveryTimer();
    this.readyRecoveryTimer = setTimeout(async () => {
      this.readyRecoveryTimer = null;
      if (
        this.readyRecoveryInFlight ||
        this.client !== client ||
        this.state.status !== "authenticated"
      ) {
        return;
      }

      const page = (client as unknown as { pupPage?: unknown }).pupPage as
        | {
            evaluate<T>(fn: () => T | Promise<T>): Promise<T>;
          }
        | undefined;
      if (!page?.evaluate) {
        return;
      }

      this.readyRecoveryInFlight = true;
      try {
        const result = await withTimeout(
          page.evaluate(async () => {
            try {
              /* eslint-disable @typescript-eslint/no-explicit-any */
              const w = window as any;
              const socket = w.require?.("WAWebSocketModel")?.Socket;
              const state = socket?.state ?? null;
              const hasSynced = Boolean(socket?.hasSynced);
              const canSignal =
                typeof w.onAppStateHasSyncedEvent === "function";

              if ((state === "CONNECTED" || hasSynced) && canSignal) {
                await w.onAppStateHasSyncedEvent();
                return { state, hasSynced, triggered: true };
              }

              return { state, hasSynced, triggered: false };
              /* eslint-enable @typescript-eslint/no-explicit-any */
            } catch (error) {
              return {
                state: null,
                hasSynced: false,
                triggered: false,
                error: String(error),
              };
            }
          }),
          45000,
          "WhatsApp ready recovery",
        );
        LOG("ready recovery check", result);
      } catch (error) {
        LOG("ready recovery failed", String(error));
      } finally {
        this.readyRecoveryInFlight = false;
      }

      if (this.client === client && this.state.status === "authenticated") {
        this.scheduleReadyRecovery(client);
      }
    }, 15000);
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

    const maxQueue =
      Number.isFinite(operationQueueLimit) && operationQueueLimit > 0
        ? operationQueueLimit
        : 200;
    if (this.operationQueue.length >= maxQueue) {
      throw new Error(
        "WhatsApp is busy handling other users. Please retry shortly.",
      );
    }

    await new Promise<void>((resolve, reject) => {
      const timeoutMs =
        Number.isFinite(operationQueueTimeoutMs) &&
        operationQueueTimeoutMs > 0
          ? operationQueueTimeoutMs
          : 30000;
      const waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const index = this.operationQueue.indexOf(waiter);
          if (index >= 0) {
            this.operationQueue.splice(index, 1);
          }
          reject(
            new Error(
              "WhatsApp is busy handling other users. Please retry shortly.",
            ),
          );
        }, timeoutMs),
      };
      this.operationQueue.push(waiter);
    });
    this.activeOperationCount += 1;
  }

  private releaseOperationSlot() {
    this.activeOperationCount = Math.max(0, this.activeOperationCount - 1);
    const next = this.operationQueue.shift();
    if (next) {
      clearTimeout(next.timer);
      next.resolve();
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

      // Stop any browser still using this profile before deleting its lock
      // markers. Deleting the markers first allowed a second Chrome instance
      // to open the same profile while the orphaned process was still alive.
      try {
        const sessionPath = path.join(SESSION_DIR, "session-admin-whatsapp");
        fs.mkdirSync(sessionPath, { recursive: true });
        await killBrowserProcessesReferencing(sessionPath);
        // Give terminated browser processes time to release their profile
        // handles, then remove any remaining lockfiles/dangling symlinks.
        await new Promise((resolve) => setTimeout(resolve, 400));
        cleanupStuckLockfiles();
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
        ...(whatsappUserAgent ? { userAgent: whatsappUserAgent } : {}),
        puppeteer: {
          headless: process.env.WHATSAPP_HEADLESS !== "false",
          executablePath: chromiumExecutablePath,
          // `protocolTimeout` is a valid runtime Puppeteer launch option but is
          // missing from the old bundled puppeteer-core 18.2.1 LaunchOptions
          // type. Cast so tsc accepts it without dropping the runtime behavior.
          ...({
            protocolTimeout: Number.isFinite(protocolTimeoutMs)
              ? protocolTimeoutMs
              : 180000,
          } as Record<string, unknown>),
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
        // WA Web version handling:
        //  - If WHATSAPP_WEB_VERSION is set, pin that exact build from the
        //    wppconnect archive (deterministic, but breaks when the pinned
        //    build ages out / is pruned from the mirror).
        //  - If it is UNSET, use type:'local' (whatever WhatsApp Web serves
        //    live). This self-heals to the current build so `ready` fires even
        //    after WA rolls its web build forward, instead of hanging on a
        //    dead pinned version. This is wwebjs's own default.
        ...(process.env.WHATSAPP_WEB_VERSION
          ? {
              webVersion: process.env.WHATSAPP_WEB_VERSION,
              webVersionCache: {
                type: "remote" as const,
                remotePath:
                  "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html",
              },
            }
          : {
              webVersionCache: { type: "local" as const },
            }),
      });

      client.on("qr", (qr: string) => {
        LOG("event: qr received");
        this.clearReadyRecoveryTimer();
        this.setState({ status: "qr", qr, error: null });
      });

      client.on("authenticated", () => {
        LOG("event: authenticated");
        this.clearAuthFailureHistory();
        this.setState({ status: "authenticated", error: null });
        this.scheduleReadyRecovery(client);
      });

      client.on("ready", () => {
        LOG("event: ready");
        this.clearReadyRecoveryTimer();
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
            // Background pre-warm can afford the slow, reliable getChats()
            // read (it doesn't block any HTTP request), so on a cold start it
            // actually pulls the chat list instead of waiting for WhatsApp
            // Web's store to lazily populate on its own.
            await this.refreshChats(liveClient, { allowSlowFallback: true });
            if (this.chatsCache.length <= 1 && attempt < WARM_CACHE_MAX_ATTEMPTS) {
              LOG(
                `Chat cache pre-warm attempt ${attempt}: only ${this.chatsCache.length} chat(s) loaded, retrying shortly`,
              );
              setTimeout(
                () => warmCache(attempt + 1),
                attempt === 1 ? 5000 : 8000,
              );
            } else {
              LOG(
                `Chat cache pre-warmed successfully (${this.chatsCache.length} chats, attempt ${attempt})`,
              );
              publishWhatsAppEvent("chats-updated");
            }
          } catch (e) {
            LOG(`Chat cache pre-warm attempt ${attempt} failed:`, String(e));
            if (attempt < WARM_CACHE_MAX_ATTEMPTS) {
              setTimeout(
                () => warmCache(attempt + 1),
                attempt === 1 ? 5000 : 8000,
              );
            }
          }
        };
        setTimeout(() => warmCache(1), 3000); // first attempt after 3 s
      });

      client.on("auth_failure", (message: string) => {
        LOG("event: auth_failure", message);
        this.clearReadyRecoveryTimer();
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
        this.clearReadyRecoveryTimer();
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

      client.on("change_state", (state: string) => {
        LOG("event: connection state", state);
      });

      client.on("loading_screen", (percent: number, message: string) => {
        LOG("event: loading screen", percent, message);
      });

      client.on("message", async (message: Message) => {
        LOG("event: message received", message.id?._serialized ?? "<no-id>");
        try {
          const mapped = mapMessage(message);
          let eventChat =
            this.chatsCache.find((c) => c.id === mapped.chatId) ?? null;
          if (
            eventChat &&
            !eventChat.isGroup &&
            (isLikelyLidIdentifier(eventChat.id) ||
              isLikelyLidIdentifier(eventChat.phoneNumber))
          ) {
            eventChat =
              (await this.resolveChatIdentities(client, [eventChat]))[0] ??
              eventChat;
          }

          if (!eventChat) {
            try {
              const chat = await this.withOperationSlot(() =>
                message.getChat(),
              );
              eventChat =
                (await this.resolveChatIdentities(client, [mapChat(chat)]))[0] ??
                mapChat(chat);
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
          const baseChat = existingChat ?? createOptimisticChatSummary(mapped);
          const resolvedBaseChat =
            baseChat.isGroup ||
            (!isLikelyLidIdentifier(baseChat.id) &&
              !isLikelyLidIdentifier(baseChat.phoneNumber))
              ? baseChat
              : (await this.resolveChatIdentities(client, [baseChat]))[0] ??
                baseChat;
          const updatedChat = {
            ...resolvedBaseChat,
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
    this.clearReadyRecoveryTimer();
    this.readyRecoveryInFlight = false;
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

    this.clearReadyRecoveryTimer();
    this.readyRecoveryInFlight = false;
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
    // Cache only successful URLs. A null can mean the client was still syncing,
    // the chat model was not loaded yet, or WhatsApp was reconnecting; treating
    // it as "no profile photo" hides valid avatars even after recovery.
    const cached = this.avatarCache.get(chatId);
    if (cached?.url) {
      if (Date.now() - cached.at <= avatarCacheOkTtlMs) {
        return cached.url;
      }
      this.avatarCache.delete(chatId);
    } else if (cached) {
      this.avatarCache.delete(chatId);
    }

    // Collapse concurrent lookups for the same chat into one in-flight request.
    const inFlight = this.avatarFetchInProgress.get(chatId);
    if (inFlight) {
      return inFlight;
    }

    const promise = this.resolveChatAvatarUrlById(chatId)
      .then((url) => {
        if (url) {
          this.avatarCache.set(chatId, { url, at: Date.now() });
          this.persistCachesDebounced();
        }
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
              const w = window as any;
              const serializedId = id as string;
              const bridge = w.require(
                "WAWebContactProfilePicThumbBridge",
              );
              const coll = w.require("WAWebCollections");
              const loadedChats =
                coll?.Chat?.getModelsArray?.() ?? coll?.Chat?.models ?? [];
              // Use the loaded model itself. Current WA Web's bridge accepts a
              // Chat model; reconstructing it through older Store/ProfilePic
              // wrappers returned null even though the model had a valid photo.
              const chat = loadedChats.find((candidate: any) => {
                  const candidateId = candidate?.id;
                  return (
                    String(candidateId) === serializedId ||
                    candidateId?._serialized === serializedId ||
                    `${candidateId?.user || ""}@${candidateId?.server || ""}` ===
                      serializedId
                  );
                });
              if (!chat || !bridge?.requestProfilePicFromServer) return null;
              const result = await bridge.requestProfilePicFromServer(chat);
              return typeof result?.eurl === "string" ? result.eurl : null;
            } catch (error: any) {
              if (error?.name === "ServerStatusCodeError") return null;
              return null;
            }
            /* eslint-enable @typescript-eslint/no-explicit-any */
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
    quotedMessageId?: string,
  ) {
    const normalizedMediaData = media.data.includes(",")
      ? media.data.slice(media.data.indexOf(",") + 1)
      : media.data;
    const mediaPayload = new MessageMedia(
      media.mimetype || "application/octet-stream",
      normalizedMediaData,
      media.filename || "attachment",
    );

    const baseOptions: Record<string, unknown> = {};

    if (content) {
      baseOptions.caption = content;
    }

    if (quotedMessageId) {
      baseOptions.quotedMessageId = quotedMessageId;
    }

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

      LOG("sendMediaWithFallbacks: direct media send failed", firstMessage);

      // Fallback 1: use the alternate whatsapp-web.js media option signature.
      // This follows a separate branch in Client.sendMessage and works around
      // current WA builds that reject a MessageMedia instance as the body.
      try {
        return await client.sendMessage(chatId, content || " ", {
          ...baseOptions,
          media: mediaPayload,
        });
      } catch (fallbackError) {
        LOG(
          "sendMediaWithFallbacks: media-option fallback failed",
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError),
        );
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
        fs.writeFileSync(
          tempFilePath,
          Buffer.from(normalizedMediaData, "base64"),
        );
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
    const searchDigits = digitsOnly(normalizedSearch);
    const filtered = chats
      .filter((chat) => {
        if (!normalizedSearch) {
          return true;
        }
        const searchableValues = [
          chat.name,
          chat.phoneNumber,
          chat.lastMessage,
          chat.id,
          chat.avatarSeed,
        ];
        const searchableText = searchableValues
          .join(" ")
          .toLowerCase();
        if (searchableText.includes(normalizedSearch)) {
          return true;
        }

        if (!searchDigits) {
          return false;
        }

        return searchableValues.some((value) =>
          digitsOnly(value).includes(searchDigits),
        );
      })
      .sort((left, right) => (right.timestamp ?? 0) - (left.timestamp ?? 0));
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }

  /**
   * Searches the full WhatsApp Web store — every loaded chat AND every known
   * contact — by name, saved name, push name, or phone number. Contacts that
   * have no existing chat are returned as startable chat summaries so the user
   * can open a fresh conversation from search results.
   */
  private async searchChatsAndContacts(
    client: WhatsAppClient,
    query: string,
    limit: number,
  ): Promise<WhatsAppChatSummary[]> {
    const pupPage = (client as unknown as { pupPage?: unknown }).pupPage as
      | {
          evaluate(
            fn: (...a: unknown[]) => unknown,
            ...args: unknown[]
          ): Promise<unknown>;
        }
      | undefined;
    if (!pupPage?.evaluate) return [];

    type RawHit = {
      id: string;
      name: string;
      idUser: string;
      phoneNumber: string | null;
      timestamp: number | null;
      unreadCount: number;
      isGroup: boolean;
      isMuted: boolean;
      isPinned: boolean;
      lastMessageBody: string | null;
      lastMessageHasMedia: boolean;
      lastMessageType: string | null;
    };

    try {
      const raw = (await withTimeout(
        pupPage.evaluate(
          (rawQuery: unknown, rawLimit: unknown) => {
            /* eslint-disable @typescript-eslint/no-explicit-any */
            const store = (window as any).Store;
            const onlyDigits = (value: any) =>
              String(value ?? "").replace(/[^0-9]/g, "");
            const q = String(rawQuery ?? "").toLowerCase();
            const qDigits = onlyDigits(q);
            const max = (rawLimit as number) || 50;
            const out: any[] = [];
            const seen = new Set<string>();
            const textMatches = (...values: any[]) =>
              values.some((value) => {
                const text = String(value ?? "").toLowerCase();
                if (text.includes(q)) return true;
                return Boolean(qDigits && onlyDigits(value).includes(qDigits));
              });
            const getContact = (jid: string) => {
              try {
                const contact = store?.Contact?.get?.(jid);
                if (contact) return contact;
              } catch {}
              try {
                return (
                  store?.Contact?.models?.find(
                    (model: any) => model?.id?._serialized === jid,
                  ) ?? null
                );
              } catch {
                return null;
              }
            };
            // lid↔phone lives in 'WAWebApiContact' on this build (reachable via
            // wwebjs's window.require shim), not Store.LidUtils.
            const requireMod = (name: string) => {
              try {
                return (window as any).require?.(name) ?? null;
              } catch {
                return null;
              }
            };
            const apiContact = requireMod("WAWebApiContact");
            const widFactory = requireMod("WAWebWidFactory");
            const toWid = (val: any) => {
              if (!val) return null;
              if (typeof val === "object" && (val.user || val._serialized))
                return val;
              for (const wf of [widFactory, store?.WidFactory]) {
                for (const m of [
                  "createWid",
                  "createWidFromWidLike",
                  "createWidFromWid",
                ]) {
                  try {
                    const w = wf?.[m]?.(val);
                    if (w) return w;
                  } catch {}
                }
              }
              return null;
            };
            const pnWidToDigits = (pnWid: any) => {
              if (!pnWid) return "";
              if (pnWid?.user) {
                const digits = onlyDigits(pnWid.user);
                if (digits) return digits;
              }
              if (typeof pnWid === "string") {
                const digits = onlyDigits(pnWid.split("@")[0]);
                if (digits) return digits;
              }
              if (pnWid?._serialized) {
                const pnc = getContact(pnWid._serialized);
                if (pnc?.id?.server === "c.us" && pnc.id.user)
                  return onlyDigits(pnc.id.user);
              }
              return "";
            };
            // Search may touch many contacts, so only the fast local lookups
            // run here — no per-contact server query (enforceLidAndPnRetrieval).
            const lidToPhone = (wid: any) => {
              try {
                const d = pnWidToDigits(apiContact?.getPhoneNumber?.(wid));
                if (d) return d;
              } catch {}
              try {
                return pnWidToDigits(store?.LidUtils?.getPhoneNumber?.(wid));
              } catch {}
              return "";
            };
            const phoneFromContact = (jid: string, contact: any) => {
              const phoneNumber = contact?.phoneNumber;
              if (phoneNumber) {
                if (typeof phoneNumber === "object" && phoneNumber.user) {
                  const digits = onlyDigits(phoneNumber.user);
                  if (digits) return digits;
                }
                if (typeof phoneNumber === "string") {
                  const digits = onlyDigits(phoneNumber.split("@")[0]);
                  if (digits) return digits;
                }
              }
              if (contact?.id?.server === "c.us" && contact.id.user) {
                const digits = onlyDigits(contact.id.user);
                if (digits) return digits;
              }
              if (String(jid).includes("@c.us")) {
                const digits = onlyDigits(String(jid).split("@")[0]);
                if (digits) return digits;
              }
              // Lid resolution is the expensive part — try it last so cheap
              // c.us paths win first.
              for (const cand of [contact?.id, toWid(jid)]) {
                const d = cand && lidToPhone(cand);
                if (d) return d;
              }
              return "";
            };

            // 1) Existing chats (so matches keep their last-message preview).
            // Each model is guarded individually — a single chat with a throwing
            // getter must not abort the whole search.
            const chatModels = Array.isArray(store?.Chat?.models)
              ? store.Chat.models
              : [];
            for (const c of chatModels) {
              if (out.length >= max) break;
              try {
                if (!c?.id?._serialized) continue;
                if (c.id.server === "status" || c.id.server === "broadcast")
                  continue;
                const contact = getContact(c.id._serialized);
                const savedName =
                  typeof contact?.name === "string" && contact.name.trim()
                    ? contact.name.trim()
                    : "";
                // Cheap text match first (no lid resolution). Resolve the phone
                // number only when it's actually needed — for display on a
                // match, or to test a digit query that didn't match by name.
                const cheapMatch = textMatches(
                  savedName,
                  c.formattedTitle,
                  c.name,
                  contact?.pushname,
                  contact?.formattedName,
                  c.id?.user,
                );
                let phone = "";
                let matched = cheapMatch;
                if (cheapMatch || qDigits) {
                  phone = phoneFromContact(c.id._serialized, contact);
                  if (!matched && qDigits && onlyDigits(phone).includes(qDigits))
                    matched = true;
                }
                if (!matched) continue;
                let lm: any = null;
                try {
                  lm = c.lastMessage ?? c.msgs?.last ?? null;
                } catch {
                  lm = null;
                }
                out.push({
                  id: c.id._serialized,
                  name:
                    savedName ||
                    c.formattedTitle ||
                    c.name ||
                    (c.id?.server === "c.us" ? c.id?.user : "") ||
                    "",
                  idUser: c.id?.user || "",
                  phoneNumber:
                    phone ||
                    (c.id?.server === "c.us" ? c.id?.user : null) ||
                    null,
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
                });
                seen.add(c.id._serialized);
              } catch {
                // Skip this chat and keep searching.
              }
            }

            // 2) Contacts without an existing chat (startable results).
            const contactModels = Array.isArray(store?.Contact?.models)
              ? store.Contact.models
              : [];
            for (const ct of contactModels) {
              if (out.length >= max) break;
              try {
                if (!ct?.id?._serialized) continue;
                if (ct.isMe) continue;
                // Cheap text match first; resolve the phone lazily (see above).
                const cheapMatch = textMatches(
                  ct.name,
                  ct.pushname,
                  ct.formattedName,
                  ct.id?.user,
                );
                let phone = "";
                let matched = cheapMatch;
                if (cheapMatch || qDigits) {
                  phone = phoneFromContact(ct.id._serialized, ct);
                  if (!matched && qDigits && onlyDigits(phone).includes(qDigits))
                    matched = true;
                }
                if (!matched) continue;
                const resultId =
                  ct.id.server === "c.us"
                    ? ct.id._serialized
                    : phone
                      ? `${phone}@c.us`
                      : ct.id._serialized;
                // A lid contact whose phone isn't cached locally (search skips
                // the server lookup) still matched by name — surface it under
                // its lid id, which is a valid openable chat id, instead of
                // dropping it. Only skip rows with no usable identifier at all.
                if (!resultId) continue;
                if (seen.has(ct.id._serialized) || seen.has(resultId))
                  continue;
                // idUser is only a real phone number for c.us contacts; for a
                // lid it's the (non-dialable) lid id, so don't fall back to it.
                const realNumber =
                  phone || (ct.id.server === "c.us" ? ct.id?.user : "") || "";
                // Prefer any human label (saved name, push name, formatted
                // name); fall back to the number only when no label exists.
                const label = [ct.name, ct.pushname, ct.formattedName]
                  .map((v: any) => (typeof v === "string" ? v.trim() : ""))
                  .find((v: string) => v);
                const name = label || realNumber || "";
                out.push({
                  id: resultId,
                  name,
                  idUser: ct.id?.user || "",
                  phoneNumber: realNumber || null,
                  timestamp: null,
                  unreadCount: 0,
                  isGroup: false,
                  isMuted: false,
                  isPinned: false,
                  lastMessageBody: null,
                  lastMessageHasMedia: false,
                  lastMessageType: null,
                });
                seen.add(ct.id._serialized);
                seen.add(resultId);
              } catch {
                // Skip this contact and keep searching.
              }
            }

            return out.slice(0, max);
            /* eslint-enable @typescript-eslint/no-explicit-any */
          },
          query,
          limit,
        ) as Promise<RawHit[] | null>,
        Number.isFinite(chatFetchTimeoutMs) ? chatFetchTimeoutMs : 180000,
        "WhatsApp chat/contact search",
      )) as RawHit[] | null;

      if (!Array.isArray(raw)) return [];

      return raw.map((r) => {
        const isLid = r.id.endsWith("@lid");
        const phoneNumber = getPhoneNumberFromChatId(
          r.phoneNumber || (!isLid ? r.idUser : null) || r.id,
        );
        return {
          id: r.id,
          name: getDisplayNameFromCandidates(
            [r.name, !isLid ? r.idUser : null],
            phoneNumber,
          ),
          phoneNumber,
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
        };
      });
    } catch (e) {
      LOG("searchChatsAndContacts failed:", String(e));
      return [];
    }
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

      const searchTerm = search.trim().toLowerCase();
      if (searchTerm) {
        const limit = Math.max(pageSize * page, 50);

        // The in-page contact search (searchChatsAndContacts) depends on
        // volatile WhatsApp Web internals and can silently return nothing.
        // Always also filter the already-loaded chat cache — which is populated
        // by the reliable refreshChats fast path and resolves saved names and
        // +country phone numbers — so searching existing conversations works
        // regardless of whether the live store search succeeds. Warm the cache
        // first if it's cold so a search right after login still finds chats.
        if (this.chatsCache.length <= 1) {
          const refresh = this.refreshChats(client).catch((e) => {
            LOG("getPaginatedChats: search cold refresh failed:", String(e));
            return this.chatsCache;
          });
          await Promise.race([
            refresh,
            new Promise((resolve) => setTimeout(resolve, coldChatWaitMs)),
          ]);
        }

        const cachedMatches = this.filterAndSortChats(
          this.chatsCache,
          searchTerm,
          1,
          limit,
        );

        // Search the full WhatsApp store too (every loaded chat + contact), so a
        // contact that hasn't been loaded into the sidebar still matches.
        let liveMatches: WhatsAppChatSummary[] = [];
        try {
          liveMatches = await this.searchChatsAndContacts(
            client,
            searchTerm,
            limit,
          );
        } catch (e) {
          LOG(
            "getPaginatedChats: live search failed, using cache only:",
            String(e),
          );
        }

        // Merge, de-duplicating by id and by phone number (the same person can
        // surface under both a @lid and a @c.us id). Cached chats come first so
        // existing conversations keep their last-message preview and ranking.
        const merged: WhatsAppChatSummary[] = [];
        const seenIds = new Set<string>();
        const seenPhones = new Set<string>();
        for (const chat of [...cachedMatches, ...liveMatches]) {
          if (!chat?.id || seenIds.has(chat.id)) continue;
          const phoneDigits = digitsOnly(chat.phoneNumber);
          if (phoneDigits && seenPhones.has(phoneDigits)) continue;
          seenIds.add(chat.id);
          if (phoneDigits) seenPhones.add(phoneDigits);
          merged.push(chat);
        }

        const start = (page - 1) * pageSize;
        return merged.slice(start, start + pageSize);
      }

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

  // Fetch messages for a chat by reading the internal WAWebCollections Chat
  // model directly (chat.msgs.getModelsArray()), bypassing wwebjs's
  // getChatById()/fetchMessages() which fail with a minified `r` error on
  // current WA Web builds (their internal Store helpers are renamed/gone).
  // Returns serialized raw message objects (msg.serialize()); the caller adapts
  // them into the shape mapMessage() expects. Best-effort loads earlier history
  // via WAWebChatLoadMessages when that module is present, ignoring failures.
  private async fetchMessagesRaw(
    client: WhatsAppClient,
    chatId: string,
    limit: number,
  ): Promise<MessageRawData[]> {
    const pupPage = (client as unknown as { pupPage?: unknown }).pupPage as
      | {
          evaluate(
            fn: (...a: unknown[]) => unknown,
            ...args: unknown[]
          ): Promise<unknown>;
        }
      | undefined;
    if (!pupPage?.evaluate) return [];
    const raw = (await withTimeout(
      pupPage.evaluate(
        async (cid: unknown, lim: unknown) => {
          /* eslint-disable @typescript-eslint/no-explicit-any */
          try {
            const w = window as any;
            const coll = w.require("WAWebCollections");
            if (!coll?.Chat) return null;
            let wid: any = cid;
            try {
              wid = w.require("WAWebWidFactory").createWid(cid as string);
            } catch {
              wid = cid;
            }
            const chat = coll.Chat.get(wid) || coll.Chat.get(cid as string);
            if (!chat) return null;
            const limitNum = (lim as number) || 80;

            // Best-effort: pull older history until we have enough (or the
            // loader module is unavailable / throws — then just use what's
            // already in the local msgs collection).
            try {
              const loader = w.require("WAWebChatLoadMessages");
              let guard = 0;
              while (
                (chat.msgs?.getModelsArray?.().length ?? 0) < limitNum &&
                guard < 10
              ) {
                guard++;
                const loaded = await loader.loadEarlierMsgs({ chat });
                if (!loaded || !loaded.length) break;
              }
            } catch {
              /* loader unavailable — use whatever is cached */
            }

            const msgs: any[] = chat.msgs?.getModelsArray?.() ?? [];
            return msgs
              .filter((m: any) => m && !m.isNotification)
              .slice(-limitNum)
              .map((m: any) => {
                try {
                  return m.serialize ? m.serialize() : null;
                } catch {
                  return null;
                }
              })
              .filter((m: any) => m !== null);
          } catch {
            return null;
          }
          /* eslint-enable @typescript-eslint/no-explicit-any */
        },
        chatId,
        limit,
      ) as Promise<MessageRawData[] | null>,
      Number.isFinite(chatFetchTimeoutMs) ? chatFetchTimeoutMs : 180000,
      "WhatsApp message fetch",
    )) as MessageRawData[] | null;
    return Array.isArray(raw) ? raw : [];
  }

  private async refreshChats(
    client: WhatsAppClient,
    options: { allowSlowFallback?: boolean } = {},
  ) {
    const { allowSlowFallback = false } = options;
    if (!client) {
      LOG("refreshChats: client is undefined or not ready");
      throw new Error("WhatsApp is reconnecting, please wait a moment.");
    }
    if (this.chatsRefreshPromise) {
      return this.chatsRefreshPromise;
    }

    // When the list is currently empty we want to push a one-time SSE signal as
    // soon as it populates, so the frontend can fetch once instead of polling.
    const cacheWasEmpty = this.chatsCache.length <= 1;
    const notifyIfNowPopulated = (chats: WhatsAppChatSummary[]) => {
      if (cacheWasEmpty && chats.length > 1) {
        publishWhatsAppEvent("chats-updated");
      }
    };

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
            phoneNumber: string | null;
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
                const w = window as any;
                // On current WA Web builds wwebjs no longer exposes
                // window.Store; the Chat/Contact collections live in the
                // internal 'WAWebCollections' module, reachable through
                // wwebjs's window.require shim. Prefer that, fall back to the
                // legacy window.Store for older builds.
                let coll: any = null;
                try {
                  coll = w.require ? w.require("WAWebCollections") : null;
                } catch {
                  coll = null;
                }
                const chatColl = coll?.Chat ?? w.Store?.Chat ?? null;
                const contactColl = coll?.Contact ?? w.Store?.Contact ?? null;
                const models: any[] =
                  chatColl?.getModelsArray?.() ??
                  (Array.isArray(chatColl?.models) ? chatColl.models : null);
                if (!Array.isArray(models)) return null;

                const store = { Contact: contactColl };

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
                      const contact = store?.Contact?.get?.(c.id._serialized);
                      // contact.name is the address-book name set by WhatsApp
                      // from your phone's contacts — only populated for saved
                      // contacts, so checking isMyContact/isAddressBookContact
                      // is redundant and unreliable across WA Web versions.
                      const savedName =
                        typeof contact?.name === "string" && contact.name.trim()
                          ? contact.name.trim()
                          : "";
                      return {
                        id: c.id._serialized,
                        name:
                          savedName ||
                          c.formattedTitle ||
                          c.name ||
                          (c.id?.server === "c.us" ? c.id?.user : "") ||
                          "",
                        idUser: c.id?.user || "",
                        phoneNumber:
                          c.id?.server === "c.us" ? c.id?.user || null : null,
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
            const mappedChats: WhatsAppChatSummary[] = raw.map((r) => {
              const isLid = r.id.endsWith("@lid");
              const phoneNumber = getPhoneNumberFromChatId(
                r.phoneNumber || (!isLid ? r.idUser : null) || r.id,
              );
              return {
                id: r.id,
                name: getDisplayNameFromCandidates(
                  [r.name, !isLid ? r.idUser : null],
                  phoneNumber,
                ),
                phoneNumber,
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
              };
            });
            const resolvedChats = await this.resolveChatIdentities(
              client,
              mappedChats,
            );

            this.chatsCache = resolvedChats;
            this.chatsCacheAt = Date.now();
            this.persistCachesDebounced();
            notifyIfNowPopulated(resolvedChats);
            return resolvedChats;
          }

          if (cacheWasEmpty && !allowSlowFallback) {
            // Request path (must stay under the frontend proxy timeout): don't
            // block on the slow getChats() read. The background pre-warm calls
            // this with allowSlowFallback=true and will fetch them shortly.
            LOG(
              "refreshChats: cold fast path is empty; skipping slow getChats fallback",
            );
            return this.chatsCache;
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
      const mappedChats = await this.resolveChatIdentities(
        client,
        filteredChats.map((chat) => mapChat(chat)),
      );

      this.chatsCache = mappedChats;
      this.chatsCacheAt = Date.now();
      this.persistCachesDebounced();
      notifyIfNowPopulated(mappedChats);
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

  /**
   * Resolves a display label for a set of group participant ids. Returns a map
   * of id -> label, where the label is the saved contact name if the sender is
   * in the address book, otherwise their phone number. Handles WhatsApp's newer
   * "@lid" participant ids by mapping them back to the real phone number, so the
   * UI never shows a raw JID or an opaque LID. Cached for 10 minutes per id.
   */
  private async resolveGroupSenderLabels(
    client: WhatsAppClient,
    jids: string[],
  ): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    const now = Date.now();
    const ttl = 10 * 60 * 1000;

    const missing: string[] = [];
    for (const jid of jids) {
      const cached = this.contactNameCache.get(jid);
      if (cached && now - cached.at <= ttl) {
        if (cached.name) result[jid] = cached.name;
      } else {
        missing.push(jid);
      }
    }
    if (missing.length === 0) return result;

    const prefetchedPhones: Record<string, string> = {};
    for (const jid of missing) {
      const directPhone = getPhoneNumberFromChatId(jid);
      if (directPhone) {
        prefetchedPhones[jid] = digitsOnly(directPhone);
      }
    }

    const lidIds = missing.filter((jid) => jid.endsWith("@lid"));
    if (lidIds.length > 0) {
      try {
        const pairs = await withTimeout(
          client.getContactLidAndPhone(lidIds),
          20000,
          "getContactLidAndPhone(group)",
        );
        pairs.forEach((pair, index) => {
          const jid = lidIds[index];
          const phone = getPhoneNumberFromChatId(pair?.pn);
          if (jid && phone) {
            prefetchedPhones[jid] = digitsOnly(phone);
          }
        });
      } catch (error) {
        LOG("group getContactLidAndPhone failed:", String(error));
      }
    }

    const pupPage = (client as unknown as { pupPage?: unknown }).pupPage as
      | {
          evaluate(
            fn: (...a: unknown[]) => unknown,
            ...args: unknown[]
          ): Promise<unknown>;
        }
      | undefined;
    if (!pupPage?.evaluate) {
      for (const jid of missing) {
        const phone = prefetchedPhones[jid];
        if (phone) {
          result[jid] = phone;
          this.contactNameCache.set(jid, { name: phone, at: now });
        }
      }
      return result;
    }

    try {
      const resolved = (await withTimeout(
        pupPage.evaluate(async (ids: unknown, phoneMap: unknown) => {
          /* eslint-disable @typescript-eslint/no-explicit-any */
          const store = (window as any).Store;
          const out: Record<string, string | null> = {};
          const prefetched = phoneMap as Record<string, string>;
          const onlyDigits = (s: any) =>
            typeof s === "string" ? s.replace(/[^0-9]/g, "") : "";

          // lid↔phone lives in the 'WAWebApiContact' internal module on this
          // build, reachable via wwebjs's window.require shim — not in
          // Store.LidUtils.
          const requireMod = (name: string) => {
            try {
              return (window as any).require?.(name) ?? null;
            } catch {
              return null;
            }
          };
          const apiContact = requireMod("WAWebApiContact");
          const widFactory = requireMod("WAWebWidFactory");

          const getContact = (jid: string) => {
            try {
              const c = store?.Contact?.get?.(jid);
              if (c) return c;
            } catch {}
            try {
              return (
                store?.Contact?.models?.find(
                  (m: any) => m?.id?._serialized === jid,
                ) ?? null
              );
            } catch {
              return null;
            }
          };

          // Build a real Wid from a jid string (or pass through an existing
          // Wid). getPhoneNumber needs a Wid object, not a raw "<num>@lid"
          // string, so unsaved lid senders fail without this.
          const toWid = (val: any) => {
            if (!val) return null;
            if (typeof val === "object" && (val.user || val._serialized))
              return val;
            for (const wf of [widFactory, store?.WidFactory]) {
              for (const m of [
                "createWid",
                "createWidFromWidLike",
                "createWidFromWid",
              ]) {
                try {
                  const w = wf?.[m]?.(val);
                  if (w) return w;
                } catch {}
              }
            }
            return null;
          };

          const pnWidToDigits = (pnWid: any) => {
            if (!pnWid) return "";
            if (pnWid?.user) return onlyDigits(pnWid.user);
            if (typeof pnWid === "string") {
              const d = onlyDigits(pnWid.split("@")[0]);
              if (d) return d;
            }
            if (pnWid?._serialized) {
              const pnc = getContact(pnWid._serialized);
              if (pnc?.id?.server === "c.us" && pnc.id.user)
                return onlyDigits(pnc.id.user);
            }
            return "";
          };

          const lidToPhone = (wid: any) => {
            try {
              const d = pnWidToDigits(apiContact?.getPhoneNumber?.(wid));
              if (d) return d;
            } catch {}
            try {
              return pnWidToDigits(store?.LidUtils?.getPhoneNumber?.(wid));
            } catch {}
            return "";
          };

          // Map an @lid id back to its phone number using whatever the current
          // WhatsApp Web build exposes.
          const phoneFromLid = (jid: string, c: any) => {
            const pn = c?.phoneNumber;
            if (pn) {
              if (typeof pn === "object" && pn.user) return onlyDigits(pn.user);
              if (typeof pn === "string") {
                const d = onlyDigits(pn.split("@")[0]);
                if (d) return d;
              }
            }
            for (const cand of [c?.id, toWid(jid)]) {
              const d = cand && lidToPhone(cand);
              if (d) return d;
            }
            // The resolved contact's own id may already be a phone number.
            if (c?.id?.server === "c.us" && c.id.user)
              return onlyDigits(c.id.user);
            return "";
          };

          const enforcePhone = async (jid: string) => {
            try {
              const res = await (window as any).WWebJS?.enforceLidAndPnRetrieval?.(
                jid,
              );
              return pnWidToDigits(res?.phone);
            } catch {
              return "";
            }
          };

          for (const jid of ids as string[]) {
            try {
              const c = getContact(jid);
              const savedName =
                typeof c?.name === "string" && c.name.trim()
                  ? c.name.trim()
                  : null;

              let phone =
                prefetched[jid] ||
                (jid.indexOf("@c.us") !== -1
                  ? onlyDigits(jid.split("@")[0])
                  : phoneFromLid(jid, c));
              if (!savedName && !phone && jid.includes("@lid")) {
                phone = await enforcePhone(jid);
              }

              out[jid] = savedName || (phone ? phone : null);
            } catch {
              out[jid] = null;
            }
          }
          return out;
          /* eslint-enable @typescript-eslint/no-explicit-any */
        }, missing, prefetchedPhones) as Promise<Record<string, string | null>>,
        15000,
        "resolveGroupSenderLabels",
      )) as Record<string, string | null>;

      for (const jid of missing) {
        const label = resolved?.[jid] ?? prefetchedPhones[jid] ?? null;
        if (label) {
          this.contactNameCache.set(jid, { name: label, at: now });
          result[jid] = label;
        }
      }
    } catch (e) {
      LOG("resolveGroupSenderLabels failed:", String(e));
      for (const jid of missing) {
        const phone = prefetchedPhones[jid];
        if (phone) {
          this.contactNameCache.set(jid, { name: phone, at: now });
          result[jid] = phone;
        }
      }
    }

    return result;
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

    const isGroup = chatId.endsWith("@g.us");

    const fetchPromise = this.withOperationSlot(async () => {
      // Read messages via WAWebCollections directly; wwebjs's
      // getChatById()/fetchMessages() throw a minified `r` on current WA builds.
      const rawMessages = await this.fetchMessagesRaw(client, chatId, limit);
      const messages = rawMessages.map(rawToMessageLike);
      const directChatIdentity = isGroup
        ? null
        : (
            await this.resolveChatIdentities(client, [
              this.chatsCache.find((c) => c.id === chatId) ?? {
                id: chatId,
                name:
                  getPhoneNumberFromChatId(chatId) ||
                  (chatId.endsWith("@lid") ? "" : getChatAvatarSeed(chatId)),
                phoneNumber: getPhoneNumberFromChatId(chatId),
                lastMessage: "",
                timestamp: null,
                avatarSeed: chatId,
                avatarUrl: null,
                isGroup: false,
                isMuted: false,
                isPinned: false,
                unreadCount: 0,
              },
            ])
          )[0] ?? null;

      // For group chats, label each sender with their saved contact name, or
      // their phone number if not saved — never the raw JID / LID.
      let labelMap: Record<string, string> = {};
      // phone digits -> saved contact name, sourced from the chat cache which
      // already resolves saved names for direct chats. Used as a fallback so a
      // group sender who is a saved contact (but whose name the per-participant
      // lookup missed, e.g. an @lid sender) still shows their name.
      const savedNameByPhone = new Map<string, string>();
      if (isGroup) {
        const authorJids = Array.from(
          new Set(
            messages
              .map((m) => (m as Message & { author?: string }).author)
              .filter((a): a is string => Boolean(a)),
          ),
        );
        labelMap = await this.resolveGroupSenderLabels(client, authorJids);

        for (const cached of this.chatsCache) {
          if (cached.isGroup) continue;
          const digits = digitsOnly(cached.phoneNumber);
          if (!digits || !cached.name) continue;
          if (isPhoneLikeLabel(cached.name, cached.phoneNumber)) continue;
          savedNameByPhone.set(digits, cached.name);
        }
      }

      return messages
        .map((m) => {
          const mapped = mapMessage(m);
          if (isGroup) {
            const authorJid = (m as Message & { author?: string }).author;
            if (authorJid) {
              const resolved =
                labelMap[authorJid] || getPhoneNumberFromChatId(authorJid);
              // resolveGroupSenderLabels returns a saved name when it has one,
              // otherwise a bare phone number. If we only got a number, try the
              // cache (saved name by phone) before falling back to showing the
              // number with its country code (+...).
              if (resolved && isPhoneLikeLabel(resolved, null)) {
                const digits = digitsOnly(resolved);
                const cachedName = digits
                  ? savedNameByPhone.get(digits)
                  : undefined;
                mapped.author =
                  cachedName || formatPhoneNumberForDisplay(resolved);
              } else {
                mapped.author = resolved || null;
              }
            }
          } else if (!mapped.fromMe) {
            mapped.author =
              directChatIdentity?.phoneNumber ||
              directChatIdentity?.name ||
              getPhoneNumberFromChatId(mapped.chatId) ||
              null;
          }
          return mapped;
        })
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
    quotedMessageId?: string,
  ) {
    LOG("API: sendMessage", {
      chatId,
      hasMedia: Boolean(media),
      bodyLength: String(body ?? "").length,
      hasQuote: Boolean(quotedMessageId),
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
          this.sendMediaWithFallbacks(
            client,
            chatId,
            media,
            content,
            quotedMessageId,
          ),
        );
      } else {
        message = await this.withOperationSlot(() =>
          client.sendMessage(
            chatId,
            content,
            quotedMessageId ? { quotedMessageId } : undefined,
          ),
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

      const editedMessage = await this.withOperationSlot(() =>
        message.edit(content),
      );

      if (!editedMessage) {
        throw new Error("This message type cannot be edited in WhatsApp.");
      }

      const mapped = mapMessage(editedMessage);

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
      const pupPage = (client as unknown as { pupPage?: unknown }).pupPage as
        | {
            evaluate(
              fn: (...args: unknown[]) => unknown,
              ...args: unknown[]
            ): Promise<unknown>;
          }
        | undefined;
      if (!pupPage?.evaluate) {
        throw new Error("WhatsApp media page is unavailable.");
      }

      // Current WA Web may keep fetched history only in chat.msgs, not in the
      // global Msg collection. whatsapp-web.js falls back to getMessagesById(),
      // which currently throws a minified `r` error. Search both collections
      // and then use the same decrypt pipeline as Message.downloadMedia().
      const media = (await this.withOperationSlot(() =>
        withTimeout(
          pupPage.evaluate(async (id: unknown) => {
            /* eslint-disable @typescript-eslint/no-explicit-any */
            const w = window as any;
            const collections = w.require("WAWebCollections");
            let message = collections?.Msg?.get?.(id as string) ?? null;

            if (!message) {
              const chats: any[] =
                collections?.Chat?.getModelsArray?.() ??
                collections?.Chat?.models ??
                [];
              for (const chat of chats) {
                const messages: any[] =
                  chat?.msgs?.getModelsArray?.() ?? chat?.msgs?.models ?? [];
                for (const item of messages) {
                  const key = item?.id;
                  if (!key) continue;

                  let matches =
                    String(key) === id || key?._serialized === id;
                  if (!matches) {
                    const remote =
                      typeof key.remote === "string"
                        ? key.remote
                        : key.remote?._serialized ||
                          (key.remote?.user && key.remote?.server
                            ? `${key.remote.user}@${key.remote.server}`
                            : "");
                    // msg.serialize() drops MsgKey's prototype. Rebuild the
                    // stable key used by our API. Group MsgKey.toString()
                    // includes participant metadata and cannot be compared
                    // directly with that API key.
                    const stableKey =
                      remote && key.id
                        ? `${Boolean(key.fromMe)}_${remote}_${key.id}`
                        : "";
                    matches =
                      stableKey === id ||
                      Boolean(
                        stableKey &&
                          (key.self || key.$1) &&
                          `${stableKey}_${key.self || key.$1}` === id,
                      );
                  }

                  if (matches) {
                    message = item;
                    break;
                  }
                }
                if (message) break;
              }
            }

            if (!message?.directPath || !message?.mediaData) {
              return null;
            }
            if (message.mediaData.mediaStage === "REUPLOADING") {
              return null;
            }
            if (message.mediaData.mediaStage !== "RESOLVED") {
              await message.downloadMedia({
                downloadEvenIfExpensive: true,
                rmrReason: 1,
              });
            }
            if (
              String(message.mediaData.mediaStage).includes("ERROR") ||
              message.mediaData.mediaStage === "FETCHING"
            ) {
              return null;
            }

            const mockQpl = {
              addAnnotations() {
                return this;
              },
              addPoint() {
                return this;
              },
            };
            const decrypted = await w
              .require("WAWebDownloadManager")
              .downloadManager.downloadAndMaybeDecrypt({
                directPath: message.directPath,
                encFilehash: message.encFilehash,
                filehash: message.filehash,
                mediaKey: message.mediaKey,
                mediaKeyTimestamp: message.mediaKeyTimestamp,
                type: message.type,
                signal: new AbortController().signal,
                downloadQpl: mockQpl,
              });
            const data = await w.WWebJS.arrayBufferToBase64Async(decrypted);
            return {
              data,
              mimetype: message.mimetype || "application/octet-stream",
              filename: message.filename || undefined,
              filesize: message.size || undefined,
            };
            /* eslint-enable @typescript-eslint/no-explicit-any */
          }, messageId),
          60000,
          "WhatsApp media download",
        ),
      )) as {
        data: string;
        mimetype: string;
        filename?: string;
        filesize?: number;
      } | null;

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
    this.clearReadyRecoveryTimer();
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
    this.clearReadyRecoveryTimer();

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
