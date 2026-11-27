import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { normalizeMessageContent, proto, type WAMessage } from "@whiskeysockets/baileys";

// Message edits. Newer WhatsApp versions send them as an encrypted
// "secretEncryptedMessage" that only opens with the secret carried by the
// original message; older ones send a plain protocol MESSAGE_EDIT.

export type Edit = {
  /** Id of the message that was edited. */
  targetId: string;
  /** New text or caption; null when it could not be decrypted. */
  body: string | null;
  mentions: string[];
};

const MAX_SECRETS = 50_000;
const secrets = new Map<string, string>();
let loadedFrom: string | null = null;

const secretsFile = (dir: string) => path.join(dir, ".message-secrets");

function load(dir: string) {
  if (loadedFrom === dir) return;
  loadedFrom = dir;
  let lines: string[] = [];
  try {
    lines = fs.readFileSync(secretsFile(dir), "utf8").split("\n").filter(Boolean);
  } catch {
    return;
  }
  for (const line of lines.slice(-MAX_SECRETS)) {
    const [id, secret] = line.split(" ");
    if (id && secret) secrets.set(id, secret);
  }
  if (lines.length > MAX_SECRETS) {
    fs.writeFileSync(secretsFile(dir), [...secrets].map((entry) => `${entry.join(" ")}\n`).join(""), { mode: 0o600 });
  }
}

/** Keeps the secret of a message, so a later edit of it can be opened. */
export function rememberSecret(dir: string, msg: WAMessage) {
  const id = msg.key.id;
  const secret =
    msg.message?.messageContextInfo?.messageSecret ??
    normalizeMessageContent(msg.message)?.messageContextInfo?.messageSecret;
  if (!id || !secret?.length) return;
  load(dir);
  if (secrets.has(id)) return;
  const encoded = Buffer.from(secret).toString("base64");
  secrets.set(id, encoded);
  if (secrets.size > MAX_SECRETS) secrets.delete(secrets.keys().next().value as string);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(secretsFile(dir), `${id} ${encoded}\n`, { mode: 0o600 });
  } catch {
    // Still usable from memory until a restart.
  }
}

/** After unlinking: the secrets belong to the previous account. */
export function forgetSecrets() {
  secrets.clear();
  loadedFrom = null;
}

function textOf(message: proto.IMessage | null | undefined) {
  const content = normalizeMessageContent(message);
  const part =
    content?.extendedTextMessage ?? content?.imageMessage ?? content?.videoMessage ?? content?.documentMessage;
  const body =
    content?.conversation ||
    content?.extendedTextMessage?.text ||
    content?.imageMessage?.caption ||
    content?.videoMessage?.caption ||
    content?.documentMessage?.caption ||
    "";
  return { body, mentions: (part?.contextInfo?.mentionedJid ?? []).filter(Boolean) };
}

function decrypt(
  secret: Buffer,
  targetId: string,
  senders: string[],
  payload: Uint8Array,
  iv: Uint8Array,
): proto.Message | null {
  const data = Buffer.from(payload);
  // The key is bound to the sender's id, which may be the phone number or the
  // hidden (@lid) form. GCM authentication tells which one was used.
  for (const original of senders) {
    for (const editor of senders) {
      const key = crypto.hkdfSync(
        "sha256",
        secret,
        Buffer.alloc(0),
        Buffer.from(`${targetId}${original}${editor}Message Edit`),
        32,
      );
      try {
        const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(key), Buffer.from(iv));
        decipher.setAuthTag(data.subarray(-16));
        return proto.Message.decode(Buffer.concat([decipher.update(data.subarray(0, -16)), decipher.final()]));
      } catch {
        // Wrong sender form; try the next one.
      }
    }
  }
  return null;
}

/**
 * The edit carried by `msg`, or null when it is not an edit. `ownIds` are the
 * linked account's ids, used for edits made on the firm's phone.
 */
export function readEdit(dir: string, msg: WAMessage, ownIds: Array<string | null | undefined>): Edit | null {
  const content = normalizeMessageContent(msg.message);

  const protocol = content?.protocolMessage;
  if (protocol?.type === proto.Message.ProtocolMessage.Type.MESSAGE_EDIT) {
    const targetId = protocol.key?.id;
    return targetId ? { targetId, ...textOf(protocol.editedMessage) } : null;
  }

  const encrypted = content?.secretEncryptedMessage;
  if (!encrypted || encrypted.secretEncType !== proto.Message.SecretEncryptedMessage.SecretEncType.MESSAGE_EDIT) {
    return null;
  }
  const targetId = encrypted.targetMessageKey?.id;
  if (!targetId) return null;

  load(dir);
  const secret = secrets.get(targetId);
  const key = msg.key as WAMessage["key"] & Record<string, string | null | undefined>;
  const candidates = key.fromMe
    ? ownIds
    : [
        key.participant,
        key.participantPn,
        key.participantLid,
        msg.participant,
        key.senderPn,
        key.senderLid,
        key.participant ? null : key.remoteJid,
      ];
  // Drop the device suffix: "123:4@s.whatsapp.net" -> "123@s.whatsapp.net".
  const senders = [...new Set(candidates.filter((id): id is string => Boolean(id)).map((id) => id.replace(/:\d+@/, "@")))];
  const opened =
    secret && encrypted.encPayload && encrypted.encIv
      ? decrypt(Buffer.from(secret, "base64"), targetId, senders, encrypted.encPayload, encrypted.encIv)
      : null;
  if (!opened) return { targetId, body: null, mentions: [] };
  const inner = normalizeMessageContent(opened);
  return { targetId, ...textOf(inner?.protocolMessage?.editedMessage ?? opened) };
}
