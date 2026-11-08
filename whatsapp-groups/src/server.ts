import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";

import makeWASocket, {
  Browsers,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  isJidGroup,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  type AnyMessageContent,
  type GroupMetadata,
  type WAMessage,
  type WASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";

import { convertMessage, messageTimestampSeconds } from "./convert.js";
import { enqueue, outboxSize } from "./outbox.js";

// WhatsApp groups for the admin panel, through a WhatsApp Web linked device on
// the firm's number. 1:1 chats stay on Meta's Cloud API (whatsapp-cloud/);
// this service ignores them. Group traffic is pushed into whatsapp-cloud, which
// stores it and serves it to the panels like any other chat.

const PORT = Number(process.env.PORT ?? 4003);
const SERVICE_TOKEN = process.env.WHATSAPP_SERVICE_TOKEN?.trim() || "";
const AUTH_DIR = process.env.WHATSAPP_GROUPS_AUTH_DIR?.trim() || "auth";
const MAX_MEDIA_BYTES = Number(process.env.WHATSAPP_MAX_MEDIA_BYTES ?? 20 * 1024 * 1024);
const MAX_BODY_BYTES = Math.ceil(MAX_MEDIA_BYTES * 1.4 + 1024 * 1024);
const LOG = (...args: unknown[]) => console.log("[WhatsApp Groups]", ...args);

if (!SERVICE_TOKEN) {
  console.error("[WhatsApp Groups] Missing WHATSAPP_SERVICE_TOKEN. Refusing to start.");
  process.exit(1);
}

const logger = pino({ level: process.env.WHATSAPP_GROUPS_LOG_LEVEL || "warn" });

type Status = "starting" | "qr" | "connecting" | "ready" | "disconnected" | "logged-out";

let sock: WASocket | null = null;
let status: Status = "starting";
let qrDataUrl: string | null = null;
let lastError: string | null = null;
let reconnectDelayMs = 2000;
let generation = 0;

const groupCache = new Map<string, GroupMetadata>();
// Ids this service sent on the panel's behalf: whatsapp-cloud records those
// itself, so their echo from the socket is not pushed back.
const sentByApi = new Map<string, number>();
// Recent outgoing messages, for WhatsApp's retry/resend requests.
const recentMessages = new Map<string, WAMessage>();

function remember<K, V>(map: Map<K, V>, key: K, value: V, max = 2000) {
  map.set(key, value);
  if (map.size > max) map.delete(map.keys().next().value as K);
}

// ---- Media download (serial, so a history burst does not flood WhatsApp) ----

let mediaChain: Promise<void> = Promise.resolve();

function queueMediaDownload(msg: WAMessage) {
  mediaChain = mediaChain.then(async () => {
    const current = sock;
    if (!current || !msg.key.id) return;
    try {
      const buffer = await downloadMediaMessage(
        msg,
        "buffer",
        {},
        { logger, reuploadRequest: current.updateMediaMessage },
      );
      if (buffer.length > MAX_MEDIA_BYTES) return;
      const converted = convertMessage(msg);
      const part = converted?.message[converted.message.type as "image"] as { mime_type?: string } | undefined;
      enqueue({
        kind: "media",
        id: msg.key.id,
        data: buffer.toString("base64"),
        mimetype: part?.mime_type ?? "application/octet-stream",
      });
    } catch (error) {
      LOG("Media download failed:", msg.key.id, error instanceof Error ? error.message : String(error));
    }
  });
}

// ---- Socket events → whatsapp-cloud ----

function authorFor(msg: WAMessage) {
  const key = msg.key as WAMessage["key"] & { participantPn?: string };
  const authorId = key.participant || null;
  const phoneJid = key.participantPn || (authorId?.endsWith("@s.whatsapp.net") ? authorId : null);
  const phone = phoneJid ? `+${phoneJid.split("@")[0]!.split(":")[0]}` : null;
  return { authorId, author: msg.pushName?.trim() || phone || "Group member" };
}

function pushMessage(msg: WAMessage, history: boolean) {
  const chatId = msg.key.remoteJid;
  if (!chatId || !isJidGroup(chatId) || !msg.key.id) return;
  if (sentByApi.has(msg.key.id)) return;
  const converted = convertMessage(msg);
  if (!converted) return;

  const fromMe = Boolean(msg.key.fromMe);
  const { author, authorId } = authorFor(msg);
  enqueue({
    kind: "message",
    chatId,
    fromMe,
    history,
    author: fromMe ? null : author,
    authorId: fromMe ? null : authorId,
    groupSubject: groupCache.get(chatId)?.subject ?? null,
    message: { ...converted.message, from: authorId ?? undefined },
  });
  if (converted.hasMedia && (!converted.maxBytes || converted.maxBytes <= MAX_MEDIA_BYTES)) {
    queueMediaDownload(msg);
  }
}

function pushGroups(groups: Array<Partial<GroupMetadata>>) {
  const list = groups
    .filter((g) => g.id && isJidGroup(g.id) && g.subject)
    .map((g) => ({ id: g.id!, subject: g.subject! }));
  if (list.length) enqueue({ kind: "chats", groups: list });
}

// Baileys status: 0 error, 1 pending, 2 server ack, 3 delivered, 4 read, 5 played.
// Cloud ack: -1 failed, 0 pending, 1 sent, 2 delivered, 3 read, 4 played.
function toAck(baileysStatus: number) {
  return baileysStatus === 0 ? -1 : Math.max(0, baileysStatus - 1);
}

async function refreshGroups(current: WASocket) {
  try {
    const all = await current.groupFetchAllParticipating();
    for (const group of Object.values(all)) groupCache.set(group.id, group);
    pushGroups(Object.values(all));
    LOG(`Groups visible: ${groupCache.size}`);
  } catch (error) {
    LOG("Fetching groups failed:", error instanceof Error ? error.message : String(error));
  }
}

async function connect() {
  const myGeneration = ++generation;
  status = "connecting";
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

  const current = makeWASocket({
    ...(version ? { version } : {}),
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    logger,
    browser: Browsers.macOS("Stanley Groups"),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    cachedGroupMetadata: async (jid) => groupCache.get(jid),
    getMessage: async (key) => (key.id ? recentMessages.get(key.id)?.message ?? undefined : undefined),
  });
  sock = current;

  current.ev.on("creds.update", saveCreds);

  current.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (myGeneration !== generation) return;
    if (qr) {
      status = "qr";
      qrDataUrl = await QRCode.toDataURL(qr);
      LOG(`Scan the QR: http://localhost:${PORT}/qr?token=<WHATSAPP_SERVICE_TOKEN>`);
      console.log(await QRCode.toString(qr, { type: "terminal", small: true }));
    }
    if (connection === "open") {
      status = "ready";
      qrDataUrl = null;
      lastError = null;
      reconnectDelayMs = 2000;
      LOG(`Linked as ${current.user?.id}`);
      void refreshGroups(current);
    }
    if (connection === "close") {
      const code = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
      lastError = lastDisconnect?.error?.message ?? null;
      sock = null;
      if (code === DisconnectReason.loggedOut) {
        status = "logged-out";
        LOG("Linked device was removed from the phone. Clearing the session; a new QR will be shown.");
        await fs.rm(AUTH_DIR, { recursive: true, force: true });
        setTimeout(() => safeConnect(), 1000);
        return;
      }
      status = "disconnected";
      const delay = code === DisconnectReason.restartRequired ? 0 : reconnectDelayMs;
      reconnectDelayMs = Math.min(reconnectDelayMs * 2, 60_000);
      LOG(`Connection closed (${code ?? "unknown"}: ${lastError ?? ""}). Reconnecting in ${delay / 1000}s.`);
      setTimeout(() => safeConnect(), delay);
    }
  });

  current.ev.on("messaging-history.set", ({ messages, chats }) => {
    pushGroups(chats.filter((c) => c.id && isJidGroup(c.id)).map((c) => ({ id: c.id, subject: c.name ?? undefined })));
    for (const msg of messages) pushMessage(msg, true);
  });

  current.ev.on("messages.upsert", ({ messages, type }) => {
    for (const msg of messages) {
      if (msg.key.fromMe && msg.key.id && msg.message) remember(recentMessages, msg.key.id, msg);
      // "notify" = new message; "append" = sent from the phone or another device.
      pushMessage(msg, type === "append" && !msg.key.fromMe);
    }
  });

  current.ev.on("messages.update", (updates) => {
    for (const { key, update } of updates) {
      if (!key.id || !key.remoteJid || !isJidGroup(key.remoteJid) || typeof update.status !== "number") continue;
      enqueue({ kind: "status", id: key.id, ack: toAck(update.status) });
    }
  });

  current.ev.on("groups.upsert", (groups) => {
    for (const group of groups) groupCache.set(group.id, group);
    pushGroups(groups);
  });

  current.ev.on("groups.update", (updates) => {
    for (const update of updates) {
      if (!update.id) continue;
      const cached = groupCache.get(update.id);
      if (cached) groupCache.set(update.id, { ...cached, ...update } as GroupMetadata);
    }
    pushGroups(updates);
  });

  current.ev.on("group-participants.update", async ({ id }) => {
    try {
      groupCache.set(id, await current.groupMetadata(id));
    } catch {
      groupCache.delete(id);
    }
  });
}

// A failed start (bad session files, network) must never kill the process:
// retry with backoff and keep the HTTP side answering /status.
function safeConnect() {
  connect().catch((error) => {
    lastError = error instanceof Error ? error.message : String(error);
    status = "disconnected";
    LOG(`Start failed: ${lastError}. Retrying in ${reconnectDelayMs / 1000}s.`);
    setTimeout(() => safeConnect(), reconnectDelayMs);
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, 60_000);
  });
}

// ---- Sending ----

type SendInput = {
  chatId?: string;
  body?: string;
  media?: { data: string; mimetype: string; filename: string } | null;
  quoted?: { id: string; body?: string; fromMe?: boolean; participant?: string | null } | null;
};

function contentFor(input: SendInput): { content: AnyMessageContent; type: string } {
  const text = (input.body ?? "").trim();
  if (!input.media) return { content: { text }, type: "chat" };
  const base64 = input.media.data.includes(",") ? input.media.data.slice(input.media.data.indexOf(",") + 1) : input.media.data;
  const buffer = Buffer.from(base64, "base64");
  const mimetype = input.media.mimetype.split(";")[0]!.trim() || "application/octet-stream";
  const caption = text || undefined;
  if (mimetype === "image/jpeg" || mimetype === "image/png") return { content: { image: buffer, mimetype, caption }, type: "image" };
  if (mimetype.startsWith("video/")) return { content: { video: buffer, mimetype, caption }, type: "video" };
  if (mimetype.startsWith("audio/")) return { content: { audio: buffer, mimetype, ptt: false }, type: "audio" };
  return { content: { document: buffer, mimetype, fileName: input.media.filename, caption }, type: "document" };
}

async function send(input: SendInput) {
  const chatId = input.chatId ?? "";
  if (!isJidGroup(chatId)) throw httpError(400, "Only group chats are sent through this service.");
  if (!sock || status !== "ready") throw httpError(503, "WhatsApp groups are not connected. Scan the QR on the groups service.");
  const current = sock;
  const { content, type } = contentFor(input);
  const quoted: WAMessage | undefined = input.quoted?.id
    ? {
        key: {
          remoteJid: chatId,
          id: input.quoted.id,
          fromMe: Boolean(input.quoted.fromMe),
          participant: input.quoted.fromMe ? undefined : input.quoted.participant ?? undefined,
        },
        message: { conversation: input.quoted.body ?? "" },
      }
    : undefined;

  // Audio cannot carry a caption: the text goes as its own message, which comes
  // back through the socket and reaches whatsapp-cloud as a normal echo.
  const sent = await current.sendMessage(chatId, content, quoted ? { quoted } : {});
  if (!sent?.key.id) throw httpError(502, "WhatsApp did not return a message id.");
  remember(sentByApi, sent.key.id, Date.now());
  remember(recentMessages, sent.key.id, sent);
  if (type === "audio" && input.body?.trim()) {
    await current.sendMessage(chatId, { text: input.body.trim() });
  }
  return { id: sent.key.id, timestamp: messageTimestampSeconds(sent) * 1000, type };
}

async function markRead(input: { chatId?: string; messageId?: string; participant?: string | null }) {
  if (!sock || status !== "ready" || !input.chatId || !input.messageId) return;
  await sock.readMessages([
    { remoteJid: input.chatId, id: input.messageId, participant: input.participant ?? undefined, fromMe: false },
  ]);
}

// ---- HTTP ----

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
function httpError(statusCode: number, message: string) {
  return new HttpError(statusCode, message);
}

function tokenOk(req: http.IncomingMessage, url: URL) {
  const header = req.headers["x-whatsapp-service-token"];
  const bearer = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7).trim() : undefined;
  const given = (typeof header === "string" ? header : undefined) ?? bearer ?? url.searchParams.get("token") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(SERVICE_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function readJson(req: http.IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw httpError(413, "Request body is too large.");
    chunks.push(chunk as Buffer);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function json(res: http.ServerResponse, statusCode: number, body: unknown) {
  res.writeHead(statusCode, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function statusBody() {
  return {
    status,
    linkedAs: sock?.user?.id ?? null,
    groups: groupCache.size,
    pendingEvents: outboxSize(),
    error: lastError,
    qrCodeDataUrl: qrDataUrl,
  };
}

function qrPage() {
  const body =
    status === "ready"
      ? `<h1>Linked ✓</h1><p>${sock?.user?.id ?? ""} · ${groupCache.size} groups</p>`
      : qrDataUrl
        ? `<h1>Link WhatsApp groups</h1><p>On the phone: WhatsApp Business → Linked devices → Link a device, then scan.</p><img src="${qrDataUrl}" width="300" height="300" alt="QR code">`
        : `<h1>${status}…</h1><p>${lastError ?? "Waiting for WhatsApp."}</p>`;
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="5"><title>WhatsApp Groups</title><body style="font-family:system-ui;padding:24px;max-width:420px;margin:auto;text-align:center">${body}</body>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (!tokenOk(req, url)) {
      json(res, 401, { error: "Unauthorized" });
      return;
    }
    if (req.method === "GET" && url.pathname === "/status") return json(res, 200, statusBody());
    if (req.method === "GET" && url.pathname === "/qr") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(qrPage());
      return;
    }
    if (req.method === "POST" && url.pathname === "/send") return json(res, 200, await send(await readJson(req)));
    if (req.method === "POST" && url.pathname === "/read") {
      await markRead(await readJson(req));
      return json(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/refresh-groups") {
      if (sock) await refreshGroups(sock);
      return json(res, 200, statusBody());
    }
    json(res, 404, { error: "Not found" });
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : String(error);
    if (statusCode >= 500) console.error("[WhatsApp Groups]", message);
    if (!res.headersSent) json(res, statusCode, { error: message });
  }
});

server.listen(PORT, () => {
  LOG(`listening on http://localhost:${PORT}`);
  safeConnect();
});

server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(
    error.code === "EADDRINUSE" ? `[WhatsApp Groups] Port ${PORT} is already in use.` : `[WhatsApp Groups] ${error.message}`,
  );
  process.exit(1);
});

process.on("unhandledRejection", (reason) => console.error("[WhatsApp Groups] Unhandled rejection:", reason));
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    LOG(`${signal} received, shutting down.`);
    sock?.end(undefined);
    server.close();
    process.exit(0);
  });
}
