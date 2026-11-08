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
  proto,
  useMultiFileAuthState,
  type AnyMessageContent,
  type Chat,
  type Contact,
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

// WHATSAPP_WEB_DIRECT_CHATS=true: also pass 1:1 chats to whatsapp-cloud (used
// when whatsapp-cloud runs with WHATSAPP_DIRECT_VIA_WEB=true instead of Meta).
const DIRECT_CHATS = process.env.WHATSAPP_WEB_DIRECT_CHATS?.trim() === "true";
// Opt-in: ask the phone for its full history when linking. Off by default
// because WhatsApp drops that link request (428) for this device on our
// account, which only delays the QR; recent history still comes without it.
const FULL_HISTORY = DIRECT_CHATS && process.env.WHATSAPP_WEB_FULL_HISTORY?.trim() === "true";
// Media in history older than this is not downloaded (text still comes).
const HISTORY_MEDIA_DAYS = Number(process.env.WHATSAPP_WEB_HISTORY_MEDIA_DAYS ?? 7);
let hiddenNumberChats = 0;

// WhatsApp now addresses many 1:1 chats by a hidden id ("...@lid") instead of
// the phone number. Remember the phone number whenever a message reveals it.
const lidToPhone = new Map<string, string>();

function isDirectJid(jid: string) {
  return jid.endsWith("@s.whatsapp.net") || jid.endsWith("@lid");
}

function phoneDigits(jid: string | null | undefined) {
  if (!jid || !jid.endsWith("@s.whatsapp.net")) return null;
  return jid.split("@")[0]!.split(":")[0]!.replace(/\D/g, "") || null;
}

/** Phone digits of a 1:1 chat, or null when only the hidden id is known. */
function directPhone(msg: WAMessage): string | null {
  const jid = msg.key.remoteJid ?? "";
  const direct = phoneDigits(jid);
  if (direct) return direct;
  if (jid.endsWith("@lid")) {
    const key = msg.key as WAMessage["key"] & { senderPn?: string; remoteJidAlt?: string };
    const phone = phoneDigits(key.senderPn) ?? phoneDigits(key.remoteJidAlt);
    if (phone) {
      lidToPhone.set(jid, phone);
      return phone;
    }
    return lidToPhone.get(jid) ?? null;
  }
  return null;
}

/** Chat id from whatsapp-cloud (group jid, "<digits>@c.us" or digits) to a WhatsApp jid. */
function toJid(chatId: string) {
  if (isJidGroup(chatId)) return chatId;
  if (chatId.endsWith("@lid")) {
    if (!DIRECT_CHATS) throw httpError(400, "Only group chats are sent through this service.");
    return `${chatId.split("@")[0]!.split(":")[0]}@lid`;
  }
  if (!DIRECT_CHATS) throw httpError(400, "Only group chats are sent through this service.");
  const digits = chatId.split("@")[0]!.replace(/\D/g, "");
  if (digits.length < 8) throw httpError(400, "Invalid WhatsApp number.");
  return `${digits}@s.whatsapp.net`;
}

function rememberLid(lid: string | null | undefined, phoneJid: string | null | undefined) {
  const phone = phoneDigits(phoneJid);
  if (lid?.endsWith("@lid") && phone) lidToPhone.set(lid, phone);
}

// Address-book names (and the names people set themselves) for 1:1 chats.
function pushContacts(contacts: Array<Partial<Contact>>) {
  if (!DIRECT_CHATS) return;
  const list: Array<{ phone: string; name: string }> = [];
  for (const contact of contacts) {
    const id = contact.id ?? "";
    rememberLid(contact.lid ?? (id.endsWith("@lid") ? id : null), contact.jid ?? (id.endsWith("@s.whatsapp.net") ? id : null));
    const phone =
      phoneDigits(contact.jid) ?? phoneDigits(id) ?? (id.endsWith("@lid") ? lidToPhone.get(id) ?? null : null);
    const name = (contact.name || contact.notify || contact.verifiedName || "").trim();
    if (phone && name) list.push({ phone, name });
  }
  for (let i = 0; i < list.length; i += 500) {
    enqueue({ kind: "contacts", contacts: list.slice(i, i + 500) });
  }
}

// The phone's 1:1 chat list (history sync and live chat updates), so every
// conversation shows in the panel even before a new message arrives.
function pushDirectChats(chats: Array<Partial<Chat>>) {
  if (!DIRECT_CHATS) return;
  const list: Array<{ chatId: string; name: string | null; timestamp: number | null; unreadCount: number | null }> = [];
  for (const chat of chats) {
    const id = chat.id ?? "";
    if (!id || !isDirectJid(id)) continue;
    const c = chat as Partial<Chat> & { pnJid?: string | null; lidJid?: string | null };
    rememberLid(c.lidJid ?? (id.endsWith("@lid") ? id : null), c.pnJid ?? (id.endsWith("@s.whatsapp.net") ? id : null));
    const phone = phoneDigits(id) ?? phoneDigits(c.pnJid) ?? (id.endsWith("@lid") ? lidToPhone.get(id) ?? null : null);
    const lid = id.endsWith("@lid") ? id.split("@")[0]!.split(":")[0] : null;
    if (!phone && !lid) continue;
    const seconds = Number(chat.conversationTimestamp ?? chat.lastMessageRecvTimestamp ?? 0);
    list.push({
      chatId: phone ? `${phone}@c.us` : `${lid}@lid`,
      name: chat.name?.trim() || null,
      timestamp: seconds ? seconds * 1000 : null,
      unreadCount: typeof chat.unreadCount === "number" ? chat.unreadCount : null,
    });
  }
  for (let i = 0; i < list.length; i += 500) {
    enqueue({ kind: "directChats", chats: list.slice(i, i + 500) });
  }
}

function isRecent(msg: WAMessage) {
  const seconds = messageTimestampSeconds(msg);
  return !seconds || Date.now() / 1000 - seconds < HISTORY_MEDIA_DAYS * 86400;
}

function pushDirectMessage(msg: WAMessage, history: boolean) {
  const phone = directPhone(msg);
  // When WhatsApp hides the number, keep the chat under its hidden id
  // ("<lid>@lid"); replies go back to that id.
  const lid = !phone ? (msg.key.remoteJid ?? "").split("@")[0]!.split(":")[0] : null;
  if (!phone && !lid) return;
  if (!phone) {
    hiddenNumberChats++;
    if (hiddenNumberChats === 1 || hiddenNumberChats % 500 === 0) {
      LOG(`${hiddenNumberChats} 1:1 message(s) came with a hidden number (@lid); kept under the hidden id.`);
    }
  }
  const converted = convertMessage(msg);
  if (!history) {
    // One line per live 1:1 message, so missing chats can be diagnosed.
    const kind = msg.message ? Object.keys(msg.message).join(",") : `no content (stub ${msg.messageStubType ?? "-"})`;
    LOG(
      `1:1 ${msg.key.fromMe ? "sent" : "received"} ${phone ? `+${phone}` : `${lid}@lid`}: ${kind} -> ${converted ? "forwarded" : "ignored"}`,
    );
  }
  if (!converted) return;
  const fromMe = Boolean(msg.key.fromMe);
  enqueue({
    kind: "message",
    chatId: phone ? `${phone}@c.us` : `${lid}@lid`,
    fromMe,
    history,
    contactName: fromMe ? null : msg.pushName?.trim() || null,
    message: { ...converted.message, from: fromMe ? undefined : phone ?? undefined },
  });
  if (
    converted.hasMedia &&
    (!converted.maxBytes || converted.maxBytes <= MAX_MEDIA_BYTES) &&
    (!history || isRecent(msg))
  ) {
    queueMediaDownload(msg);
  }
}

function pushMessage(msg: WAMessage, history: boolean) {
  const chatId = msg.key.remoteJid;
  if (!chatId || !msg.key.id) return;
  if (sentByApi.has(msg.key.id)) return;
  if (!isJidGroup(chatId)) {
    if (DIRECT_CHATS && isDirectJid(chatId)) pushDirectMessage(msg, history);
    else if (DIRECT_CHATS && !history && !chatId.endsWith("@broadcast") && !chatId.endsWith("@newsletter")) {
      LOG(`Message in unsupported chat ${chatId} ignored.`);
    }
    return;
  }
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
  if (
    converted.hasMedia &&
    (!converted.maxBytes || converted.maxBytes <= MAX_MEDIA_BYTES) &&
    (!history || isRecent(msg))
  ) {
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
  // Never run two sockets on the same login: WhatsApp terminates both (428).
  const previous = sock;
  sock = null;
  try {
    previous?.end(undefined);
  } catch {
    // Already closed.
  }
  status = "connecting";
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const freshPairing = !state.creds.me;
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

  const current = makeWASocket({
    ...(version ? { version } : {}),
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    logger,
    browser: Browsers.macOS("Stanley Groups"),
    markOnlineOnConnect: false,
    // Full history is only sent when the device is linked, and WhatsApp drops
    // the connection (428) if an existing session asks for it. So request it
    // only when there is no saved session yet, i.e. right before a QR scan.
    syncFullHistory: FULL_HISTORY && freshPairing && !fullHistoryDisabled,
    // Baileys' default drops ALL history (even the recent chats the phone sends
    // on linking) unless syncFullHistory is on. Keep recent history; take the
    // FULL type only when full history was asked for.
    shouldSyncHistoryMessage: (history) =>
      history.syncType !== proto.HistorySync.HistorySyncType.FULL || (FULL_HISTORY && !fullHistoryDisabled),
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
        scheduleReconnect(1000);
        return;
      }
      status = "disconnected";
      if (freshPairing && code === 428 && FULL_HISTORY && !fullHistoryDisabled && ++freshPairing428 >= 2) {
        // Safety net: if linking keeps failing with full history requested,
        // link without it so the QR still appears.
        fullHistoryDisabled = true;
        LOG("Linking keeps failing with full history requested; retrying without full history.");
      }
      const delay = code === DisconnectReason.restartRequired ? 0 : reconnectDelayMs;
      reconnectDelayMs = Math.min(reconnectDelayMs * 2, 60_000);
      LOG(`Connection closed (${code ?? "unknown"}: ${lastError ?? ""}). Reconnecting in ${delay / 1000}s.`);
      scheduleReconnect(delay);
    }
  });

  current.ev.on("messaging-history.set", ({ messages, chats, contacts, progress }) => {
    // Learn hidden-id -> phone pairs first, so the messages below can be placed.
    for (const chat of chats) {
      const c = chat as typeof chat & { pnJid?: string | null; lidJid?: string | null };
      rememberLid(c.lidJid ?? (c.id?.endsWith("@lid") ? c.id : null), c.pnJid ?? (c.id?.endsWith("@s.whatsapp.net") ? c.id : null));
    }
    pushContacts(contacts);
    pushDirectChats(chats);
    LOG(`History: ${chats.length} chats, ${contacts.length} contacts, ${messages.length} messages${progress != null ? ` (${progress}%)` : ""}.`);
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
      if (!key.id || !key.remoteJid || typeof update.status !== "number") continue;
      if (!isJidGroup(key.remoteJid) && !(DIRECT_CHATS && isDirectJid(key.remoteJid))) continue;
      enqueue({ kind: "status", id: key.id, ack: toAck(update.status) });
    }
  });

  current.ev.on("contacts.upsert", (contacts) => pushContacts(contacts));
  current.ev.on("contacts.update", (contacts) => pushContacts(contacts));
  current.ev.on("chats.phoneNumberShare", ({ lid, jid }) => rememberLid(lid, jid));
  current.ev.on("chats.upsert", (chats) => pushDirectChats(chats));

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

// Called when someone opens the "Link groups" dialog: if not linked, drop the
// current attempt (which may be waiting out a long backoff after its QR codes
// expired) and start a fresh one so a new QR shows up right away.
async function startLinking() {
  if (status === "ready") return;
  if (status !== "qr" || !qrDataUrl) {
    reconnectDelayMs = 2000;
    generation++;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    const old = sock;
    sock = null;
    try {
      old?.end(undefined);
    } catch {
      // Already closed.
    }
    safeConnect();
  }
  await waitForQr();
}

// Removes this linked device from the phone; a new QR is shown afterwards.
let unlinking = false;
async function unlink() {
  if (unlinking) return; // double click
  unlinking = true;
  try {
    const current = sock;
    const wasReady = status === "ready";
    // Ignore this socket's own "logged out" close event; we restart below.
    generation++;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    sock = null;
    if (current && wasReady) await current.logout().catch(() => undefined);
    try {
      current?.end(undefined);
    } catch {
      // Already closed.
    }
    await fs.rm(AUTH_DIR, { recursive: true, force: true });
    status = "connecting";
    qrDataUrl = null;
    freshPairing428 = 0;
    reconnectDelayMs = 2000;
    safeConnect();
    await waitForQr();
  } finally {
    unlinking = false;
  }
}

async function waitForQr() {
  for (let i = 0; i < 40 && !qrDataUrl && (status as string) !== "ready"; i++) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleReconnect(delayMs: number) {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    safeConnect();
  }, delayMs);
}

// A failed start (bad session files, network) must never kill the process:
// retry with backoff and keep the HTTP side answering /status.
// Only one connect at a time; a request while one is starting is dropped
// (the one in progress produces the socket).
let connectInFlight = false;
let fullHistoryDisabled = false;
let freshPairing428 = 0;
function safeConnect() {
  if (connectInFlight) return;
  connectInFlight = true;
  connect()
    .finally(() => {
      connectInFlight = false;
    })
    .catch((error) => {
    lastError = error instanceof Error ? error.message : String(error);
    status = "disconnected";
    LOG(`Start failed: ${lastError}. Retrying in ${reconnectDelayMs / 1000}s.`);
    scheduleReconnect(reconnectDelayMs);
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
  const chatId = toJid(input.chatId ?? "");
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
  const remoteJid = toJid(input.chatId);
  await sock.readMessages([
    {
      remoteJid,
      id: input.messageId,
      participant: isJidGroup(remoteJid) ? input.participant ?? undefined : undefined,
      fromMe: false,
    },
  ]);
}

// ---- Profile pictures ----
// Cached for a while (WhatsApp rate-limits these lookups); a missing picture
// is cached too. At most 4 lookups run at once.
const AVATAR_TTL_MS = 6 * 60 * 60 * 1000;
const avatarCache = new Map<string, { url: string | null; at: number }>();
let avatarSlots = 4;
const avatarWaiters: Array<() => void> = [];

async function withAvatarSlot<T>(task: () => Promise<T>) {
  if (avatarSlots === 0) await new Promise<void>((resolve) => avatarWaiters.push(resolve));
  avatarSlots--;
  try {
    return await task();
  } finally {
    avatarSlots++;
    avatarWaiters.shift()?.();
  }
}

async function avatarFor(chatId: string): Promise<string | null> {
  let jid: string;
  try {
    jid = toJid(chatId);
  } catch {
    return null;
  }
  const cached = avatarCache.get(jid);
  if (cached && Date.now() - cached.at < AVATAR_TTL_MS) return cached.url;
  const current = sock;
  if (!current || status !== "ready") return cached?.url ?? null;
  const url = await withAvatarSlot(() =>
    Promise.race([
      current.profilePictureUrl(jid, "image").catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]),
  );
  if (avatarCache.size > 20000) avatarCache.clear();
  avatarCache.set(jid, { url: url ?? null, at: Date.now() });
  return url ?? null;
}

async function avatars(chatIds: unknown) {
  const ids = Array.isArray(chatIds) ? chatIds.map(String).filter(Boolean).slice(0, 100) : [];
  const urls: Record<string, string | null> = {};
  await Promise.all(ids.map(async (id) => (urls[id] = await avatarFor(id))));
  return { urls };
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
    // The linked account's own WhatsApp name.
    name: sock?.user?.name ?? sock?.user?.verifiedName ?? null,
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
    // Public liveness check; reports only the link status, nothing secret.
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return json(res, 200, {
        ok: true,
        service: "whatsapp-groups",
        uptimeSeconds: Math.round(process.uptime()),
        status,
      });
    }
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
    if (req.method === "POST" && url.pathname === "/avatars") {
      const body = (await readJson(req)) as { chatIds?: unknown };
      return json(res, 200, await avatars(body.chatIds));
    }
    if (req.method === "POST" && url.pathname === "/link") {
      await startLinking();
      return json(res, 200, statusBody());
    }
    if (req.method === "POST" && url.pathname === "/unlink") {
      await unlink();
      return json(res, 200, statusBody());
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
