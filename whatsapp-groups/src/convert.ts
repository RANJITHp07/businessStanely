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
    // Business / bot messages: show their text instead of "Unsupported".
    case "templateMessage":
    case "buttonsMessage":
    case "listMessage":
    case "interactiveMessage":
    case "buttonsResponseMessage":
    case "listResponseMessage":
    case "templateButtonReplyMessage":
    case "interactiveResponseMessage":
    case "groupInviteMessage":
    case "eventMessage": {
      const body = businessText(content, kind);
      return body
        ? { message: { ...base, type: "text", text: { body } }, hasMedia: false, maxBytes: 0 }
        : { message: { ...base, type: String(kind) }, hasMedia: false, maxBytes: 0 };
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

// Text of template, button, list and other business-style messages.
function businessText(content: proto.IMessage, kind: string): string {
  const join = (...parts: Array<string | null | undefined>) =>
    parts.map((part) => part?.trim()).filter(Boolean).join("\n");
  switch (kind) {
    case "templateMessage": {
      const t = content.templateMessage;
      const h = t?.hydratedTemplate ?? t?.hydratedFourRowTemplate;
      return join(
        h?.hydratedTitleText,
        h?.hydratedContentText,
        h?.hydratedFooterText,
        ...(h?.hydratedButtons ?? []).map(
          (b) => b.quickReplyButton?.displayText ?? b.urlButton?.displayText ?? b.callButton?.displayText,
        ).map((label) => (label ? `[${label}]` : null)),
      );
    }
    case "buttonsMessage": {
      const b = content.buttonsMessage;
      return join(b?.text, b?.contentText, b?.footerText, ...(b?.buttons ?? []).map((x) => (x.buttonText?.displayText ? `[${x.buttonText.displayText}]` : null)));
    }
    case "listMessage": {
      const l = content.listMessage;
      return join(l?.title, l?.description, l?.footerText, l?.buttonText ? `[${l.buttonText}]` : null);
    }
    case "interactiveMessage": {
      const i = content.interactiveMessage;
      return join(i?.header?.title, i?.body?.text, i?.footer?.text);
    }
    case "buttonsResponseMessage":
      return join(content.buttonsResponseMessage?.selectedDisplayText);
    case "listResponseMessage":
      return join(content.listResponseMessage?.title, content.listResponseMessage?.description);
    case "templateButtonReplyMessage":
      return join(content.templateButtonReplyMessage?.selectedDisplayText);
    case "interactiveResponseMessage":
      return join(content.interactiveResponseMessage?.body?.text);
    case "groupInviteMessage":
      return join(`Group invite: ${content.groupInviteMessage?.groupName ?? ""}`, content.groupInviteMessage?.caption);
    case "eventMessage":
      return join(`Event: ${content.eventMessage?.name ?? ""}`, content.eventMessage?.description);
    default:
      return "";
  }
}
