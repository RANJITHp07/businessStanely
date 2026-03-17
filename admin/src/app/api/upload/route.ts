import { NextRequest, NextResponse } from "next/server";
import { getPresignedUploadUrl } from "@/lib/aws";

type UploadRequest = {
  fileName?: string;
  fileSize?: number;
  contentType?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as UploadRequest;
    const fileName = body.fileName?.trim();
    const fileSize = body.fileSize;
    const contentType = body.contentType;

    if (!fileName || !contentType || typeof fileSize !== "number") {
      return NextResponse.json(
        { error: "Invalid upload payload" },
        { status: 400 },
      );
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "audio/mpeg",
      "audio/wav",
      "audio/ogg",
      "audio/webm",
      "audio/mp4",
    ];
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 },
      );
    }

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (fileSize > maxSize) {
      return NextResponse.json(
        { error: "File size too large (max 50MB)" },
        { status: 400 },
      );
    }

    const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const key = `uploads/${Date.now()}_${safeFileName}`;
    const uploadUrl = await getPresignedUploadUrl(key, contentType);

    return NextResponse.json({
      uploadUrl,
      url: key,
      filename: safeFileName,
      originalName: fileName,
      size: fileSize,
      type: contentType,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "File upload failed." }, { status: 500 });
  }
}
