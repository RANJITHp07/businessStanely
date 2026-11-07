import fs from "fs/promises";
import path from "path";

import { publishWhatsAppEvent } from "./realtime.js";
import type {
  WhatsAppChatSummary,
  WhatsAppMessage,
  WhatsAppState,
  WhatsAppTemplate,
} from "./types.js";
import {
  CloudApiError,
  downloadMedia,
  exchangeSignupCode,
  graphRequest,
  graphVersion,
} from "./graph.js";
import {
  getCollections,
  type CloudChatDoc,
  type CloudConfigDoc,
  type CloudMessageDoc,
} from "./store.js";

const LOG = (...args: unknown[]) => console.log("[WhatsApp Cloud]", ...args);

const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
const TEMPLATE_CACHE_MS = 5 * 60 * 1000;
const RETRY_DELAY_MS = 30 * 1000;
const mediaDir = path.resolve(process.env.WHATSAPP_MEDIA_DIR?.trim() || "wa-media");
const defaultCountryCode = (process.env.WA_CLOUD_DEFAULT_COUNTRY_CODE ?? "91").replace(/\D/g, "");

const ACK = { pending: 0, sent: 1, delivered: 2, read: 3, played: 4, failed: -1 } as const;

// ---- Webhook payload shapes (only the fields we read) ----

type WaMediaPart = {
  id?: string;
  mime_type?: string;
  caption?: string;
  filename?: string;
  voice?: boolean;
};

type WaMessage = {
  id: string;
  from?: string;
  to?: string;
  timestamp?: string;
  type?: string;
  group_id?: string;
  text?: { body?: string };
  image?: WaMediaPart;
  video?: WaMediaPart;
  audio?: WaMediaPart;
  document?: WaMediaPart;
  sticker?: WaMediaPart;
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
  contacts?: Array<{ name?: { formatted_name?: string } }>;
  interactive?: {
    button_reply?: { title?: string };
    list_reply?: { title?: string };
    nfm_reply?: { body?: string };
  };
  button?: { text?: string };
  system?: { body?: string };
  context?: { id?: string };
  history_context?: { status?: string };
};

type WaStatus = {
  id: string;
  status?: string;
  recipient_id?: string;
  errors?: Array<{ title?: string; message?: string; error_data?: { details?: string } }>;
};

type WaChangeValue = {
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
  messages?: WaMessage[];
  statuses?: WaStatus[];
  message_echoes?: WaMessage[];
  history?: Array<{
    metadata?: { phase?: number; progress?: number };
    threads?: Array<{ id?: string; messages?: WaMessage[] }>;
    errors?: Array<{ message?: string; title?: string }>;
  }>;
  state_sync?: Array<{
    type?: string;
    action?: string;
    contact?: { full_name?: string; first_name?: string; phone_number?: string };
  }>;
};

type WebhookBody = {
  object?: string;
  entry?: Array<{ changes?: Array<{ field?: string; value?: WaChangeValue }> }>;
};

type GraphTemplate = {
  name: string;
  language: string;
  status: string;
  category: string;
  parameter_format?: string;
  components?: Array<{
    type: string;
    format?: string;
    text?: string;
    buttons?: Array<{ type?: string; url?: string }>;
  }>;
};

// ---- Helpers ----

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function isGroupId(value: string) {
  return value.includes("@g.us") || value.includes("-");
}

// Accepts "919876543210@c.us", "+91 98765 43210" or a bare 10-digit Indian
// number and returns the wa_id digits Cloud API uses.
function toWaId(chatId: string) {
  const raw = chatId.trim();
  if (isGroupId(raw.split("@")[0] ?? "") || raw.endsWith("@g.us")) {
    throw new CloudApiError("Group chats are disabled.", 403);
  }
  let digits = digitsOnly(raw.split("@")[0] ?? "");
  if (digits.length === 10 && defaultCountryCode) {
    digits = `${defaultCountryCode}${digits}`;
  }
  if (digits.length < 8 || digits.length > 15) {
    throw new CloudApiError("Invalid WhatsApp number.", 400);
  }
  return digits;
}

function toChatId(waId: string) {
  return `${waId}@c.us`;
}

function placeholders(text: string | undefined) {
  const names: string[] = [];
  for (const match of (text ?? "").matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) {
    if (!names.includes(match[1]!)) names.push(match[1]!);
  }
  return names;
}

function renderTemplateText(text: string, names: string[], values: string[]) {
  return names.reduce(
    (result, name, index) =>
      result.replace(new RegExp(`\\{\\{\\s*${name.replace(".", "\\.")}\\s*\\}\\}`, "g"), values[index] ?? ""),
    text,
  );
}

function sendTypeForMimetype(mimetype: string) {
  if (mimetype === "image/jpeg" || mimetype === "image/png") return "image";
  if (mimetype === "video/mp4" || mimetype === "video/3gpp") return "video";
  if (mimetype.startsWith("audio/")) return "audio";
  return "document";
}

function mediaPreview(type: string, body: string, filename?: string | null) {
  if (body) return body;
  switch (type) {
    case "image":
      return "📷 Photo";
    case "video":
      return "🎥 Video";
    case "ptt":
      return "🎤 Voice message";
    case "audio":
      return "🎵 Audio";
    case "sticker":
      return "Sticker";
    case "document":
      return `📄 ${filename || "Document"}`;
    default:
      return "";
  }
}

function safeFileName(id: string) {
  return id.replace(/[^\w.-]/g, "_");
}

// Normalises any inbound/echo/history message into what we store. Returns
// null for things that should not become a chat bubble (reactions etc.).
function parseWaMessage(message: WaMessage) {
  const type = message.type ?? "unknown";
  const mediaPart =
    type === "image" || type === "video" || type === "audio" || type === "document" || type === "sticker"
      ? (message[type] as WaMediaPart | undefined)
      : undefined;

  if (mediaPart) {
    const storedType = type === "audio" && mediaPart.voice ? "ptt" : type;
    return {
      type: storedType,
      body: mediaPart.caption ?? "",
      media: {
        id: mediaPart.id ?? null,
        mimetype: mediaPart.mime_type ?? null,
        filename: mediaPart.filename ?? null,
        localFile: null,
      },
    };
  }

  let body: string;
  switch (type) {
    case "text":
      body = message.text?.body ?? "";
      break;
    case "location": {
      const loc = message.location ?? {};
      const label = [loc.name, loc.address].filter(Boolean).join(", ");
      body = `📍 ${label ? `${label} ` : ""}(${loc.latitude}, ${loc.longitude})`;
      break;
    }
    case "contacts":
      body = `👤 ${(message.contacts ?? []).map((c) => c.name?.formatted_name).filter(Boolean).join(", ") || "Contact"}`;
      break;
    case "interactive":
      body =
        message.interactive?.button_reply?.title ??
        message.interactive?.list_reply?.title ??
        message.interactive?.nfm_reply?.body ??
        "Interactive reply";
      break;
    case "button":
      body = message.button?.text ?? "";
      break;
    case "system":
      body = message.system?.body ?? "";
      break;
    case "reaction":
    case "edit":
    case "revoke":
    case "ephemeral":
      return null;
    default:
      body = "Unsupported message — open WhatsApp on the phone to view it.";
  }

  return { type: type === "text" ? "chat" : type, body, media: null };
}

function historyAck(status?: string) {
  switch ((status ?? "").toUpperCase()) {
    case "READ":
    case "PLAYED":
      return ACK.read;
    case "DELIVERED":
      return ACK.delivered;
    case "ERROR":
      return ACK.failed;
    default:
      return ACK.sent;
  }
}

// ---- Service ----

class CloudWhatsAppService {
  private state: WhatsAppState = {
    status: "idle",
    qr: null,
    clientInfo: { pushname: null, wid: null, platform: "cloud-api" },
    error: null,
    lastUpdatedAt: new Date().toISOString(),
    provider: "cloud",
    capabilities: {
      editMessages: false,
      deleteMessages: false,
      templates: true,
      logout: false,
    },
    onboarding: null,
  };
  private config: Omit<CloudConfigDoc, "_id"> | null = null;
  private businessPhoneDigits = "";
  private businessAvatarUrl: string | null = null;
  private initializing: Promise<void> | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private webhookQueue: Promise<void> = Promise.resolve();
  private mediaQueue: Promise<void> = Promise.resolve();
  private templatesCache: { at: number; templates: WhatsAppTemplate[] } | null = null;

  // Shared read cache for the chat list and message pages. Many agents look at
  // the same data, so identical reads collapse into one Mongo query. Entries are
  // tagged with a version that every write bumps, so a cached value is never
  // served after the data behind it changed.
  private chatsVersion = 0;
  private messageVersions = new Map<string, number>();
  private readCache = new Map<string, { version: string; value: Promise<unknown> }>();

  private bumpChats() {
    this.chatsVersion += 1;
  }

  private bumpMessages(chatId: string) {
    this.messageVersions.set(chatId, (this.messageVersions.get(chatId) ?? 0) + 1);
  }

  private cached<T>(key: string, version: string, load: () => Promise<T>): Promise<T> {
    const hit = this.readCache.get(key);
    if (hit && hit.version === version) return hit.value as Promise<T>;
    if (this.readCache.size > 2000) this.readCache.clear();
    const value = load();
    this.readCache.set(key, { version, value });
    value.catch(() => {
      if (this.readCache.get(key)?.value === value) this.readCache.delete(key);
    });
    return value;
  }

  getState(): WhatsAppState {
    return this.state;
  }

  private setState(patch: Partial<WhatsAppState>) {
    this.state = { ...this.state, ...patch, lastUpdatedAt: new Date().toISOString() };
    publishWhatsAppEvent("state", { state: this.state });
  }

  private onboardingInfo() {
    const appId = process.env.META_APP_ID?.trim();
    const configId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID?.trim();
    return appId && configId ? { appId, configId, graphApiVersion: graphVersion } : null;
  }

  private async loadConfig() {
    const envToken = process.env.WA_CLOUD_ACCESS_TOKEN?.trim();
    const envPhone = process.env.WA_CLOUD_PHONE_NUMBER_ID?.trim();
    const envWaba = process.env.WA_CLOUD_WABA_ID?.trim();
    if (envToken && envPhone && envWaba) {
      return { accessToken: envToken, phoneNumberId: envPhone, wabaId: envWaba, connectedAt: new Date(0) };
    }
    const { config } = await getCollections();
    const doc = await config.findOne({ _id: "default" });
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return rest;
  }

  async ensureInitialized() {
    if (this.state.status === "ready") return;
    if (this.initializing) return this.initializing;
    this.initializing = this.initialize().finally(() => {
      this.initializing = null;
    });
    return this.initializing;
  }

  private scheduleRetry() {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.ensureInitialized();
    }, RETRY_DELAY_MS);
  }

  private async initialize() {
    this.setState({ status: "initializing", error: null });
    try {
      this.config = await this.loadConfig();
      if (!this.config) {
        const onboarding = this.onboardingInfo();
        this.setState({
          status: "disconnected",
          onboarding,
          error: onboarding
            ? null
            : "WhatsApp Cloud API is not connected and META_APP_ID / META_EMBEDDED_SIGNUP_CONFIG_ID are not set on the WhatsApp service.",
        });
        return;
      }

      const phone = await graphRequest<{ display_phone_number?: string; verified_name?: string }>(
        this.config.accessToken,
        "GET",
        this.config.phoneNumberId,
        { query: { fields: "display_phone_number,verified_name" } },
      );
      this.businessPhoneDigits = digitsOnly(phone.display_phone_number ?? "");

      try {
        const profile = await graphRequest<{ data?: Array<{ profile_picture_url?: string }> }>(
          this.config.accessToken,
          "GET",
          `${this.config.phoneNumberId}/whatsapp_business_profile`,
          { query: { fields: "profile_picture_url" } },
        );
        this.businessAvatarUrl = profile.data?.[0]?.profile_picture_url ?? null;
      } catch {
        this.businessAvatarUrl = null;
      }

      this.setState({
        status: "ready",
        error: null,
        onboarding: null,
        clientInfo: {
          pushname: phone.verified_name ?? null,
          wid: phone.display_phone_number ?? null,
          platform: "cloud-api",
        },
      });
      LOG("Connected as", phone.verified_name, phone.display_phone_number);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const tokenInvalid = error instanceof CloudApiError && error.code === 190;
      LOG("Initialization failed:", message);
      this.setState({
        status: "error",
        error: tokenInvalid
          ? "The WhatsApp access token is invalid or expired. Reconnect WhatsApp."
          : message,
        onboarding: tokenInvalid ? this.onboardingInfo() : this.state.onboarding,
      });
      if (!tokenInvalid) this.scheduleRetry();
    }
  }

  private requireReady() {
    if (this.state.status !== "ready" || !this.config) {
      throw new CloudApiError("WhatsApp is not connected.", 503);
    }
    return this.config;
  }

  // ---- Onboarding (Embedded Signup, WhatsApp Business app coexistence) ----

  async completeSignup(input: { code: string; phoneNumberId: string; wabaId: string }) {
    const appId = process.env.META_APP_ID?.trim();
    const appSecret = process.env.META_APP_SECRET?.trim();
    if (!appId || !appSecret) {
      throw new CloudApiError("META_APP_ID and META_APP_SECRET must be set on the WhatsApp service.", 500);
    }

    const accessToken = await exchangeSignupCode(appId, appSecret, input.code);
    // Without this subscription Meta delivers no webhooks for the number.
    await graphRequest(accessToken, "POST", `${input.wabaId}/subscribed_apps`);

    const { config } = await getCollections();
    await config.updateOne(
      { _id: "default" },
      {
        $set: {
          accessToken,
          phoneNumberId: input.phoneNumberId,
          wabaId: input.wabaId,
          connectedAt: new Date(),
          historySyncRequestedAt: null,
        },
      },
      { upsert: true },
    );

    this.state = { ...this.state, status: "idle" };
    await this.ensureInitialized();
    const sync = await this.requestHistorySync().catch((error: unknown) => ({
      error: error instanceof Error ? error.message : String(error),
    }));
    return { state: this.state, sync };
  }

  // Asks Meta to send the phone's contacts and chat history (up to ~6 months)
  // via the smb_app_state_sync / history webhooks. Only allowed within 24h
  // of onboarding.
  async requestHistorySync() {
    const config = this.requireReady();
    const results: Record<string, string> = {};
    for (const syncType of ["smb_app_state_sync", "history"] as const) {
      try {
        await graphRequest(config.accessToken, "POST", `${config.phoneNumberId}/smb_app_data`, {
          body: { messaging_product: "whatsapp", sync_type: syncType },
        });
        results[syncType] = "requested";
      } catch (error) {
        results[syncType] = error instanceof Error ? error.message : String(error);
      }
    }
    const { config: configCollection } = await getCollections();
    await configCollection.updateOne(
      { _id: "default" },
      { $set: { historySyncRequestedAt: new Date() } },
    );
    LOG("History sync request:", results);
    return results;
  }

  // ---- Webhooks ----

  handleWebhook(body: WebhookBody) {
    // Serialise processing so status updates never race their own message.
    this.webhookQueue = this.webhookQueue
      .then(() => this.processWebhook(body))
      .catch((error) => LOG("Webhook processing failed:", error));
    return this.webhookQueue;
  }

  private async processWebhook(body: WebhookBody) {
    if (body.object !== "whatsapp_business_account") return;
    if (!this.config) this.config = await this.loadConfig().catch(() => null);

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const phoneNumberId = value.metadata?.phone_number_id;
        if (this.config && phoneNumberId && phoneNumberId !== this.config.phoneNumberId) {
          continue;
        }
        const businessDigits =
          digitsOnly(value.metadata?.display_phone_number ?? "") || this.businessPhoneDigits;

        switch (change.field) {
          case "messages":
            for (const contact of value.contacts ?? []) {
              if (contact.wa_id && contact.profile?.name) {
                await this.setProfileName(contact.wa_id, contact.profile.name);
              }
            }
            for (const message of value.messages ?? []) {
              if (message.group_id || !message.from) continue;
              await this.storeMessage(message, message.from, false, "webhook");
            }
            for (const status of value.statuses ?? []) {
              await this.applyStatus(status);
            }
            break;
          case "smb_message_echoes":
            // Sent from the WhatsApp Business app on the phone.
            for (const message of value.message_echoes ?? []) {
              if (message.group_id || !message.to) continue;
              await this.storeMessage(message, message.to, true, "echo");
            }
            break;
          case "history":
            for (const chunk of value.history ?? []) {
              if (chunk.errors?.length) {
                LOG("History sync error:", chunk.errors);
              }
              for (const thread of chunk.threads ?? []) {
                if (!thread.id || isGroupId(thread.id)) continue;
                for (const message of thread.messages ?? []) {
                  const fromMe = Boolean(businessDigits) && digitsOnly(message.from ?? "") === businessDigits;
                  await this.storeMessage(message, thread.id, fromMe, "history");
                }
              }
              LOG("History chunk stored", chunk.metadata ?? {});
            }
            publishWhatsAppEvent("chats-updated", { chatId: "history" });
            break;
          case "smb_app_state_sync":
            for (const item of value.state_sync ?? []) {
              if (item.type !== "contact" || !item.contact?.phone_number) continue;
              await this.applyContact(
                digitsOnly(item.contact.phone_number),
                item.action === "remove" ? null : item.contact.full_name || item.contact.first_name || null,
              );
            }
            break;
          default:
            break;
        }
      }
    }
  }

  private async setProfileName(waId: string, name: string) {
    const { chats } = await getCollections();
    await chats.updateOne({ _id: digitsOnly(waId) }, { $set: { profileName: name } }, { upsert: true });
    this.bumpChats();
  }

  private async applyContact(waId: string, name: string | null) {
    if (!waId) return;
    const { chats, contacts } = await getCollections();
    if (name) {
      await contacts.updateOne({ _id: waId }, { $set: { name, updatedAt: new Date() } }, { upsert: true });
    } else {
      await contacts.deleteOne({ _id: waId });
    }
    await chats.updateOne({ _id: waId }, { $set: { contactName: name } });
    this.bumpChats();
  }

  private async storeMessage(
    message: WaMessage,
    counterpart: string,
    fromMe: boolean,
    source: CloudMessageDoc["source"],
  ) {
    const parsed = parseWaMessage(message);
    if (!parsed || !message.id) return;

    const chatId = digitsOnly(counterpart);
    if (!chatId) return;
    const timestamp = Number(message.timestamp ?? 0) * 1000 || Date.now();
    const { chats, contacts, messages } = await getCollections();

    let quoted: Pick<CloudMessageDoc, "quotedMessageId" | "quotedMessageBody" | "quotedMessageAuthor"> = {};
    if (message.context?.id) {
      const original = await messages.findOne({ _id: message.context.id });
      quoted = {
        quotedMessageId: message.context.id,
        quotedMessageBody: original
          ? mediaPreview(original.type, original.body, original.media?.filename)
          : null,
        quotedMessageAuthor: original ? (original.fromMe ? "You" : null) : null,
      };
    }

    const doc: CloudMessageDoc = {
      _id: message.id,
      chatId,
      body: parsed.body,
      timestamp,
      fromMe,
      type: parsed.type,
      ack: fromMe ? (source === "history" ? historyAck(message.history_context?.status) : ACK.sent) : ACK.pending,
      media: parsed.media,
      ...quoted,
      source,
    };

    const inserted = await messages.updateOne({ _id: doc._id }, { $setOnInsert: doc }, { upsert: true });
    if (!inserted.upsertedCount) return; // duplicate delivery
    this.bumpMessages(chatId);

    const existingChat = await chats.findOne({ _id: chatId });
    const update: Record<string, unknown> = {};
    if (!existingChat?.timestamp || timestamp >= existingChat.timestamp) {
      update.lastMessage = mediaPreview(parsed.type, parsed.body, parsed.media?.filename);
      update.timestamp = timestamp;
    }
    if (!existingChat?.contactName) {
      const contact = await contacts.findOne({ _id: chatId });
      if (contact) update.contactName = contact.name;
    }
    const counters: Record<string, number> = {};
    if (!fromMe) {
      if (!existingChat?.lastInboundAt || timestamp > existingChat.lastInboundAt) {
        update.lastInboundAt = timestamp;
      }
      if (source === "webhook") counters.unreadCount = 1;
    } else if (source === "echo") {
      // Replying from the phone means the chat was read there.
      update.unreadCount = 0;
    }
    const chat = await chats.findOneAndUpdate(
      { _id: chatId },
      {
        ...(Object.keys(update).length ? { $set: update } : {}),
        ...(Object.keys(counters).length ? { $inc: counters } : {}),
        ...(!Object.keys(update).length && !Object.keys(counters).length
          ? { $setOnInsert: { unreadCount: 0 } }
          : {}),
      },
      { upsert: true, returnDocument: "after" },
    );
    this.bumpChats();

    if (source !== "history") {
      if (parsed.media?.id) this.queueMediaDownload(doc._id, parsed.media.id);
      publishWhatsAppEvent("message", {
        chatId: toChatId(chatId),
        chat: chat ? this.toChatSummary(chat) : undefined,
        message: this.toMessage(doc),
      });
      if (!existingChat) publishWhatsAppEvent("chats-updated", { chatId: toChatId(chatId) });
    }
  }

  private async applyStatus(status: WaStatus) {
    const ack = ACK[(status.status ?? "") as keyof typeof ACK];
    if (ack === undefined) return;
    const { messages } = await getCollections();

    const error = status.errors?.length
      ? status.errors.map((e) => e.error_data?.details || e.message || e.title).filter(Boolean).join("; ")
      : null;
    const result = await messages.findOneAndUpdate(
      { _id: status.id },
      ack === ACK.failed ? { $set: { ack, error } } : { $max: { ack } },
      { returnDocument: "after" },
    );
    if (result) {
      this.bumpMessages(result.chatId);
      publishWhatsAppEvent("messages-updated", { chatId: toChatId(result.chatId) });
    }
  }

  // ---- Media ----

  private queueMediaDownload(messageId: string, mediaId: string) {
    this.mediaQueue = this.mediaQueue
      .then(() => this.fetchAndStoreMedia(messageId, mediaId))
      .then(() => undefined)
      .catch((error) => LOG("Media download failed:", messageId, String(error)));
  }

  private async fetchAndStoreMedia(messageId: string, mediaId: string) {
    const config = this.config ?? (await this.loadConfig());
    if (!config) throw new CloudApiError("WhatsApp is not connected.", 503);
    const { buffer, mimetype } = await downloadMedia(config.accessToken, mediaId);
    await this.saveMediaFile(messageId, buffer, mimetype);
    return { buffer, mimetype };
  }

  private async saveMediaFile(messageId: string, buffer: Buffer, mimetype: string) {
    await fs.mkdir(mediaDir, { recursive: true });
    const localFile = safeFileName(messageId);
    await fs.writeFile(path.join(mediaDir, localFile), buffer);
    const { messages } = await getCollections();
    const updated = await messages.findOneAndUpdate(
      { _id: messageId },
      { $set: { "media.localFile": localFile, "media.mimetype": mimetype } },
      { projection: { chatId: 1 } },
    );
    if (updated) this.bumpMessages(updated.chatId);
  }

  async getMedia(messageId: string) {
    const { messages } = await getCollections();
    const doc = await messages.findOne({ _id: messageId });
    if (!doc?.media) throw new CloudApiError("Media not found.", 404);

    if (doc.media.localFile) {
      try {
        const buffer = await fs.readFile(path.join(mediaDir, doc.media.localFile));
        return {
          data: buffer.toString("base64"),
          mimetype: doc.media.mimetype || "application/octet-stream",
          filename: doc.media.filename || undefined,
        };
      } catch {
        // Fall through and re-download.
      }
    }
    if (!doc.media.id) throw new CloudApiError("Media is not available.", 404);
    const { buffer, mimetype } = await this.fetchAndStoreMedia(messageId, doc.media.id);
    return { data: buffer.toString("base64"), mimetype, filename: doc.media.filename || undefined };
  }

  // ---- Reads ----

  private toChatSummary(chat: CloudChatDoc): WhatsAppChatSummary {
    const name = chat.contactName || chat.profileName || `+${chat._id}`;
    return {
      id: toChatId(chat._id),
      name,
      phoneNumber: `+${chat._id}`,
      lastMessage: chat.lastMessage ?? "",
      timestamp: chat.timestamp ?? null,
      unreadCount: chat.unreadCount ?? 0,
      avatarSeed: name,
      avatarUrl: null,
      isGroup: false,
      isMuted: false,
      isPinned: false,
      windowExpiresAt: chat.lastInboundAt ? chat.lastInboundAt + SERVICE_WINDOW_MS : null,
    };
  }

  private toMessage(doc: CloudMessageDoc): WhatsAppMessage {
    return {
      id: doc._id,
      chatId: toChatId(doc.chatId),
      body: doc.body,
      timestamp: doc.timestamp,
      fromMe: doc.fromMe,
      author: null,
      ack: doc.ack,
      hasMedia: Boolean(doc.media),
      mediaType: doc.type,
      mimetype: doc.media?.mimetype ?? null,
      filename: doc.media?.filename ?? null,
      quotedMessageId: doc.quotedMessageId ?? null,
      quotedMessageBody: doc.quotedMessageBody ?? null,
      quotedMessageAuthor: doc.quotedMessageAuthor ?? null,
      error: doc.error ?? null,
    };
  }

  async getPaginatedChats(search = "", page = 1, pageSize = 50) {
    this.requireReady();
    const { chats, contacts } = await getCollections();
    const term = search.trim();

    if (!term) {
      return this.cached(`chats:${page}:${pageSize}`, String(this.chatsVersion), async () => {
        const docs = await chats
          .find({ timestamp: { $ne: null } })
          .sort({ timestamp: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .toArray();
        return docs.map((doc) => this.toChatSummary(doc));
      });
    }

    const limit = page * pageSize;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const digits = digitsOnly(term);
    const nameRegex = new RegExp(escaped, "i");
    const chatFilter = {
      $or: [
        { contactName: nameRegex },
        { profileName: nameRegex },
        ...(digits.length >= 3 ? [{ _id: new RegExp(digits) }] : []),
      ],
    };
    const chatDocs = await chats.find(chatFilter).sort({ timestamp: -1 }).limit(limit).toArray();
    const results = chatDocs.map((doc) => this.toChatSummary(doc));
    const seen = new Set(chatDocs.map((doc) => doc._id));

    // Saved phone contacts without a conversation yet, so a new chat can be
    // started from search (it opens with the template picker).
    const contactDocs = await contacts
      .find({ $or: [{ name: nameRegex }, ...(digits.length >= 3 ? [{ _id: new RegExp(digits) }] : [])] })
      .limit(limit)
      .toArray();
    for (const contact of contactDocs) {
      if (seen.has(contact._id)) continue;
      seen.add(contact._id);
      results.push(this.toChatSummary({ _id: contact._id, contactName: contact.name }));
    }

    // A typed phone number that matches nothing becomes a new-chat entry.
    if (digits.length >= 10 && digits.length === term.replace(/[\s+()-]/g, "").length) {
      try {
        const waId = toWaId(digits);
        if (!seen.has(waId)) results.unshift(this.toChatSummary({ _id: waId }));
      } catch {
        // not a valid number
      }
    }

    return results.slice((page - 1) * pageSize, limit);
  }

  async listMessages(chatId: string, limit = 80) {
    this.requireReady();
    const waId = toWaId(chatId);
    const { chats, messages } = await getCollections();
    const docs = await this.cached(
      `messages:${waId}:${limit}`,
      String(this.messageVersions.get(waId) ?? 0),
      () => messages.find({ chatId: waId }).sort({ timestamp: -1 }).limit(limit).toArray(),
    );

    const chat = await this.cached(`chat:${waId}`, String(this.chatsVersion), () =>
      chats.findOne({ _id: waId }, { projection: { unreadCount: 1 } }),
    );
    if (chat?.unreadCount) {
      // Only the first viewer clears it; the others see the bumped version.
      const cleared = await chats.updateOne(
        { _id: waId, unreadCount: { $gt: 0 } },
        { $set: { unreadCount: 0 } },
      );
      this.bumpChats();
      if (cleared.modifiedCount) {
        const lastInbound = docs.find((doc) => !doc.fromMe && doc.source === "webhook");
        if (lastInbound) void this.markRead(lastInbound._id);
      }
    }

    return [...docs].reverse().map((doc) => this.toMessage(doc));
  }

  private async markRead(messageId: string) {
    try {
      const config = this.requireReady();
      await graphRequest(config.accessToken, "POST", `${config.phoneNumberId}/messages`, {
        body: { messaging_product: "whatsapp", status: "read", message_id: messageId },
      });
    } catch (error) {
      LOG("Mark read failed:", String(error));
    }
  }

  // ---- Sending ----

  private async recordOutgoing(doc: CloudMessageDoc) {
    const { chats, messages } = await getCollections();
    await messages.updateOne({ _id: doc._id }, { $setOnInsert: doc }, { upsert: true });
    this.bumpMessages(doc.chatId);
    const chat = await chats.findOneAndUpdate(
      { _id: doc.chatId },
      {
        $set: {
          lastMessage: mediaPreview(doc.type, doc.body, doc.media?.filename),
          timestamp: doc.timestamp,
          unreadCount: 0,
        },
      },
      { upsert: true, returnDocument: "after" },
    );
    this.bumpChats();
    const message = this.toMessage(doc);
    publishWhatsAppEvent("message", {
      chatId: message.chatId,
      chat: chat ? this.toChatSummary(chat) : undefined,
      message,
    });
    return message;
  }

  private async quotedFields(quotedMessageId?: string) {
    if (!quotedMessageId) return {};
    const { messages } = await getCollections();
    const original = await messages.findOne({ _id: quotedMessageId });
    if (!original) return {};
    return {
      quotedMessageId,
      quotedMessageBody: mediaPreview(original.type, original.body, original.media?.filename),
      quotedMessageAuthor: original.fromMe ? "You" : null,
    };
  }

  private async postMessage(config: Omit<CloudConfigDoc, "_id">, payload: Record<string, unknown>) {
    const response = await graphRequest<{ messages?: Array<{ id?: string }> }>(
      config.accessToken,
      "POST",
      `${config.phoneNumberId}/messages`,
      { body: { messaging_product: "whatsapp", recipient_type: "individual", ...payload } },
    );
    const id = response.messages?.[0]?.id;
    if (!id) throw new CloudApiError("WhatsApp did not return a message id.", 502);
    return id;
  }

  async sendMessage(
    chatId: string,
    body: string,
    media?: { data: string; mimetype: string; filename: string },
    quotedMessageId?: string,
  ) {
    const config = this.requireReady();
    const waId = toWaId(chatId);
    const { chats } = await getCollections();
    const chat = await chats.findOne({ _id: waId });
    if (!chat?.lastInboundAt || Date.now() > chat.lastInboundAt + SERVICE_WINDOW_MS) {
      throw new CloudApiError(
        "The 24-hour reply window is closed. Send an approved template message to restart the conversation.",
        422,
      );
    }

    const context = quotedMessageId?.startsWith("wamid.") ? { context: { message_id: quotedMessageId } } : {};
    const quoted = await this.quotedFields(quotedMessageId);
    const text = body.trim();

    if (!media) {
      const id = await this.postMessage(config, {
        to: waId,
        type: "text",
        text: { body: text, preview_url: true },
        ...context,
      });
      return this.recordOutgoing({
        _id: id,
        chatId: waId,
        body: text,
        timestamp: Date.now(),
        fromMe: true,
        type: "chat",
        ack: ACK.pending,
        media: null,
        ...quoted,
        source: "api",
      });
    }

    const base64 = media.data.includes(",") ? media.data.slice(media.data.indexOf(",") + 1) : media.data;
    const buffer = Buffer.from(base64, "base64");
    const mimetype = media.mimetype.split(";")[0]!.trim() || "application/octet-stream";
    const sendType = sendTypeForMimetype(mimetype);

    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", mimetype);
    form.append("file", new Blob([buffer], { type: mimetype }), media.filename);
    const upload = await graphRequest<{ id?: string }>(config.accessToken, "POST", `${config.phoneNumberId}/media`, {
      body: form,
    });
    if (!upload.id) throw new CloudApiError("WhatsApp did not accept the file.", 502);

    // Audio messages cannot carry a caption; send the text separately.
    const caption = sendType === "audio" ? "" : text;
    const mediaPayload: Record<string, unknown> = { id: upload.id };
    if (caption) mediaPayload.caption = caption;
    if (sendType === "document") mediaPayload.filename = media.filename;

    const id = await this.postMessage(config, { to: waId, type: sendType, [sendType]: mediaPayload, ...context });
    await this.saveMediaFile(id, buffer, mimetype);
    const message = await this.recordOutgoing({
      _id: id,
      chatId: waId,
      body: caption,
      timestamp: Date.now(),
      fromMe: true,
      type: sendType,
      ack: ACK.pending,
      media: { id: upload.id, mimetype, filename: media.filename, localFile: safeFileName(id) },
      ...quoted,
      source: "api",
    });

    if (sendType === "audio" && text) {
      await this.sendMessage(chatId, text);
    }
    return message;
  }

  async listTemplates(force = false) {
    const config = this.requireReady();
    if (!force && this.templatesCache && Date.now() - this.templatesCache.at < TEMPLATE_CACHE_MS) {
      return this.templatesCache.templates;
    }
    const response = await graphRequest<{ data?: GraphTemplate[] }>(
      config.accessToken,
      "GET",
      `${config.wabaId}/message_templates`,
      { query: { fields: "name,language,status,category,parameter_format,components", limit: "250" } },
    );

    const templates: WhatsAppTemplate[] = [];
    for (const template of response.data ?? []) {
      if (template.status !== "APPROVED") continue;
      const components = template.components ?? [];
      const header = components.find((c) => c.type === "HEADER");
      const body = components.find((c) => c.type === "BODY");
      const footer = components.find((c) => c.type === "FOOTER");
      const buttons = components.find((c) => c.type === "BUTTONS");
      // Media headers and dynamic URL buttons need extra inputs the admin
      // picker does not collect, so those templates are left out.
      if (header && header.format && header.format !== "TEXT") continue;
      if (buttons?.buttons?.some((b) => b.url?.includes("{{"))) continue;

      templates.push({
        name: template.name,
        language: template.language,
        category: template.category,
        headerText: header?.text ?? null,
        bodyText: body?.text ?? "",
        footerText: footer?.text ?? null,
        parameterFormat: template.parameter_format === "NAMED" ? "NAMED" : "POSITIONAL",
        headerParams: placeholders(header?.text),
        bodyParams: placeholders(body?.text),
      });
    }
    templates.sort((a, b) => a.name.localeCompare(b.name));
    this.templatesCache = { at: Date.now(), templates };
    return templates;
  }

  async sendTemplate(input: {
    chatId: string;
    name: string;
    language: string;
    headerValues?: string[];
    bodyValues?: string[];
  }) {
    const config = this.requireReady();
    const waId = toWaId(input.chatId);
    const template = (await this.listTemplates()).find(
      (t) => t.name === input.name && t.language === input.language,
    );
    if (!template) throw new CloudApiError("Template not found or not approved.", 404);

    const headerValues = (input.headerValues ?? []).map((v) => String(v ?? "").trim());
    const bodyValues = (input.bodyValues ?? []).map((v) => String(v ?? "").trim());
    if (
      template.headerParams.some((_, i) => !headerValues[i]) ||
      template.bodyParams.some((_, i) => !bodyValues[i])
    ) {
      throw new CloudApiError("Fill in every template field.", 400);
    }

    const toParameters = (names: string[], values: string[]) =>
      names.map((name, index) => ({
        type: "text",
        text: values[index],
        ...(template.parameterFormat === "NAMED" ? { parameter_name: name } : {}),
      }));
    const components = [
      ...(template.headerParams.length
        ? [{ type: "header", parameters: toParameters(template.headerParams, headerValues) }]
        : []),
      ...(template.bodyParams.length
        ? [{ type: "body", parameters: toParameters(template.bodyParams, bodyValues) }]
        : []),
    ];

    const id = await this.postMessage(config, {
      to: waId,
      type: "template",
      template: {
        name: template.name,
        language: { code: template.language },
        ...(components.length ? { components } : {}),
      },
    });

    const rendered = [
      template.headerText ? renderTemplateText(template.headerText, template.headerParams, headerValues) : null,
      renderTemplateText(template.bodyText, template.bodyParams, bodyValues),
      template.footerText,
    ]
      .filter(Boolean)
      .join("\n\n");

    return this.recordOutgoing({
      _id: id,
      chatId: waId,
      body: rendered,
      timestamp: Date.now(),
      fromMe: true,
      type: "chat",
      ack: ACK.pending,
      media: null,
      source: "api",
    });
  }

  async editMessage(_messageId: string, _body: string): Promise<WhatsAppMessage> {
    throw new CloudApiError("The WhatsApp Cloud API cannot edit sent messages. Edit it from the phone.", 422);
  }

  async deleteMessage(_messageId: string, _everyone = true): Promise<Record<string, unknown>> {
    throw new CloudApiError("The WhatsApp Cloud API cannot delete sent messages. Delete it from the phone.", 422);
  }

  // ---- Avatars (Cloud API exposes only the business's own picture) ----

  async getChatAvatarUrlById(chatId: string) {
    const digits = digitsOnly(chatId.split("@")[0] ?? "");
    return digits && digits === this.businessPhoneDigits ? this.businessAvatarUrl : null;
  }

  async getChatAvatarUrlsByIds(chatIds: string[]) {
    const urls: Record<string, string | null> = {};
    for (const chatId of chatIds) urls[chatId] = await this.getChatAvatarUrlById(chatId);
    return urls;
  }

  // ---- Lifecycle (nothing to tear down: there is no browser session) ----

  async logout() {
    // Deliberately a no-op: disconnecting would require re-onboarding the
    // number through Meta. Disconnect from Meta Business Suite instead.
  }

  async forceClearSession() {}

  resetClient() {}

  async shutdownClient() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }
}

export const cloudWhatsAppService = new CloudWhatsAppService();
export type { CloudWhatsAppService };
