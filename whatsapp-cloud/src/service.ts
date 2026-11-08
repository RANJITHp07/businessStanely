
import { readMedia, storeMedia } from "./media-store.js";
import { publishWhatsAppEvent } from "./realtime.js";
import { groupsBridgeEnabled, groupsHealth, groupsRequest, webDirectEnabled, type GroupsHealth } from "./groups-bridge.js";
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
  inspectToken,
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
const TOKEN_RETRY_DELAY_MS = 5 * 60 * 1000;
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

// Group chats are stored under "<group_id>@g.us"; individual chats under the
// bare wa_id digits.
function isGroupKey(value: string) {
  return value.endsWith("@g.us");
}

function groupKey(groupId: string) {
  const id = groupId.trim().replace(/@g\.us$/, "");
  return id ? `${id}@g.us` : "";
}

function groupIdFromKey(key: string) {
  return key.replace(/@g\.us$/, "");
}

// Accepts "<group_id>@g.us" (returned as-is), "919876543210@c.us",
// "+91 98765 43210" or a bare 10-digit Indian number (returned as the wa_id
// digits Cloud API uses).
function toChatKey(chatId: string) {
  const raw = chatId.trim();
  if (isGroupKey(raw)) {
    const key = groupKey(raw);
    if (!key) throw new CloudApiError("Invalid WhatsApp group.", 400);
    return key;
  }
  return toWaId(raw);
}

function toWaId(chatId: string) {
  const raw = chatId.trim();
  let digits = digitsOnly(raw.split("@")[0] ?? "");
  if (digits.length === 10 && defaultCountryCode) {
    digits = `${defaultCountryCode}${digits}`;
  }
  if (digits.length < 8 || digits.length > 15) {
    throw new CloudApiError("Invalid WhatsApp number.", 400);
  }
  return digits;
}

function toChatId(key: string) {
  return isGroupKey(key) ? key : `${key}@c.us`;
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

  // `this.state` is the Meta (1:1) side only. What the panels see combines it
  // with the groups side: if either works the panel opens, and the broken
  // side is reported in `error` / `channels` instead of blocking everything.
  private groups: GroupsHealth | null = null;
  private retryAt = 0;
  private groupsTimer: NodeJS.Timeout | null = null;

  getState(): WhatsAppState {
    const meta = this.state;
    const channels = {
      meta: { status: meta.status, error: meta.error },
      groups: groupsBridgeEnabled ? this.groups ?? { status: "unknown", error: null, linkedAs: null } : null,
    };
    const groupsReady = channels.groups?.status === "ready";
    if (webDirectEnabled) {
      // Everything runs on the linked device; Meta is not used.
      const linked = channels.groups;
      return {
        ...meta,
        status: groupsReady ? "ready" : "disconnected",
        error: groupsReady
          ? null
          : linked?.error ?? `WhatsApp is not linked (${linked?.status ?? "unknown"}). Scan the QR to link the phone.`,
        onboarding: null,
        clientInfo: {
          pushname: "WhatsApp",
          wid: linked?.linkedAs ? `+${linked.linkedAs.split(":")[0]!.split("@")[0]}` : null,
          platform: "cloud-api",
        },
        capabilities: { editMessages: false, deleteMessages: false, ...meta.capabilities, logout: true, templates: false },
        channels: { meta: { status: "disconnected", error: "Not used: chats go through the linked phone." }, groups: linked },
      };
    }
    if (meta.status === "ready") {
      const groupsProblem =
        groupsBridgeEnabled && !groupsReady
          ? `Group chats are not working (${channels.groups?.status}). ${channels.groups?.error ?? "Link the groups device again."}`
          : null;
      return { ...meta, error: meta.error ?? groupsProblem, channels };
    }
    if (groupsReady) {
      return {
        ...meta,
        status: "ready",
        error: `1:1 chats (Meta Cloud API) are not working: ${meta.error ?? meta.status}`,
        clientInfo: {
          pushname: meta.clientInfo.pushname ?? "WhatsApp groups",
          wid: meta.clientInfo.wid ?? channels.groups?.linkedAs ?? "groups",
          platform: "cloud-api",
        },
        channels,
      };
    }
    return { ...meta, channels };
  }

  private setState(patch: Partial<WhatsAppState>) {
    this.state = { ...this.state, ...patch, lastUpdatedAt: new Date().toISOString() };
    publishWhatsAppEvent("state", { state: this.getState() });
  }

  // Polls the groups service so its health shows up in /status and the stream.
  // Re-reads the groups link health and publishes the state if it changed.
  async refreshGroupsHealth() {
    if (!groupsBridgeEnabled) return;
    const next = await groupsHealth();
    const changed =
      !this.groups || this.groups.status !== next.status || this.groups.linkedAs !== next.linkedAs;
    this.groups = next;
    if (changed) {
      LOG("Groups service:", next.status, next.error ?? "");
      this.state = { ...this.state, lastUpdatedAt: new Date().toISOString() };
      publishWhatsAppEvent("state", { state: this.getState() });
    }
  }

  startGroupsMonitor(intervalMs = 15000) {
    if (!groupsBridgeEnabled || this.groupsTimer) return;
    void this.refreshGroupsHealth();
    this.groupsTimer = setInterval(() => void this.refreshGroupsHealth(), intervalMs);
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
    // Not connected yet: nothing changes until onboarding saves a config (which
    // resets the state to "idle"). Re-running here would flip every /status
    // poll to "initializing" and hide the Connect button.
    if (this.state.status === "disconnected") return;
    if (this.initializing) return this.initializing;
    // After a failure, /status and /stream polls must not re-hit Meta every
    // time (and flip the state back to "initializing"); the scheduled retry
    // does that. Onboarding resets the state to "idle", which skips this.
    if (this.state.status === "error" && Date.now() < this.retryAt) return;
    this.initializing = this.initialize().finally(() => {
      this.initializing = null;
    });
    return this.initializing;
  }

  private scheduleRetry(delayMs = RETRY_DELAY_MS) {
    if (this.retryTimer) return;
    this.retryAt = Date.now() + delayMs;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.ensureInitialized();
    }, delayMs);
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
      // An invalid token will not fix itself quickly; check again every 5 min
      // (a new token in .env needs a restart, the Connect flow applies at once).
      this.scheduleRetry(tokenInvalid ? TOKEN_RETRY_DELAY_MS : RETRY_DELAY_MS);
    }
  }

  private requireReady() {
    if (this.state.status !== "ready" || !this.config) {
      throw new CloudApiError(
        `1:1 chats (Meta Cloud API) are not connected${this.state.error ? `: ${this.state.error}` : "."}`,
        503,
      );
    }
    return this.config;
  }

  // ---- Onboarding (Embedded Signup, WhatsApp Business app coexistence) ----

  async completeSignup(input: { code: string; phoneNumberId?: string; wabaId?: string; redirectUris?: string[] }) {
    const appId = process.env.META_APP_ID?.trim();
    const appSecret = process.env.META_APP_SECRET?.trim();
    if (!appId || !appSecret) {
      throw new CloudApiError("META_APP_ID and META_APP_SECRET must be set on the WhatsApp service.", 500);
    }

    const accessToken = await exchangeSignupCode(appId, appSecret, input.code, input.redirectUris);

    const tokenInfo = await inspectToken(appId, appSecret, accessToken).catch((error: unknown) => {
      console.warn("[WhatsApp Cloud] Could not inspect the signup token:", error);
      return null;
    });
    if (tokenInfo) {
      console.log(
        `[WhatsApp Cloud] Signup token expires: ${
          tokenInfo.expiresAt ? new Date(tokenInfo.expiresAt * 1000).toISOString() : "never"
        }; scopes: ${tokenInfo.scopes.join(", ")}; WhatsApp accounts: ${tokenInfo.wabaIds.join(", ") || "none"}`,
      );
    }

    // Meta does not always send the session message with the ids; then find
    // them from what the token was granted.
    let wabaId = input.wabaId?.trim() || "";
    let phoneNumberId = input.phoneNumberId?.trim() || "";
    if (!wabaId) {
      wabaId = tokenInfo?.wabaIds[0] ?? "";
      if (!wabaId) {
        throw new CloudApiError(
          "This Meta login did not give access to a WhatsApp Business account. Use a WhatsApp Embedded Signup configuration and pick the WhatsApp account during the login.",
          422,
        );
      }
    }
    if (!phoneNumberId) {
      const numbers = await graphRequest<{ data?: Array<{ id: string; display_phone_number?: string }> }>(
        accessToken,
        "GET",
        `${wabaId}/phone_numbers`,
        { query: { fields: "id,display_phone_number" } },
      );
      phoneNumberId = numbers.data?.[0]?.id ?? "";
      if (!phoneNumberId) {
        throw new CloudApiError(`The WhatsApp Business account ${wabaId} has no phone number.`, 422);
      }
      console.log(
        `[WhatsApp Cloud] Signup used WhatsApp account ${wabaId}, number ${numbers.data?.[0]?.display_phone_number ?? phoneNumberId}`,
      );
    }

    // Without this subscription Meta delivers no webhooks for the number.
    await graphRequest(accessToken, "POST", `${wabaId}/subscribed_apps`);

    const { config } = await getCollections();
    await config.updateOne(
      { _id: "default" },
      {
        $set: {
          accessToken,
          phoneNumberId,
          wabaId,
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
              if (!message.from) continue;
              // With the groups bridge on, groups come from the linked device.
              if (message.group_id && groupsBridgeEnabled) continue;
              if (message.group_id) {
                const sender = digitsOnly(message.from);
                const profile = value.contacts?.find((c) => digitsOnly(c.wa_id ?? "") === sender);
                await this.storeMessage(message, groupKey(message.group_id), false, "webhook", {
                  author: await this.participantName(sender, profile?.profile?.name),
                });
              } else {
                await this.storeMessage(message, message.from, false, "webhook");
              }
            }
            for (const status of value.statuses ?? []) {
              await this.applyStatus(status);
            }
            break;
          case "smb_message_echoes":
            // Sent from the WhatsApp Business app on the phone.
            for (const message of value.message_echoes ?? []) {
              if (message.group_id && groupsBridgeEnabled) continue;
              if (message.group_id) {
                await this.storeMessage(message, groupKey(message.group_id), true, "echo");
              } else if (message.to) {
                await this.storeMessage(message, message.to, true, "echo");
              }
            }
            break;
          case "history":
            for (const chunk of value.history ?? []) {
              if (chunk.errors?.length) {
                LOG("History sync error:", chunk.errors);
              }
              for (const thread of chunk.threads ?? []) {
                if (!thread.id) continue;
                // Group thread ids look like "1203...@g.us" or "<phone>-<time>".
                const isGroupThread = thread.id.includes("@g.us") || thread.id.includes("-");
                if (isGroupThread && groupsBridgeEnabled) continue;
                const threadKey = isGroupThread ? groupKey(thread.id.split("@")[0]!) : thread.id;
                for (const message of thread.messages ?? []) {
                  const sender = digitsOnly(message.from ?? "");
                  const fromMe = Boolean(businessDigits) && sender === businessDigits;
                  await this.storeMessage(message, threadKey, fromMe, "history", {
                    author: isGroupThread && !fromMe && sender ? await this.participantName(sender) : null,
                  });
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

  // Name shown above a group message: saved contact, else WhatsApp profile
  // name, else the phone number.
  private async participantName(waId: string, profileName?: string | null) {
    if (!waId) return null;
    const { chats, contacts } = await getCollections();
    const contact = await contacts.findOne({ _id: waId });
    if (contact?.name) return contact.name;
    if (profileName) return profileName;
    const chat = await chats.findOne({ _id: waId }, { projection: { profileName: 1 } });
    return chat?.profileName || `+${waId}`;
  }

  // Groups API: GET /<group_id>?fields=subject. Best effort; groups the
  // business does not own (or older API versions) just keep the fallback name.
  private async fetchGroupSubject(key: string) {
    try {
      const config = this.config ?? (await this.loadConfig());
      if (!config) return null;
      const group = await graphRequest<{ subject?: string }>(config.accessToken, "GET", groupIdFromKey(key), {
        query: { fields: "subject" },
      });
      return group.subject?.trim() || null;
    } catch (error) {
      LOG("Group subject lookup failed:", key, String(error));
      return null;
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
    options: { author?: string | null; authorId?: string | null; groupSubject?: string | null } = {},
  ) {
    const parsed = parseWaMessage(message);
    if (!parsed || !message.id) return;

    const isGroup = isGroupKey(counterpart);
    const chatId = isGroup ? counterpart : digitsOnly(counterpart);
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
      author: options.author ?? null,
      ...(options.authorId ? { authorId: options.authorId } : {}),
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
    if (!isGroup && !existingChat?.contactName) {
      const contact = await contacts.findOne({ _id: chatId });
      if (contact) update.contactName = contact.name;
    }
    // groupSubject: the group name, or for a 1:1 chat from the linked device the
    // sender's profile name.
    if (options.groupSubject && options.groupSubject !== existingChat?.profileName) {
      update.profileName = options.groupSubject;
    } else if (isGroup && !existingChat?.profileName && !groupsBridgeEnabled) {
      const subject = await this.fetchGroupSubject(chatId);
      if (subject) update.profileName = subject;
    }
    const counters: Record<string, number> = {};
    if (!fromMe) {
      if (!existingChat?.lastInboundAt || timestamp > existingChat.lastInboundAt) {
        update.lastInboundAt = timestamp;
      }
      if (source === "webhook" || source === "web") counters.unreadCount = 1;
    } else if (source === "echo" || source === "web") {
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
    const stored = await storeMedia(messageId, buffer, mimetype);
    const { messages } = await getCollections();
    const updated = await messages.findOneAndUpdate(
      { _id: messageId },
      {
        $set: {
          "media.mimetype": mimetype,
          ...(stored.s3Key ? { "media.s3Key": stored.s3Key } : {}),
          ...(stored.localFile ? { "media.localFile": stored.localFile } : {}),
        },
      },
      { projection: { chatId: 1 } },
    );
    if (updated) this.bumpMessages(updated.chatId);
  }

  async getMedia(messageId: string) {
    const { messages } = await getCollections();
    const doc = await messages.findOne({ _id: messageId });
    if (!doc?.media) throw new CloudApiError("Media not found.", 404);

    // S3 first, then a local file (older uploads), else re-download from Meta.
    const storedBuffer = await readMedia(doc.media);
    if (storedBuffer) {
      return {
        data: storedBuffer.toString("base64"),
        mimetype: doc.media.mimetype || "application/octet-stream",
        filename: doc.media.filename || undefined,
      };
    }
    if (!doc.media.id) throw new CloudApiError("Media is not available.", 404);
    const { buffer, mimetype } = await this.fetchAndStoreMedia(messageId, doc.media.id);
    return { data: buffer.toString("base64"), mimetype, filename: doc.media.filename || undefined };
  }

  // ---- Reads ----

  private toChatSummary(chat: CloudChatDoc): WhatsAppChatSummary {
    const isGroup = isGroupKey(chat._id);
    const name = isGroup
      ? chat.profileName || chat.contactName || "WhatsApp group"
      : chat.contactName || chat.profileName || `+${chat._id}`;
    return {
      id: toChatId(chat._id),
      name,
      phoneNumber: isGroup ? null : `+${chat._id}`,
      lastMessage: chat.lastMessage ?? "",
      timestamp: chat.timestamp ?? null,
      unreadCount: chat.unreadCount ?? 0,
      avatarSeed: name,
      avatarUrl: null,
      isGroup,
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
      author: doc.author ?? null,
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
    // Reads come from MongoDB, so they work even while Meta is down.
    const { chats, contacts } = await getCollections();
    const term = search.trim();

    if (!term) {
      return this.cached(`chats:${page}:${pageSize}`, String(this.chatsVersion), async () => {
        // With the linked phone, every group is listed (like WhatsApp itself),
        // even before it has a message here; those sort last.
        const docs = await chats
          .find(webDirectEnabled ? {} : { timestamp: { $ne: null } })
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
    const waId = toChatKey(chatId);
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
        const lastInbound = docs.find((doc) => !doc.fromMe && (doc.source === "webhook" || doc.source === "web"));
        if (lastInbound?.source === "web") {
          void groupsRequest("/read", {
            chatId: waId,
            messageId: lastInbound._id,
            participant: lastInbound.authorId ?? null,
          }).catch((error) => LOG("Group mark read failed:", String(error)));
        } else if (lastInbound) {
          void this.markRead(lastInbound._id);
        }
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

  // `to` is a chat key: wa_id digits, or "<group_id>@g.us" for a group.
  private async postMessage(
    config: Omit<CloudConfigDoc, "_id">,
    { to, ...payload }: { to: string } & Record<string, unknown>,
  ) {
    const recipient = isGroupKey(to)
      ? { recipient_type: "group", to: groupIdFromKey(to) }
      : { recipient_type: "individual", to };
    const response = await graphRequest<{ messages?: Array<{ id?: string }> }>(
      config.accessToken,
      "POST",
      `${config.phoneNumberId}/messages`,
      { body: { messaging_product: "whatsapp", ...recipient, ...payload } },
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
    const waId = toChatKey(chatId);
    // Group sends (and 1:1 sends in direct-via-web mode) go to the linked
    // device and do not need Meta or the 24-hour window.
    if (groupsBridgeEnabled && (isGroupKey(waId) || webDirectEnabled)) {
      return this.sendGroupMessage(waId, body, media, quotedMessageId);
    }
    const config = this.requireReady();
    const { chats } = await getCollections();
    const chat = await chats.findOne({ _id: waId });
    // Groups are not gated by the 1:1 customer service window here; Meta
    // rejects the send itself if the group does not allow it.
    if (
      !isGroupKey(waId) &&
      (!chat?.lastInboundAt || Date.now() > chat.lastInboundAt + SERVICE_WINDOW_MS)
    ) {
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
    const stored = await storeMedia(id, buffer, mimetype);
    const message = await this.recordOutgoing({
      _id: id,
      chatId: waId,
      body: caption,
      timestamp: Date.now(),
      fromMe: true,
      type: sendType,
      ack: ACK.pending,
      media: { id: upload.id, mimetype, filename: media.filename, ...stored },
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
    if (webDirectEnabled) {
      throw new CloudApiError("Templates need the Meta Cloud API. Send a normal message instead.", 422);
    }
    const config = this.requireReady();
    const waId = toChatKey(input.chatId);
    if (isGroupKey(waId) && groupsBridgeEnabled) {
      throw new CloudApiError("Templates are for 1:1 chats. Send a normal message to the group.", 422);
    }
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

  // ---- Groups bridge (whatsapp-groups linked device) ----

  private async sendGroupMessage(
    key: string,
    body: string,
    media?: { data: string; mimetype: string; filename: string },
    quotedMessageId?: string,
  ) {
    const { messages } = await getCollections();
    const original = quotedMessageId ? await messages.findOne({ _id: quotedMessageId }) : null;
    const quoted = await this.quotedFields(quotedMessageId);
    const text = body.trim();
    const result = await groupsRequest<{ id: string; timestamp?: number; type?: string }>("/send", {
      chatId: key,
      body: text,
      media: media ?? null,
      quoted: original
        ? { id: original._id, body: original.body, fromMe: original.fromMe, participant: original.authorId ?? null }
        : null,
    });
    if (!result.id) throw new CloudApiError("The groups service did not return a message id.", 502);

    let storedMedia: CloudMessageDoc["media"] = null;
    let type = "chat";
    if (media) {
      const base64 = media.data.includes(",") ? media.data.slice(media.data.indexOf(",") + 1) : media.data;
      const mimetype = media.mimetype.split(";")[0]!.trim() || "application/octet-stream";
      type = result.type || sendTypeForMimetype(mimetype);
      storedMedia = {
        id: null,
        mimetype,
        filename: media.filename,
        ...(await storeMedia(result.id, Buffer.from(base64, "base64"), mimetype)),
      };
    }
    return this.recordOutgoing({
      _id: result.id,
      chatId: key,
      body: text,
      timestamp: result.timestamp || Date.now(),
      fromMe: true,
      type,
      ack: ACK.pending,
      media: storedMedia,
      ...quoted,
      source: "api",
    });
  }

  // Called by the groups service for each group message it sees (live or
  // history). `message` is already in Cloud API webhook shape.
  async ingestGroupMessage(input: {
    chatId: string;
    fromMe: boolean;
    history: boolean;
    author?: string | null;
    authorId?: string | null;
    groupSubject?: string | null;
    /** 1:1 only: the sender's WhatsApp profile name. */
    contactName?: string | null;
    message: WaMessage;
  }) {
    if (!input.message?.id) return;
    let key = "";
    if (isGroupKey(input.chatId ?? "")) {
      key = groupKey(input.chatId);
    } else if (webDirectEnabled) {
      try {
        key = toWaId(input.chatId ?? "");
      } catch {
        return;
      }
    }
    if (!key) return;
    await this.storeMessage(input.message, key, input.fromMe, input.history ? "history" : "web", {
      author: input.fromMe ? null : input.author ?? null,
      authorId: input.authorId ?? null,
      groupSubject: isGroupKey(key) ? input.groupSubject ?? null : input.fromMe ? null : input.contactName ?? null,
    });
    if (input.history) this.historyDirty = true;
  }

  private historyDirty = false;

  // Batched "chats-updated" after a history burst, so the panel refreshes once.
  flushGroupHistory() {
    if (!this.historyDirty) return;
    this.historyDirty = false;
    publishWhatsAppEvent("chats-updated", { chatId: "history" });
  }

  async ingestGroupStatus(input: { id: string; ack: number }) {
    if (!input.id || !Number.isFinite(input.ack)) return;
    const { messages } = await getCollections();
    const result = await messages.findOneAndUpdate(
      { _id: input.id },
      input.ack === ACK.failed ? { $set: { ack: ACK.failed } } : { $max: { ack: input.ack } },
      { returnDocument: "after", projection: { chatId: 1 } },
    );
    if (result) {
      this.bumpMessages(result.chatId);
      publishWhatsAppEvent("messages-updated", { chatId: toChatId(result.chatId) });
    }
  }

  async ingestGroupMedia(input: { id: string; data: string; mimetype: string }) {
    if (!input.id || !input.data) return;
    await this.saveMediaFile(input.id, Buffer.from(input.data, "base64"), input.mimetype || "application/octet-stream");
    const { messages } = await getCollections();
    const doc = await messages.findOne({ _id: input.id }, { projection: { chatId: 1 } });
    if (doc) publishWhatsAppEvent("messages-updated", { chatId: toChatId(doc.chatId) });
  }

  // Address-book names from the linked phone (1:1). Saved for search and new
  // chats, and shown on existing chats.
  async ingestContacts(list: Array<{ phone: string; name: string }>) {
    const { chats, contacts } = await getCollections();
    let changed = false;
    for (const entry of list) {
      let waId: string;
      try {
        waId = toWaId(String(entry.phone ?? ""));
      } catch {
        continue;
      }
      const name = String(entry.name ?? "").trim();
      if (!name) continue;
      await contacts.updateOne({ _id: waId }, { $set: { name, updatedAt: new Date() } }, { upsert: true });
      const result = await chats.updateOne({ _id: waId, contactName: { $ne: name } }, { $set: { contactName: name } });
      if (result.modifiedCount) changed = true;
    }
    if (changed) {
      this.bumpChats();
      publishWhatsAppEvent("chats-updated", { chatId: "contacts" });
    }
  }

  // Group list / renames. Only updates names; a chat appears in the list once
  // it has a message (same rule as 1:1 chats).
  async ingestGroupChats(groups: Array<{ id: string; subject?: string | null }>) {
    const { chats } = await getCollections();
    let changed = false;
    for (const group of groups) {
      const key = groupKey(group.id ?? "");
      const subject = group.subject?.trim();
      if (!key || !subject) continue;
      const result = await chats.updateOne({ _id: key }, { $set: { profileName: subject } }, { upsert: true });
      if (result.modifiedCount || result.upsertedCount) changed = true;
    }
    if (changed) {
      this.bumpChats();
      publishWhatsAppEvent("chats-updated", { chatId: "groups" });
    }
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
    // Linked phone: remove the linked device; a new QR is shown for re-linking
    // (which also brings the full history again).
    if (webDirectEnabled) {
      await groupsRequest("/unlink", {});
      await this.refreshGroupsHealth();
      return;
    }
    // Meta: deliberately a no-op; disconnecting would require re-onboarding the
    // number through Meta. Disconnect from Meta Business Suite instead.
  }

  async forceClearSession() {}

  resetClient() {}

  async shutdownClient() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.groupsTimer) clearInterval(this.groupsTimer);
  }
}

export const cloudWhatsAppService = new CloudWhatsAppService();
export type { CloudWhatsAppService };
