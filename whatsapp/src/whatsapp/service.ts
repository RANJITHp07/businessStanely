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
const protocolTimeoutMs = Number(
  process.env.WHATSAPP_PROTOCOL_TIMEOUT_MS ?? 180000,
);
const chatFetchTimeoutMs = Number(
  process.env.WHATSAPP_CHAT_FETCH_TIMEOUT_MS ?? 60000,
);
const chatCacheTtlMs = Number(process.env.WHATSAPP_CHAT_CACHE_TTL_MS ?? 12000);
// Lower default chat fetch limit for performance
const chatFetchLimit = Number(process.env.WHATSAPP_CHAT_FETCH_LIMIT ?? 50);
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
    author: internalData._data?.notifyName || message.author || null,
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

  return {
    id: chat.id._serialized,
    name: chat.name || chat.id.user || "Unknown contact",
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

class WhatsAppService {
  private client: WhatsAppClient | null = null;
  private initializingPromise: Promise<void> | null = null;
  private state: WhatsAppState = createDefaultState();
  private chatsCache: WhatsAppChatSummary[] = [];
  private chatsCacheAt = 0;
  private chatsRefreshPromise: Promise<WhatsAppChatSummary[]> | null = null;

  getState() {
    return this.state;
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
        authTimeoutMs: 60000,
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
            "--window-size=1280,800",
          ],
        },
        webVersionCache: {
          type: "local",
        },
      });

      client.on("qr", (qr: string) => {
        LOG("event: qr received");
        this.setState({ status: "qr", qr, error: null });
      });

      client.on("authenticated", () => {
        LOG("event: authenticated");
        this.setState({ status: "authenticated", error: null });
      });

      client.on("ready", () => {
        LOG("event: ready");
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

        // Delay the initial chat fetch by 4 s so WhatsApp Web has time to
        // fully sync its internal chat list after the session becomes ready.
        setTimeout(() => {
          publishWhatsAppEvent("chats-updated");
        }, 4000);
      });

      client.on("auth_failure", (message: string) => {
        LOG("event: auth_failure", message);

        // The saved session is invalid (device delinked, session expired, etc.).
        // Clear it from disk so the next initialization generates a fresh QR
        // instead of looping on auth_failure forever.
        const sessionPath = path.join(SESSION_DIR, "session-admin-whatsapp");
        try {
          if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            LOG("auth_failure: cleared stale session directory");
          }
        } catch (e) {
          LOG("auth_failure: failed to clear session directory", String(e));
        }

        // Null the client so ensureInitialized() creates a fresh one (new QR).
        this.client = null;
        this.initializingPromise = null;

        this.setState({
          status: "error",
          error:
            message ||
            "WhatsApp session expired. Please rescan the QR code to reconnect.",
        });
      });

      client.on("disconnected", (reason: string) => {
        LOG("event: disconnected", reason);
        this.client = null;
        this.setState({
          status: "disconnected",
          qr: null,
          error: reason || "WhatsApp client disconnected.",
          clientInfo: createDefaultState().clientInfo,
        });
        publishWhatsAppEvent("chats-updated");
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
          publishWhatsAppEvent("message", {
            chatId: mapped.chatId,
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
          publishWhatsAppEvent("message", {
            chatId: mapped.chatId,
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
    await this.ensureInitialized();
    const client = await this.requireReadyClient();
    // Use cached chats if available
    if (!this.chatsCache.length) {
      await this.refreshChats(client);
    }
    const normalizedSearch = search.trim().toLowerCase();
    return this.filterAndSortChats(
      this.chatsCache,
      normalizedSearch,
      page,
      pageSize,
    );
  }

  private async refreshChats(client: WhatsAppClient) {
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
        : 60000;

      // ── Fast path ────────────────────────────────────────────────────────
      // client.getChats() calls WWebJS.getChatModel() for EVERY chat inside
      // the Chromium page.  getChatModel() does async work (contact lookups,
      // profile-pic fetches, etc.) for each chat, so with 100+ chats it
      // floods Puppeteer's CDP queue and hangs for minutes.
      //
      // Instead, we execute ONE pupPage.evaluate() that reads the raw
      // WhatsApp Web in-memory store synchronously — no per-chat async ops.
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

          // IMPORTANT: the callback MUST be synchronous (no async/await).
          // If you pass an async function, Puppeteer sets awaitPromise:true on
          // the CDP Runtime.callFunctionOn call and waits for the Promise to
          // settle inside the browser — subject to the Puppeteer protocolTimeout,
          // not our own withTimeout wrapper. A synchronous callback returns
          // immediately and never triggers that timeout.
          const raw = (await withTimeout(
            pupPage.evaluate((lim: unknown) => {
              try {
                /* eslint-disable @typescript-eslint/no-explicit-any */
                const store = (window as any).Store;
                if (!store?.Chat) return null;

                // models must be a synchronously-accessible array.
                // If it's not, bail out — don't await getModelsArray() because
                // that would require an async callback (see comment above).
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
            return mappedChats;
          }

          LOG(
            "refreshChats: fast path returned empty/null, falling back to getChats()",
          );
        } catch (fastErr) {
          // If the WhatsApp Web page is navigating, getChats() will throw the
          // exact same error — skip the fallback and return stale cache instead.
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
      const attemptFetch = () =>
        withTimeout(client.getChats(), timeoutMs, "WhatsApp chat fetch");

      let chats;
      try {
        chats = await attemptFetch();
      } catch (firstError) {
        // Context-destroyed errors won't be fixed by a 5 s retry — the page
        // is mid-navigation. Return stale cache or surface a clean message.
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
        .filter((chat) => chat.id.server !== "status")
        .slice(0, limit);
      const mappedChats = filteredChats.map((chat) => mapChat(chat));

      this.chatsCache = mappedChats;
      this.chatsCacheAt = Date.now();
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
    try {
      const chat = await client.getChatById(chatId);
      const messages = await chat.fetchMessages({ limit });
      return messages
        .map(mapMessage)
        .sort((left, right) => left.timestamp - right.timestamp);
    } catch (error) {
      this.handleFatalBrowserError(error);
      throw error;
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
        message = await this.sendMediaWithFallbacks(
          client,
          chatId,
          media,
          content,
        );
      } else {
        message = await client.sendMessage(chatId, content);
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
      const message = await client.getMessageById(messageId);

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

      await message.edit(content);

      const updated = await client.getMessageById(messageId);
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
      const message = await client.getMessageById(messageId);

      if (!message) {
        throw new Error("Message not found.");
      }

      if (everyone && !message.fromMe) {
        throw new Error("Only sent messages can be deleted for everyone.");
      }

      const chatId = message.fromMe ? message.to : message.from;
      await message.delete(everyone);

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
      const message = await client.getMessageById(messageId);
      if (!message) {
        throw new Error("Message not found.");
      }
      if (!message.hasMedia) {
        throw new Error("Message has no media.");
      }
      const media = await message.downloadMedia();
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
    const sessionPath = path.join(SESSION_DIR, "session-admin-whatsapp");
    if (!this.client) {
      LOG("logout: no client, resetting state");
      // Clear chat cache and related state
      this.chatsCache = [];
      this.chatsCacheAt = 0;
      this.chatsRefreshPromise = null;
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
      throw e;
    }
  }
}

export const whatsappService = new WhatsAppService();
