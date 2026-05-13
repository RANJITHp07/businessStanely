import fs from "fs";
import os from "os";
import path from "path";
import pkg from "whatsapp-web.js";
import { publishWhatsAppEvent } from "./realtime.js";
const { Client, LocalAuth, MessageMedia } = pkg;
function resolveSessionDir() {
    const configured = process.env.WHATSAPP_SESSION_DIR?.trim();
    if (configured) {
        return path.isAbsolute(configured)
            ? configured
            : path.resolve(process.cwd(), configured);
    }
    // /var/task and similar deployment roots are read-only on many serverless hosts.
    if (process.env.NODE_ENV === "production") {
        return path.join(os.tmpdir(), ".wwebjs_auth");
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
        const lockfilePath = path.join(sessionPath, "lockfile");
        if (fs.existsSync(lockfilePath)) {
            try {
                fs.unlinkSync(lockfilePath);
                console.log("[WhatsApp] Cleaned up stuck lockfile.");
            }
            catch (e) {
                // Ignore, lockfile might still be in use
            }
        }
    }
    catch (e) {
        // Ignore cleanup errors
    }
}
function ensureSessionDirectoryWritable() {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    // Validate write access early to avoid opaque puppeteer auth failures.
    const probePath = path.join(SESSION_DIR, `.wwebjs-write-test-${process.pid}-${Date.now()}`);
    try {
        fs.writeFileSync(probePath, "ok");
    }
    finally {
        try {
            if (fs.existsSync(probePath)) {
                fs.unlinkSync(probePath);
            }
        }
        catch {
            // Ignore cleanup errors.
        }
    }
}
const chromiumExecutablePath = process.env.WHATSAPP_CHROMIUM_EXECUTABLE_PATH?.trim() || undefined;
const protocolTimeoutMs = Number(process.env.WHATSAPP_PROTOCOL_TIMEOUT_MS ?? 180000);
const chatFetchTimeoutMs = Number(process.env.WHATSAPP_CHAT_FETCH_TIMEOUT_MS ?? 25000);
const chatCacheTtlMs = Number(process.env.WHATSAPP_CHAT_CACHE_TTL_MS ?? 12000);
const WHATSAPP_EDIT_WINDOW_MS = 15 * 60 * 1000;
/**
 * Returns true for Puppeteer/Chrome crash errors that require a full client reset.
 */
function isFatalBrowserError(error) {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();
    if (normalized.includes("timed out") &&
        normalized.includes("runtime.callfunctionon")) {
        return false;
    }
    return (normalized.includes("detached frame") ||
        normalized.includes("target closed") ||
        normalized.includes("session closed") ||
        normalized.includes("protocol error") ||
        normalized.includes("browser has been closed"));
}
function withTimeout(promise, timeoutMs, label) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        return promise;
    }
    return new Promise((resolve, reject) => {
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
function toEditableMessageError(error) {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();
    if (normalized.includes("detached frame") ||
        normalized.includes("target closed") ||
        normalized.includes("session closed") ||
        normalized.includes("protocol error") ||
        normalized.includes("browser has been closed")) {
        return new Error("WhatsApp web session is reconnecting. Please wait a moment and try again.");
    }
    if (normalized.includes("15") &&
        (normalized.includes("minute") || normalized.includes("minutes"))) {
        return new Error("This message can no longer be edited. WhatsApp allows edits only within 15 minutes.");
    }
    if (normalized.includes("not a function") ||
        normalized.includes("cannot edit") ||
        normalized.includes("evaluation failed") ||
        normalized.includes("not a text") ||
        normalized.includes("unsupported")) {
        return new Error("This message type cannot be edited in WhatsApp.");
    }
    if (normalized.includes("not found")) {
        return new Error("Message was not found or is no longer available.");
    }
    return new Error(message || "Failed to edit message.");
}
function createDefaultState() {
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
function toSafeMessageBody(body) {
    if (!body) {
        return "";
    }
    return body.trim();
}
function toSendMessageError(error) {
    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();
    if (normalized.includes("message body is required") ||
        (normalized.includes("body") && normalized.includes("required"))) {
        return new Error("Attachment payload could not be parsed by WhatsApp. Please reselect the file and try again.");
    }
    if (normalized.includes("detached frame") ||
        normalized.includes("target closed") ||
        normalized.includes("session closed") ||
        normalized.includes("protocol error") ||
        normalized.includes("browser has been closed")) {
        return new Error("WhatsApp web session is reconnecting. Please wait a moment and try again.");
    }
    if (normalized.includes("413") || normalized.includes("too large")) {
        return new Error("Attachment is too large to send.");
    }
    if (normalized.includes("unsupported") || normalized.includes("mimetype")) {
        return new Error("Unsupported attachment format.");
    }
    return new Error(message || "Failed to send message.");
}
const MEDIA_TYPE_LABELS = {
    image: "📷 Photo",
    video: "🎥 Video",
    audio: "🎵 Audio",
    ptt: "🎤 Voice message",
    document: "📄 Document",
    sticker: "🎉 Sticker",
};
const SYSTEM_TYPE_LABELS = {
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
function getMessageTypeLabel(type, hasMedia = false) {
    if (!type) {
        return hasMedia ? "📎 Attachment" : "";
    }
    if (hasMedia) {
        return MEDIA_TYPE_LABELS[type] ?? "📎 Attachment";
    }
    if (type === "chat") {
        return "";
    }
    return SYSTEM_TYPE_LABELS[type] ?? "ℹ️ Event";
}
function mapMessage(message) {
    const internalData = message;
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
function getLastMessagePreview(message) {
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
function mapChat(chat) {
    const lastTimestamp = typeof chat.timestamp === "number" ? chat.timestamp * 1000 : null;
    const lastMessage = getLastMessagePreview(chat.lastMessage);
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
    client = null;
    initializingPromise = null;
    state = createDefaultState();
    chatsCache = [];
    chatsCacheAt = 0;
    chatsRefreshPromise = null;
    getState() {
        return this.state;
    }
    setState(next) {
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
    async initializeClient() {
        this.setState({ status: "initializing", error: null, qr: null });
        try {
            ensureSessionDirectoryWritable();
            // Clean up any stuck lockfiles before starting
            cleanupStuckLockfiles();
            const client = new Client({
                authStrategy: new LocalAuth({
                    clientId: "admin-whatsapp",
                    dataPath: SESSION_DIR,
                }),
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
                    ],
                },
            });
            client.on("qr", (qr) => {
                this.setState({ status: "qr", qr, error: null });
            });
            client.on("authenticated", () => {
                this.setState({ status: "authenticated", error: null });
            });
            client.on("ready", async () => {
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
                publishWhatsAppEvent("chats-updated");
            });
            client.on("auth_failure", (message) => {
                this.setState({
                    status: "error",
                    error: message || "WhatsApp authentication failed.",
                });
            });
            client.on("disconnected", (reason) => {
                this.client = null;
                this.setState({
                    status: "disconnected",
                    qr: null,
                    error: reason || "WhatsApp client disconnected.",
                    clientInfo: createDefaultState().clientInfo,
                });
                publishWhatsAppEvent("chats-updated");
            });
            client.on("error", (error) => {
                console.error("[WhatsApp] Client error:", error.message);
                if (isFatalBrowserError(error)) {
                    this.handleFatalBrowserError(error);
                    return;
                }
                this.setState({
                    status: "error",
                    error: error.message || "WhatsApp client encountered an error.",
                });
            });
            client.on("message", async (message) => {
                try {
                    const mapped = mapMessage(message);
                    publishWhatsAppEvent("message", {
                        chatId: mapped.chatId,
                        message: mapped,
                    });
                    publishWhatsAppEvent("chats-updated", { chatId: mapped.chatId });
                }
                catch (error) {
                    this.handleFatalBrowserError(error);
                }
            });
            client.on("message_create", async (message) => {
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
                }
                catch (error) {
                    this.handleFatalBrowserError(error);
                }
            });
            this.client = client;
            await client.initialize();
        }
        catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : "Unknown initialization error.";
            console.error("[WhatsApp] Initialization failed:", errorMessage);
            this.setState({
                status: "error",
                error: errorMessage,
            });
            this.client = null;
        }
    }
    async requireReadyClient() {
        await this.ensureInitialized();
        if (!this.client || this.state.status !== "ready") {
            const currentStatus = this.state.status;
            const error = this.state.error;
            throw new Error(`WhatsApp is not ready yet. Status: ${currentStatus}${error ? `. Error: ${error}` : ""}`);
        }
        return this.client;
    }
    /**
     * Reset the client (for recovery after crashes)
     */
    resetClient() {
        if (this.client) {
            try {
                this.client.destroy().catch(() => {
                    // Ignore errors during destroy
                });
            }
            catch {
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
    handleFatalBrowserError(error) {
        if (isFatalBrowserError(error)) {
            console.error("[WhatsApp] Fatal browser error detected, resetting client:", error.message);
            this.client = null;
            this.initializingPromise = null;
            this.setState({
                status: "error",
                error: "WhatsApp browser session crashed. Please reconnect.",
                qr: null,
                clientInfo: createDefaultState().clientInfo,
            });
            publishWhatsAppEvent("chats-updated");
        }
    }
    async getChatAvatarUrl(chat) {
        const candidate = chat;
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
        }
        catch {
            return null;
        }
    }
    async sendMediaWithFallbacks(client, chatId, media, content) {
        const mediaPayload = new MessageMedia(media.mimetype || "application/octet-stream", media.data, media.filename || "attachment");
        const baseOptions = {
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
        }
        catch (firstError) {
            const firstMessage = firstError instanceof Error ? firstError.message : String(firstError);
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
            }
            catch {
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
            const tempFilePath = path.join(os.tmpdir(), `wa-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`);
            try {
                fs.writeFileSync(tempFilePath, Buffer.from(media.data, "base64"));
                const filePayload = MessageMedia.fromFilePath(tempFilePath);
                return Object.keys(baseOptions).length > 0
                    ? await client.sendMessage(chatId, filePayload, baseOptions)
                    : await client.sendMessage(chatId, filePayload);
            }
            finally {
                try {
                    if (fs.existsSync(tempFilePath)) {
                        fs.unlinkSync(tempFilePath);
                    }
                }
                catch {
                    // Ignore cleanup errors.
                }
            }
        }
    }
    filterAndSortChats(chats, normalizedSearch) {
        return chats
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
    }
    async refreshChats(client) {
        if (this.chatsRefreshPromise) {
            return this.chatsRefreshPromise;
        }
        this.chatsRefreshPromise = (async () => {
            const chats = await withTimeout(client.getChats(), Number.isFinite(chatFetchTimeoutMs) ? chatFetchTimeoutMs : 25000, "WhatsApp chat fetch");
            const filteredChats = chats.filter((chat) => chat.id.server !== "status");
            const mappedChats = await Promise.all(filteredChats.map(async (chat) => {
                const summary = mapChat(chat);
                const avatarUrl = await this.getChatAvatarUrl(chat);
                return {
                    ...summary,
                    avatarUrl,
                };
            }));
            this.chatsCache = mappedChats;
            this.chatsCacheAt = Date.now();
            return mappedChats;
        })();
        try {
            return await this.chatsRefreshPromise;
        }
        finally {
            this.chatsRefreshPromise = null;
        }
    }
    async listChats(search = "") {
        const client = await this.requireReadyClient();
        const normalizedSearch = search.trim().toLowerCase();
        const hasFreshCache = this.chatsCache.length > 0 && Date.now() - this.chatsCacheAt <= chatCacheTtlMs;
        if (hasFreshCache) {
            return this.filterAndSortChats(this.chatsCache, normalizedSearch);
        }
        try {
            const mappedChats = await this.refreshChats(client);
            return this.filterAndSortChats(mappedChats, normalizedSearch);
        }
        catch (error) {
            this.handleFatalBrowserError(error);
            if (this.chatsCache.length > 0) {
                console.warn("[WhatsApp] listChats failed, returning cached chats:", error instanceof Error ? error.message : String(error));
                return this.filterAndSortChats(this.chatsCache, normalizedSearch);
            }
            const errorMessage = error instanceof Error ? error.message : "Failed to load chats.";
            throw new Error(`Failed to load chats from WhatsApp Web. ${errorMessage}`);
        }
    }
    async listMessages(chatId, limit = 80) {
        const client = await this.requireReadyClient();
        try {
            const chat = await client.getChatById(chatId);
            const messages = await chat.fetchMessages({ limit });
            return messages
                .map(mapMessage)
                .sort((left, right) => left.timestamp - right.timestamp);
        }
        catch (error) {
            this.handleFatalBrowserError(error);
            throw error;
        }
    }
    async sendMessage(chatId, body, media) {
        const client = await this.requireReadyClient();
        const content = body.trim();
        if (!content && !media) {
            throw new Error("Message body or media is required.");
        }
        try {
            let message;
            if (media) {
                message = await this.sendMediaWithFallbacks(client, chatId, media, content);
            }
            else {
                message = await client.sendMessage(chatId, content);
            }
            const mapped = mapMessage(message);
            publishWhatsAppEvent("message", { chatId, message: mapped });
            publishWhatsAppEvent("chats-updated", { chatId });
            return mapped;
        }
        catch (error) {
            this.handleFatalBrowserError(error);
            throw toSendMessageError(error);
        }
    }
    async editMessage(messageId, body) {
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
                    throw new Error("This message can no longer be edited. WhatsApp allows edits only within 15 minutes.");
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
        }
        catch (error) {
            this.handleFatalBrowserError(error);
            throw toEditableMessageError(error);
        }
    }
    async deleteMessage(messageId, everyone = true) {
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
        }
        catch (error) {
            this.handleFatalBrowserError(error);
            throw error;
        }
    }
    async getMedia(messageId) {
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
        }
        catch (error) {
            this.handleFatalBrowserError(error);
            throw error;
        }
    }
    async logout() {
        if (!this.client) {
            this.setState(createDefaultState());
            return;
        }
        try {
            await this.client.logout();
            await this.client.destroy();
        }
        finally {
            this.client = null;
            this.setState({
                ...createDefaultState(),
                status: "disconnected",
            });
            publishWhatsAppEvent("chats-updated");
        }
    }
}
export const whatsappService = new WhatsAppService();
