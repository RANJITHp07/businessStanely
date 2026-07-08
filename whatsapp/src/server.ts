import "dotenv/config";
import crypto from "node:crypto";
import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";
import compression from "compression";
import QRCode from "qrcode";

import { whatsappService } from "./whatsapp/service.js";
import { subscribeWhatsAppEvent } from "./whatsapp/realtime.js";
import type { WhatsAppEventPayload } from "./whatsapp/types.js";

const PORT = Number(process.env.PORT ?? 4001);
const SERVICE_TOKEN =
  process.env.WHATSAPP_SERVICE_TOKEN?.trim() ||
  process.env.NEXT_PUBLIC_WHATSAPP_SERVICE_TOKEN?.trim() ||
  "";
const ALLOWED_ORIGINS = (process.env.WHATSAPP_ALLOWED_ORIGIN ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (!SERVICE_TOKEN) {
  console.error(
    "[WhatsApp Backend] Missing WHATSAPP_SERVICE_TOKEN (or NEXT_PUBLIC_WHATSAPP_SERVICE_TOKEN fallback). Refusing to start.",
  );
  process.exit(1);
}

let recoveryTimer: NodeJS.Timeout | null = null;
let qrDataUrlCache: { qr: string; dataUrl: string } | null = null;
let qrDataUrlInFlight: Promise<string | null> | null = null;

async function getQrCodeDataUrl(qr: string | null) {
  if (!qr) {
    qrDataUrlCache = null;
    qrDataUrlInFlight = null;
    return null;
  }

  if (qrDataUrlCache?.qr === qr) {
    return qrDataUrlCache.dataUrl;
  }

  if (qrDataUrlInFlight) {
    return qrDataUrlInFlight;
  }

  qrDataUrlInFlight = QRCode.toDataURL(qr, { margin: 1, width: 320 })
    .then((dataUrl) => {
      qrDataUrlCache = { qr, dataUrl };
      return dataUrl;
    })
    .catch((error) => {
      console.error("[WhatsApp Backend] Failed generating QR data URL:", error);
      return null;
    })
    .finally(() => {
      qrDataUrlInFlight = null;
    });

  return qrDataUrlInFlight;
}

async function getStatePayload() {
  const state = whatsappService.getState();
  const qrCodeDataUrl = await getQrCodeDataUrl(state.qr);
  return { ...state, qrCodeDataUrl };
}

function isRecoverableBrowserError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  return (
    normalized.includes("execution context was destroyed") ||
    normalized.includes("protocol error") ||
    normalized.includes("runtime.callfunctionon") ||
    normalized.includes("detached frame") ||
    normalized.includes("target closed") ||
    normalized.includes("browser has been closed")
  );
}

function scheduleClientRecovery(trigger: string) {
  if (recoveryTimer) {
    return;
  }

  console.warn(`[WhatsApp Backend] Scheduling client recovery (${trigger})`);

  recoveryTimer = setTimeout(() => {
    recoveryTimer = null;
    whatsappService.resetClient();
    whatsappService.ensureInitialized().catch((err: unknown) => {
      console.error("[WhatsApp Backend] Recovery initialization failed:", err);
    });
  }, 1500);
}

const app = express();

const corsOptions: cors.CorsOptions = {
  credentials: true,
  origin: (origin, callback) => {
    // Allow non-browser clients (no Origin header).
    if (!origin) {
      callback(null, true);
      return;
    }

    if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin not allowed by CORS"));
  },
};

// Gzip/brotli JSON responses (/chats, /messages can be large). The SSE stream
// must never be buffered/compressed — exclude text/event-stream so realtime
// events flush immediately. /media already sets its own headers and is mostly
// already-compressed binary, so we skip it too.
app.use(
  compression({
    filter: (req, res) => {
      if (req.path === "/stream") return false;
      const contentType = res.getHeader("Content-Type");
      if (
        typeof contentType === "string" &&
        contentType.includes("text/event-stream")
      ) {
        return false;
      }
      return compression.filter(req, res);
    },
  }),
);
app.use(cors(corsOptions));
app.use(express.json({ limit: "50mb" }));

// Simple request logger to show which APIs are hit and key params
app.use((req, _res, next) => {
  try {
    const time = new Date().toISOString();
    const ip = req.ip || (req.headers["x-forwarded-for"] as string) || "-";
    console.log(`[WhatsApp API] ${time} ${req.method} ${req.path} from ${ip}`);

    if (req.path === "/send") {
      const { chatId, body, media } = req.body ?? {};
      console.log(
        `[WhatsApp API] /send -> chatId=${String(chatId)} hasMedia=${Boolean(media)} bodyLength=${String(body ?? "").length}`,
      );
    }

    if (req.path === "/messages" && req.method === "GET") {
      const chatId = String(req.query?.chatId ?? "");
      console.log(`[WhatsApp API] /messages -> chatId=${chatId}`);
    }
  } catch (e) {
    // ignore logging errors
  }
  next();
});

function auth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const headerToken = req.headers["x-whatsapp-service-token"];
  const authHeader = req.headers["authorization"];
  const bearerToken =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : undefined;
  const token = headerToken ?? bearerToken ?? req.query["token"];
  if (token === SERVICE_TOKEN) {
    next();
    return;
  }
  res.status(401).json({ error: "Unauthorized" });
}

// Short-lived, HMAC-signed token used by the browser's EventSource to connect
// to /stream directly (Amplify/CloudFront can't proxy SSE). Format:
// "<expiryEpochMs>.<hmacSHA256(expiry, SERVICE_TOKEN)>". The frontend mints these
// server-side via its own /api/whatsapp/stream-token route, so the real
// SERVICE_TOKEN never reaches the browser — only a 60s read-only stream token.
function verifyStreamToken(value: unknown): boolean {
  if (typeof value !== "string" || !value.includes(".")) {
    return false;
  }
  const [payload, signature] = value.split(".");
  if (!payload || !signature) {
    return false;
  }
  const exp = Number(payload);
  if (!Number.isFinite(exp) || Date.now() > exp) {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", SERVICE_TOKEN)
    .update(payload)
    .digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

// Auth for the SSE stream: accept either the static service token (used by the
// same-origin Next proxy in local/non-Amplify setups) or a valid short-lived
// stream token in ?token= (used by the direct browser EventSource on Amplify).
function streamAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const headerToken = req.headers["x-whatsapp-service-token"];
  const authHeader = req.headers["authorization"];
  const bearerToken =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : undefined;
  const queryToken = req.query["token"];
  const staticToken = headerToken ?? bearerToken ?? queryToken;

  if (staticToken === SERVICE_TOKEN || verifyStreamToken(queryToken)) {
    next();
    return;
  }

  res.status(401).json({ error: "Unauthorized" });
}

function getRequestValue(req: express.Request, key: string) {
  const body =
    req.body && typeof req.body === "object"
      ? (req.body as Record<string, unknown>)
      : {};

  return body[key] ?? req.query[key];
}

function normalizeStringParam(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;

  if (typeof raw === "string") {
    return raw.trim();
  }

  if (typeof raw === "number" || typeof raw === "boolean") {
    return String(raw).trim();
  }

  return "";
}

function normalizeBooleanParam(value: unknown, fallback: boolean) {
  const raw = Array.isArray(value) ? value[0] : value;

  if (raw === undefined || raw === null || raw === "") {
    return fallback;
  }

  if (typeof raw === "boolean") {
    return raw;
  }

  if (typeof raw === "number") {
    return raw !== 0;
  }

  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (["false", "0", "no", "off"].includes(normalized)) {
      return false;
    }
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }
  }

  return fallback;
}

// --- Status ---
app.get("/status", auth, async (_req, res) => {
  whatsappService.ensureInitialized().catch((err: unknown) => {
    console.error("[WhatsApp Backend] ensureInitialized(/status) failed:", err);
  });
  const payload = await getStatePayload();
  res.json(payload);
});

// --- Chats ---
// Paginated chats endpoint
app.get("/chats", auth, async (req, res) => {
  const search = String(req.query.search ?? "");
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 50);
  try {
    const chats = await whatsappService.getPaginatedChats(
      search,
      page,
      pageSize,
    );
    res.json({ chats });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load chats.";
    console.log(error);
    res.status(503).json({ error: message });
  }
});

// --- Messages ---
app.get("/messages", auth, async (req, res) => {
  const chatId = String(req.query.chatId ?? "");
  if (!chatId) {
    res.status(400).json({ error: "chatId is required." });
    return;
  }
  try {
    const rawLimit = Number(req.query.limit ?? 80);
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 80;
    const messages = await whatsappService.listMessages(chatId, limit);
    res.json({ messages });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load messages.";
    res.status(500).json({ error: message });
  }
});

app.patch("/messages", auth, async (req, res) => {
  const messageId = normalizeStringParam(
    getRequestValue(req, "messageId") ?? getRequestValue(req, "id"),
  );
  const body = normalizeStringParam(
    getRequestValue(req, "body") ??
      getRequestValue(req, "message") ??
      getRequestValue(req, "text") ??
      getRequestValue(req, "content"),
  );

  if (!messageId || !body) {
    res.status(400).json({ error: "messageId and body are required." });
    return;
  }
  try {
    const message = await whatsappService.editMessage(messageId, body);
    res.json({ message });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to edit message.";
    res.status(422).json({ error: message });
  }
});

app.delete("/messages", auth, async (req, res) => {
  const messageId = normalizeStringParam(
    getRequestValue(req, "messageId") ?? getRequestValue(req, "id"),
  );
  const everyone = normalizeBooleanParam(getRequestValue(req, "everyone"), true);

  if (!messageId) {
    res.status(400).json({ error: "messageId is required." });
    return;
  }
  try {
    const result = await whatsappService.deleteMessage(messageId, everyone);
    res.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete message.";
    res.status(500).json({ error: message });
  }
});

// --- Send ---
app.post("/send", auth, async (req, res) => {
  const { chatId, body = "", media, quotedMessageId } = req.body ?? {};
  if (!chatId || (!body && !media)) {
    res.status(400).json({
      error: "chatId and at least one of body or media are required.",
    });
    return;
  }
  try {
    const message = await whatsappService.sendMessage(
      chatId,
      body,
      media,
      quotedMessageId,
    );
    res.json({ message });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send message.";
    res.status(500).json({ error: message });
  }
});

// --- Media ---
app.get("/media", auth, async (req, res) => {
  const messageId = String(req.query.messageId ?? "");
  if (!messageId) {
    res.status(400).json({ error: "messageId is required." });
    return;
  }
  try {
    const media = await whatsappService.getMedia(messageId);
    const buffer = Buffer.from(media.data, "base64");
    res.set({
      "Content-Type": media.mimetype,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "private, max-age=3600",
    });
    res.send(buffer);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch media.";
    res.status(500).json({ error: message });
  }
});

// --- Logout ---
app.post("/logout", auth, async (_req, res) => {
  await whatsappService.logout();
  res.json({ ok: true });
});

// --- Force clear session (destructive) ---
app.post("/force-clear-session", auth, async (_req, res) => {
  try {
    await whatsappService.forceClearSession();
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[WhatsApp Backend] forceClearSession failed:", message);
    res.status(500).json({ error: message });
  }
});

// --- Chat Avatar ---
app.get("/chat-avatar", auth, async (req, res) => {
  const chatId = String(req.query.chatId ?? "");
  if (!chatId) {
    res.status(400).json({ error: "chatId is required." });
    return;
  }
  try {
    const url = await whatsappService.getChatAvatarUrlById(chatId);
    res.json({ url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch avatar.";
    res.status(500).json({ error: message });
  }
});

// --- Chat Avatars (batch) ---
app.post("/chat-avatars", auth, async (req, res) => {
  const chatIds = Array.isArray(req.body?.chatIds)
    ? (req.body.chatIds as unknown[]).map(String).filter(Boolean).slice(0, 100)
    : [];
  if (chatIds.length === 0) {
    res.json({ urls: {} });
    return;
  }
  try {
    const urls = await whatsappService.getChatAvatarUrlsByIds(chatIds);
    res.json({ urls });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch avatars.";
    res.status(500).json({ error: message });
  }
});

// --- SSE Stream ---
app.get("/stream", streamAuth, async (req, res) => {
  whatsappService.ensureInitialized().catch((err: unknown) => {
    console.error("[WhatsApp Backend] ensureInitialized(/stream) failed:", err);
  });

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    // CORS is already handled by the express cors() middleware above.
    // Do NOT set Access-Control-Allow-Origin here: combining a wildcard with
    // credentials:true is rejected by browsers and would break SSE connections.
  });
  res.flushHeaders();

  let closed = false;

  const send = (event: string, data: unknown) => {
    if (closed || res.writableEnded || res.destroyed) {
      return;
    }

    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      closed = true;
    }
  };

  const initialPayload = await getStatePayload();
  send("state", initialPayload);

  const unsubState = subscribeWhatsAppEvent("state", () => {
    void (async () => {
      try {
        const payload = await getStatePayload();
        send("state", payload);
      } catch (error) {
        console.error(
          "[WhatsApp Backend] Failed to publish stream state:",
          error,
        );
      }
    })();
  });

  const unsubChats = subscribeWhatsAppEvent("chats-updated", () => {
    send("chats-updated", { at: Date.now() });
  });

  const unsubMessage = subscribeWhatsAppEvent(
    "message",
    (payload: WhatsAppEventPayload) => {
      send("message", payload);
    },
  );

  const unsubMessages = subscribeWhatsAppEvent(
    "messages-updated",
    (payload: WhatsAppEventPayload) => {
      send("messages-updated", payload);
    },
  );

  const ping = setInterval(() => {
    send("ping", { at: Date.now() });
  }, 25000);

  const cleanup = () => {
    if (closed) {
      return;
    }

    closed = true;
    clearInterval(ping);
    unsubState();
    unsubChats();
    unsubMessage();
    unsubMessages();
  };

  req.on("close", cleanup);
  req.on("error", cleanup);
  res.on("close", cleanup);
  res.on("error", cleanup);
});

const server = app.listen(PORT, () => {
  console.log(`[WhatsApp Backend] listening on http://localhost:${PORT}`);
  whatsappService.ensureInitialized().catch((err: unknown) => {
    console.error("[WhatsApp Backend] Failed to initialize service:", err);
  });
});

// EC2 / ALB keep-alive fix.
// AWS ALB default idle timeout is 60 s. Node.js default keepAliveTimeout is
// 5 s, so ALB reuses a connection that Node has already closed → 502 errors.
// keepAliveTimeout must be > ALB idle timeout; headersTimeout must be >
// keepAliveTimeout. Adjust WHATSAPP_KEEP_ALIVE_TIMEOUT_MS if your ALB timeout
// is customised (e.g. 3600 s for long-lived SSE sessions).
const keepAliveTimeoutMs = Number(
  process.env.WHATSAPP_KEEP_ALIVE_TIMEOUT_MS ?? 65000,
);
server.keepAliveTimeout = keepAliveTimeoutMs;
server.headersTimeout = keepAliveTimeoutMs + 1000;

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `[WhatsApp Backend] Port ${PORT} is already in use. Another instance is likely running. Exiting.`,
    );
    process.exit(0);
  } else {
    console.error("[WhatsApp Backend] Server error:", err);
    process.exit(1);
  }
});

process.on("unhandledRejection", (reason) => {
  if (isRecoverableBrowserError(reason)) {
    console.warn("[WhatsApp Backend] Recoverable unhandled rejection:", reason);
    scheduleClientRecovery("unhandledRejection");
    return;
  }

  console.error("[WhatsApp Backend] Unhandled rejection:", reason);
});

process.on("uncaughtException", (error) => {
  if (isRecoverableBrowserError(error)) {
    console.warn("[WhatsApp Backend] Recoverable uncaught exception:", error);
    scheduleClientRecovery("uncaughtException");
    return;
  }

  // Network / Puppeteer errors that occur during QR or auth phase should
  // trigger a client reset rather than crashing the entire server.
  const msg = error instanceof Error ? error.message : String(error ?? "");
  const norm = msg.toLowerCase();
  const isPuppeteerError =
    norm.includes("puppeteer") ||
    norm.includes("navigation timeout") ||
    norm.includes("page crashed") ||
    norm.includes("net::") ||
    norm.includes("auth timeout") ||
    norm.includes("ready timeout") ||
    norm.includes("fetch failed") ||
    norm.includes("context not found");

  if (isPuppeteerError) {
    console.warn(
      "[WhatsApp Backend] Puppeteer/navigation error, scheduling recovery:",
      msg,
    );
    scheduleClientRecovery("uncaughtException:puppeteer");
    return;
  }

  console.error("[WhatsApp Backend] Uncaught exception:", error);
  process.exit(1);
});

// --- Graceful shutdown ---
// Properly destroy the Chromium subprocess so it removes its own lockfiles
// (DevToolsActivePort, SingletonLock, etc.) before the process exits.
async function gracefulShutdown(signal: string) {
  console.log(`[WhatsApp Backend] ${signal} received, shutting down...`);
  if (recoveryTimer) {
    clearTimeout(recoveryTimer);
    recoveryTimer = null;
  }
  server.close();
  await whatsappService.shutdownClient();
  process.exit(0);
}

// Best-effort synchronous lockfile removal as a last resort (e.g. SIGKILL).
process.on("exit", () => {
  try {
    const sessionPath = path.join(
      process.env.WHATSAPP_SESSION_DIR ?? ".wwebjs_auth",
      "session-admin-whatsapp",
    );
    for (const name of [
      "DevToolsActivePort",
      "SingletonLock",
      "SingletonSocket",
    ]) {
      try {
        fs.unlinkSync(path.join(sessionPath, name));
      } catch {}
    }
  } catch {}
});

process.on("SIGINT", () => void gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
