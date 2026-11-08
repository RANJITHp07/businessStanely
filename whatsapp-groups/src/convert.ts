import { getContentType, normalizeMessageContent, type proto, type WAMessage } from "@whiskeysockets/baileys";

// Turns a Baileys (WhatsApp Web) message into the Cloud API webhook message
// shape, so whatsapp-cloud can store it with the same parser it uses for Meta.

type MediaPart = { id?: string; mime_type?: string; caption?: string; filename?: string; voice?: boolean };

export type CloudShapedMessage = {
  id: string;
  from?: string;
  timestamp?: string;
  type: string;
  text?: { body?: string };
  image?: MediaPart;
  video?: MediaPart;
  audio?: MediaPart;
  document?: MediaPart;
  sticker?: MediaPart;
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
  contacts?: Array<{ name?: { formatted_name?: string } }>;
  context?: { id?: string };
};

export type Converted = { message: CloudShapedMessage; hasMedia: boolean; maxBytes: number };

function toNumber(value: unknown) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "toNumber" in (value as object)) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value) || 0;
}

export function messageTimestampSeconds(msg: WAMessage) {
  return toNumber(msg.messageTimestamp) || Math.floor(Date.now() / 1000);
}

function contextId(part: { contextInfo?: proto.IContextInfo | null } | null | undefined) {
  const id = part?.contextInfo?.stanzaId;
  return id ? { context: { id } } : {};
}

// Returns null for things that are not a chat bubble (reactions, edits,
// deletes, key distribution, group system notices).
export function convertMessage(msg: WAMessage): Converted | null {
  const id = msg.key.id;
  if (!id || !msg.message) return null;
  const content = normalizeMessageContent(msg.message);
  const kind = getContentType(content);
  if (!content || !kind) return null;

  const base = { id, timestamp: String(messageTimestampSeconds(msg)) };
  const fileLength = (part: { fileLength?: unknown } | null | undefined) => toNumber(part?.fileLength);

  switch (kind) {
    case "conversation":
      return { message: { ...base, type: "text", text: { body: content.conversation ?? "" } }, hasMedia: false, maxBytes: 0 };
    case "extendedTextMessage": {
      const part = content.extendedTextMessage;
      return {
        message: { ...base, type: "text", text: { body: part?.text ?? "" }, ...contextId(part) },
        hasMedia: false,
        maxBytes: 0,
      };
    }
    case "imageMessage": {
      const part = content.imageMessage;
      return {
        message: { ...base, type: "image", image: { mime_type: part?.mimetype ?? "image/jpeg", caption: part?.caption ?? "" }, ...contextId(part) },
        hasMedia: true,
        maxBytes: fileLength(part),
      };
    }
    case "videoMessage": {
      const part = content.videoMessage;
      return {
        message: { ...base, type: "video", video: { mime_type: part?.mimetype ?? "video/mp4", caption: part?.caption ?? "" }, ...contextId(part) },
        hasMedia: true,
        maxBytes: fileLength(part),
      };
    }
    case "audioMessage": {
      const part = content.audioMessage;
      return {
        message: { ...base, type: "audio", audio: { mime_type: part?.mimetype ?? "audio/ogg", voice: Boolean(part?.ptt) }, ...contextId(part) },
        hasMedia: true,
        maxBytes: fileLength(part),
      };
    }
    case "documentMessage": {
      const part = content.documentMessage;
      return {
        message: {
          ...base,
          type: "document",
          document: {
            mime_type: part?.mimetype ?? "application/octet-stream",
            filename: part?.fileName ?? part?.title ?? "Document",
            caption: part?.caption ?? "",
          },
          ...contextId(part),
        },
        hasMedia: true,
        maxBytes: fileLength(part),
      };
    }
    case "stickerMessage": {
      const part = content.stickerMessage;
      return {
        message: { ...base, type: "sticker", sticker: { mime_type: part?.mimetype ?? "image/webp" } },
        hasMedia: true,
        maxBytes: fileLength(part),
      };
    }
    case "locationMessage":
    case "liveLocationMessage": {
      const part = content.locationMessage ?? content.liveLocationMessage;
      return {
        message: {
          ...base,
          type: "location",
          location: {
            latitude: part?.degreesLatitude ?? undefined,
            longitude: part?.degreesLongitude ?? undefined,
            name: (part as proto.Message.ILocationMessage | undefined)?.name ?? undefined,
            address: (part as proto.Message.ILocationMessage | undefined)?.address ?? undefined,
          },
        },
        hasMedia: false,
        maxBytes: 0,
      };
    }
    case "contactMessage":
      return {
        message: { ...base, type: "contacts", contacts: [{ name: { formatted_name: content.contactMessage?.displayName ?? "Contact" } }] },
        hasMedia: false,
        maxBytes: 0,
      };
    case "contactsArrayMessage":
      return {
        message: {
          ...base,
          type: "contacts",
          contacts: (content.contactsArrayMessage?.contacts ?? []).map((c) => ({ name: { formatted_name: c.displayName ?? "Contact" } })),
        },
        hasMedia: false,
        maxBytes: 0,
      };
    case "pollCreationMessage":
    case "pollCreationMessageV2":
    case "pollCreationMessageV3": {
      const poll = content.pollCreationMessage ?? content.pollCreationMessageV2 ?? content.pollCreationMessageV3;
      const options = (poll?.options ?? []).map((o) => `• ${o.optionName ?? ""}`).join("\n");
      return {
        message: { ...base, type: "text", text: { body: `📊 ${poll?.name ?? "Poll"}${options ? `\n${options}` : ""}` } },
        hasMedia: false,
        maxBytes: 0,
      };
    }
    case "reactionMessage":
    case "protocolMessage":
    case "senderKeyDistributionMessage":
    case "messageContextInfo":
    case "pollUpdateMessage":
    case "keepInChatMessage":
    case "pinInChatMessage":
    case "editedMessage":
      return null;
    default:
      // Cloud shows "Unsupported message — open WhatsApp on the phone".
      return { message: { ...base, type: String(kind) }, hasMedia: false, maxBytes: 0 };
  }
}
