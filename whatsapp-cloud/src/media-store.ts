import fs from "fs/promises";
import path from "path";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Where received/sent WhatsApp media is kept. Meta deletes its copy after ~30
// days, so this is the long-term copy.
//
// With S3 configured, files go to s3://<bucket>/<prefix>/<message id> and the
// bucket stays private: the service reads them back and streams them to the
// panel. Without S3 (local dev) files go to WHATSAPP_MEDIA_DIR on disk.

const bucket = process.env.WHATSAPP_S3_BUCKET?.trim() || "";
const region = process.env.WHATSAPP_S3_REGION?.trim() || "ap-south-1";
const prefix = (process.env.WHATSAPP_S3_PREFIX?.trim() || "whatsapp").replace(/^\/+|\/+$/g, "");
const accessKeyId = process.env.WHATSAPP_S3_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.WHATSAPP_S3_SECRET_ACCESS_KEY?.trim();

export const mediaDir = path.resolve(process.env.WHATSAPP_MEDIA_DIR?.trim() || "wa-media");

const s3 = bucket
  ? new S3Client({
      region,
      // Falls back to the default AWS credential chain (instance role etc.).
      ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
    })
  : null;

export const mediaStorage = s3 ? `s3://${bucket}/${prefix}/` : mediaDir;

export function safeFileName(id: string) {
  return id.replace(/[^\w.-]/g, "_");
}

export type StoredMedia = { s3Key?: string; localFile?: string };

export async function storeMedia(messageId: string, buffer: Buffer, mimetype: string): Promise<StoredMedia> {
  const name = safeFileName(messageId);
  if (s3) {
    const key = `${prefix}/${name}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype || "application/octet-stream",
      }),
    );
    return { s3Key: key };
  }
  await fs.mkdir(mediaDir, { recursive: true });
  await fs.writeFile(path.join(mediaDir, name), buffer);
  return { localFile: name };
}

/** Returns the stored bytes, or null when the file is not in storage. */
export async function readMedia(stored: { s3Key?: string | null; localFile?: string | null }): Promise<Buffer | null> {
  if (stored.s3Key && s3) {
    try {
      const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: stored.s3Key }));
      if (result.Body) return Buffer.from(await result.Body.transformToByteArray());
    } catch {
      // Missing or unreadable; the caller falls back.
    }
  }
  if (stored.localFile) {
    try {
      return await fs.readFile(path.join(mediaDir, stored.localFile));
    } catch {
      // Missing; the caller falls back.
    }
  }
  return null;
}
