import { NextRequest, NextResponse } from "next/server";

import { createMultipartUpload } from "@/lib/aws";

type MultipartInitRequest = {
  fileName?: string;
  fileSize?: number;
  contentType?: string;
};

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "audio/mp4",
];

const MAX_SIZE = 500 * 1024 * 1024; // 500MB
const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MultipartInitRequest;
    const fileName = body.fileName?.trim();
    const fileSize = body.fileSize;
    const contentType = body.contentType;
    const parsedContentType = contentType?.split(";")[0]?.trim()?.toLowerCase();
    const normalizedContentType =
      parsedContentType === "mp4" ? "audio/mp4" : parsedContentType;

    if (!fileName || !normalizedContentType || typeof fileSize !== "number") {
      return NextResponse.json(
        { error: "Invalid upload payload" },
        { status: 400 },
      );
    }

    const isAllowedAudio = normalizedContentType.startsWith("audio/");
    const isAllowedMp4Container =
      normalizedContentType === "video/mp4" ||
      normalizedContentType === "application/mp4";

    if (
      !ALLOWED_TYPES.includes(normalizedContentType) &&
      !isAllowedAudio &&
      !isAllowedMp4Container
    ) {
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 },
      );
    }

    if (fileSize <= 0 || fileSize > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size too large (max 500MB)" },
        { status: 400 },
      );
    }

    const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const key = `uploads/${Date.now()}_${safeFileName}`;
    const uploadId = await createMultipartUpload(key, normalizedContentType);
    const totalParts = Math.ceil(fileSize / CHUNK_SIZE);

    return NextResponse.json({
      uploadId,
      key,
      url: key,
      originalName: fileName,
      filename: safeFileName,
      size: fileSize,
      type: normalizedContentType,
      chunkSize: CHUNK_SIZE,
      totalParts,
    });
  } catch (error) {
    console.error("Multipart init error:", error);
    return NextResponse.json(
      { error: "Failed to initialize multipart upload" },
      { status: 500 },
    );
  }
}
