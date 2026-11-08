import "dotenv/config";
import { mediaStorage } from "./media-store.js";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import compression from "compression";

import { cloudWhatsAppService as whatsappService } from "./service.js";
import { CloudApiError } from "./graph.js";
import { subscribeWhatsAppEvent } from "./realtime.js";
import type { WhatsAppEventPayload } from "./types.js";

// Same HTTP contract as the legacy `whatsapp/` service, so the admin panel's
// /api/whatsapp/* proxies work unchanged — point WHATSAPP_BACKEND_URL here.

const PORT = Number(process.env.PORT ?? 4002);
const SERVICE_TOKEN = process.env.WHATSAPP_SERVICE_TOKEN?.trim() || "";
const APP_SECRET = process.env.META_APP_SECRET?.trim() || "";
const VERIFY_TOKEN = process.env.WA_CLOUD_VERIFY_TOKEN?.trim() || "";
const ALLOWED_ORIGINS = (process.env.WHATSAPP_ALLOWED_ORIGIN ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const maxMediaBytes = Number(process.env.WHATSAPP_MAX_MEDIA_BYTES ?? 20 * 1024 * 1024);
// History-sync webhooks can be large, and /send carries base64 media.
const jsonBodyLimitBytes = Math.ceil(maxMediaBytes * 1.4 + 4 * 1024 * 1024);

if (!SERVICE_TOKEN) {
  console.error("[WhatsApp Cloud] Missing WHATSAPP_SERVICE_TOKEN. Refusing to start.");
  process.exit(1);
}
if (!APP_SECRET) {
  console.error("[WhatsApp Cloud] Missing META_APP_SECRET (needed to verify webhooks). Refusing to start.");
  process.exit(1);
}

type RawBodyRequest = express.Request & { rawBody?: Buffer };

const app = express();

app.use(
  compression({
    filter: (req, res) => req.path !== "/stream" && compression.filter(req, res),
  }),
);
app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS"));
    },
  }),
);
app.use(
  express.json({
    limit: jsonBodyLimitBytes,
    verify: (req, _res, buf) => {
      // Webhook signatures are computed over the exact bytes Meta sent.
      if ((req as RawBodyRequest).url?.startsWith("/webhook")) {
        (req as RawBodyRequest).rawBody = Buffer.from(buf);
      }
    },
  }),
);
app.use((req, _res, next) => {
  if (req.path !== "/webhook") {
    console.log(`[WhatsApp Cloud API] ${new Date().toISOString()} ${req.method} ${req.path}`);
  }
  next();
});

function tokenFrom(req: express.Request) {
  const headerToken = req.headers["x-whatsapp-service-token"];
  const authHeader = req.headers["authorization"];
  const bearerToken =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : undefined;
  return headerToken ?? bearerToken;
}

function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (tokenFrom(req) === SERVICE_TOKEN) {
    next();
    return;
  }
  res.status(401).json({ error: "Unauthorized" });
}

// Short-lived "<expiryMs>.<hmac>" token minted by the admin's
// /api/whatsapp/stream-token route for the browser EventSource.
function verifyStreamToken(value: unknown) {
  if (typeof value !== "string" || !value.includes(".")) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  const exp = Number(payload);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const expected = crypto.createHmac("sha256", SERVICE_TOKEN).update(payload).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function streamAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const queryToken = req.query["token"];
  if (tokenFrom(req) === SERVICE_TOKEN || queryToken === SERVICE_TOKEN || verifyStreamToken(queryToken)) {
    next();
    return;
  }
  res.status(401).json({ error: "Unauthorized" });
}

function sendError(res: express.Response, error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof CloudApiError ? error.status : 500;
  if (status >= 500) console.error("[WhatsApp Cloud]", message);
  res.status(status).json({ error: message || fallback });
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
}

function estimateBase64Bytes(value: string) {
  const data = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((data.length * 3) / 4) - padding);
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item ?? "")) : [];
}

// --- Health (public, no secrets) ---
// 200 while the process is up. The channel statuses show whether Meta 1:1 and
// the groups link are connected; they do not change the HTTP code.
app.get(["/", "/health"], (_req, res) => {
  const { status, channels } = whatsappService.getState();
  res.json({
    ok: true,
    service: "whatsapp-cloud",
    uptimeSeconds: Math.round(process.uptime()),
    status,
    meta: channels?.meta.status ?? null,
    groups: channels?.groups?.status ?? null,
  });
});

// --- Meta webhook ---
app.get("/webhook", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    VERIFY_TOKEN &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ) {
    res.status(200).send(String(req.query["hub.challenge"] ?? ""));
    return;
  }
  res.sendStatus(403);
});

app.post("/webhook", (req, res) => {
  const rawBody = (req as RawBodyRequest).rawBody;
  const signature = req.headers["x-hub-signature-256"];
  const expected = rawBody
    ? `sha256=${crypto.createHmac("sha256", APP_SECRET).update(rawBody).digest("hex")}`
    : "";
  const valid =
    typeof signature === "string" &&
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) {
    console.warn("[WhatsApp Cloud] Rejected webhook with a bad signature.");
    res.sendStatus(401);
    return;
  }
  // Acknowledge immediately; Meta retries anything slower than a few seconds.
  res.sendStatus(200);
  void whatsappService.handleWebhook(req.body);
});

// --- Groups bridge (whatsapp-groups service pushes group traffic here) ---
type GroupIngestEvent =
  | ({ kind: "message" } & Parameters<typeof whatsappService.ingestGroupMessage>[0])
  | ({ kind: "status" } & Parameters<typeof whatsappService.ingestGroupStatus>[0])
  | ({ kind: "media" } & Parameters<typeof whatsappService.ingestGroupMedia>[0])
  | { kind: "chats"; groups: Parameters<typeof whatsappService.ingestGroupChats>[0] };

let groupIngestQueue: Promise<unknown> = Promise.resolve();

app.post("/groups/ingest", auth, async (req, res) => {
  const events: GroupIngestEvent[] = Array.isArray(req.body?.events) ? req.body.events : [];
  // Serialised like webhooks, so a status never races its own message.
  const run = groupIngestQueue.then(async () => {
    for (const event of events) {
      switch (event?.kind) {
        case "message":
          await whatsappService.ingestGroupMessage(event);
          break;
        case "status":
          await whatsappService.ingestGroupStatus(event);
          break;
        case "media":
          await whatsappService.ingestGroupMedia(event);
          break;
        case "chats":
          await whatsappService.ingestGroupChats(Array.isArray(event.groups) ? event.groups : []);
          break;
        default:
          break;
      }
    }
    whatsappService.flushGroupHistory();
  });
  groupIngestQueue = run.catch(() => undefined);
  try {
    await run;
    res.json({ ok: true, count: events.length });
  } catch (error) {
    sendError(res, error, "Failed to store group events.");
  }
});

// --- Status ---
app.get("/status", auth, (_req, res) => {
  whatsappService.ensureInitialized().catch((error: unknown) => {
    console.error("[WhatsApp Cloud] ensureInitialized failed:", error);
  });
  res.json({ ...whatsappService.getState(), qrCodeDataUrl: null });
});

// --- Onboarding (Embedded Signup result from the admin panel) ---
app.post("/onboard", auth, async (req, res) => {
  const { code, phoneNumberId, wabaId } = req.body ?? {};
  // phoneNumberId / wabaId are optional: when Meta does not report them to the
  // browser, the service looks them up from the token.
  if (typeof code !== "string" || !code) {
    res.status(400).json({ error: "code is required." });
    return;
  }
  const optionalId = (value: unknown) => (typeof value === "string" && value ? value : undefined);
  try {
    res.json(
      await whatsappService.completeSignup({ code, phoneNumberId: optionalId(phoneNumberId), wabaId: optionalId(wabaId) }),
    );
  } catch (error) {
    sendError(res, error, "Failed to connect WhatsApp.");
  }
});

app.post("/sync-history", auth, async (_req, res) => {
  try {
    res.json({ sync: await whatsappService.requestHistorySync() });
  } catch (error) {
    sendError(res, error, "Failed to request history sync.");
  }
});

// --- Chats ---
app.get("/chats", auth, async (req, res) => {
  try {
    const chats = await whatsappService.getPaginatedChats(
      String(req.query.search ?? "").trim().slice(0, 200),
      boundedInteger(req.query.page, 1, 1, 1000),
      boundedInteger(req.query.pageSize, 50, 1, 100),
    );
    res.json({ chats });
  } catch (error) {
    sendError(res, error, "Failed to load chats.");
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
    const messages = await whatsappService.listMessages(chatId, boundedInteger(req.query.limit, 80, 1, 500));
    res.json({ messages });
  } catch (error) {
    sendError(res, error, "Failed to load messages.");
  }
});

app.patch("/messages", auth, async (req, res) => {
  try {
    await whatsappService.editMessage(String(req.body?.messageId ?? ""), String(req.body?.body ?? ""));
  } catch (error) {
    sendError(res, error, "Failed to edit message.");
  }
});

app.delete("/messages", auth, async (req, res) => {
  try {
    await whatsappService.deleteMessage(String(req.body?.messageId ?? ""));
  } catch (error) {
    sendError(res, error, "Failed to delete message.");
  }
});

// --- Send ---
app.post("/send", auth, async (req, res) => {
  const { chatId, body = "", media, quotedMessageId } = req.body ?? {};
  if (
    typeof chatId !== "string" ||
    typeof body !== "string" ||
    (quotedMessageId !== undefined && typeof quotedMessageId !== "string")
  ) {
    res.status(400).json({ error: "Invalid message payload." });
    return;
  }
  if (!chatId || (!body.trim() && !media)) {
    res.status(400).json({ error: "chatId and at least one of body or media are required." });
    return;
  }
  if (body.length > 4096) {
    res.status(413).json({ error: "WhatsApp messages are limited to 4096 characters." });
    return;
  }
  if (media) {
    const validMedia =
      typeof media === "object" &&
      typeof media.data === "string" &&
      media.data.length > 0 &&
      typeof media.mimetype === "string" &&
      media.mimetype.length <= 200 &&
      typeof media.filename === "string" &&
      media.filename.length <= 255;
    if (!validMedia) {
      res.status(400).json({ error: "Invalid media payload." });
      return;
    }
    if (estimateBase64Bytes(media.data) > maxMediaBytes) {
      res.status(413).json({ error: `Media exceeds the ${Math.floor(maxMediaBytes / 1024 / 1024)} MB limit.` });
      return;
    }
  }
  try {
    res.json({ message: await whatsappService.sendMessage(chatId, body, media, quotedMessageId) });
  } catch (error) {
    sendError(res, error, "Failed to send message.");
  }
});

// --- Templates ---
app.get("/templates", auth, async (req, res) => {
  try {
    res.json({ templates: await whatsappService.listTemplates(req.query.refresh === "1") });
  } catch (error) {
    sendError(res, error, "Failed to load templates.");
  }
});

app.post("/send-template", auth, async (req, res) => {
  const { chatId, name, language } = req.body ?? {};
  if (typeof chatId !== "string" || typeof name !== "string" || typeof language !== "string") {
    res.status(400).json({ error: "chatId, name and language are required." });
    return;
  }
  try {
    const message = await whatsappService.sendTemplate({
      chatId,
      name,
      language,
      headerValues: stringList(req.body.headerValues),
      bodyValues: stringList(req.body.bodyValues),
    });
    res.json({ message });
  } catch (error) {
    sendError(res, error, "Failed to send template.");
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
    const commonHeaders = {
      "Content-Type": media.mimetype,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
    };

    const match = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
    if (match) {
      const start = match[1] ? Number(match[1]) : Math.max(0, buffer.length - Number(match[2]));
      const end = match[1] && match[2] ? Math.min(Number(match[2]), buffer.length - 1) : buffer.length - 1;
      if (start <= end && start < buffer.length) {
        res.status(206).set({
          ...commonHeaders,
          "Content-Range": `bytes ${start}-${end}/${buffer.length}`,
          "Content-Length": String(end - start + 1),
        });
        res.send(buffer.subarray(start, end + 1));
        return;
      }
      res.status(416).set({ ...commonHeaders, "Content-Range": `bytes */${buffer.length}` }).end();
      return;
    }

    res.set({ ...commonHeaders, "Content-Length": String(buffer.byteLength) });
    res.send(buffer);
  } catch (error) {
    sendError(res, error, "Failed to fetch media.");
  }
});

// --- Avatars (only the business's own picture exists on Cloud API) ---
app.get("/chat-avatar", auth, async (req, res) => {
  res.json({ url: await whatsappService.getChatAvatarUrlById(String(req.query.chatId ?? "")) });
});

app.post("/chat-avatars", auth, async (req, res) => {
  const chatIds = Array.isArray(req.body?.chatIds)
    ? (req.body.chatIds as unknown[]).map(String).filter(Boolean).slice(0, 100)
    : [];
  res.json({ urls: await whatsappService.getChatAvatarUrlsByIds(chatIds) });
});

// --- Logout (no-op: the number stays connected to the Cloud API) ---
app.post("/logout", auth, async (_req, res) => {
  await whatsappService.logout();
  res.json({ ok: true });
});

// --- SSE stream ---
app.get("/stream", streamAuth, (req, res) => {
  whatsappService.ensureInitialized().catch(() => undefined);

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  let closed = false;
  const send = (event: string, data: unknown) => {
    if (closed || res.writableEnded || res.destroyed) return;
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      closed = true;
    }
  };

  send("state", { ...whatsappService.getState(), qrCodeDataUrl: null });

  const unsubscribers = [
    subscribeWhatsAppEvent("state", () => send("state", { ...whatsappService.getState(), qrCodeDataUrl: null })),
    subscribeWhatsAppEvent("chats-updated", (payload: WhatsAppEventPayload) =>
      send("chats-updated", { at: Date.now(), ...payload }),
    ),
    subscribeWhatsAppEvent("message", (payload: WhatsAppEventPayload) => send("message", payload)),
    subscribeWhatsAppEvent("messages-updated", (payload: WhatsAppEventPayload) =>
      send("messages-updated", payload),
    ),
  ];
  const ping = setInterval(() => send("ping", { at: Date.now() }), 25000);

  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(ping);
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
  req.on("close", cleanup);
  res.on("close", cleanup);
  res.on("error", cleanup);
});

const server = app.listen(PORT, () => {
  console.log(`[WhatsApp Cloud] listening on http://localhost:${PORT}`);
  console.log(`[WhatsApp Cloud] media storage: ${mediaStorage}`);
  whatsappService.startGroupsMonitor();
  whatsappService.ensureInitialized().catch((error: unknown) => {
    console.error("[WhatsApp Cloud] Failed to initialize:", error);
  });
});

// Keep-alive must exceed the AWS ALB idle timeout (60 s) to avoid 502s.
const keepAliveTimeoutMs = Number(process.env.WHATSAPP_KEEP_ALIVE_TIMEOUT_MS ?? 65000);
server.keepAliveTimeout = keepAliveTimeoutMs;
server.headersTimeout = keepAliveTimeoutMs + 1000;

server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `[WhatsApp Cloud] Port ${PORT} is already in use.`
      : `[WhatsApp Cloud] Server error: ${error.message}`,
  );
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[WhatsApp Cloud] Unhandled rejection:", reason);
});

async function shutdown(signal: string) {
  console.log(`[WhatsApp Cloud] ${signal} received, shutting down...`);
  server.close();
  await whatsappService.shutdownClient();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
