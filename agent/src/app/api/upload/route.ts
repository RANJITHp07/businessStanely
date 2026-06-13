import { NextRequest, NextResponse } from "next/server";

import { getPresignedUploadUrl } from "@/lib/aws";
import { resolveUploadContentType } from "@/lib/uploadValidation";

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

    const resolved = resolveUploadContentType(fileName, body.contentType);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    if (!fileName || typeof fileSize !== "number") {
      return NextResponse.json(
        { error: "Invalid upload payload" },
        { status: 400 },
      );
    }
    const normalizedContentType = resolved.contentType;

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (fileSize > maxSize) {
      return NextResponse.json(
        { error: "File size too large (max 50MB)" },
        { status: 400 },
      );
    }

    const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const key = `uploads/${Date.now()}_${safeFileName}`;
    const uploadUrl = await getPresignedUploadUrl(key, normalizedContentType);

    return NextResponse.json({
      uploadUrl,
      url: key,
      filename: safeFileName,
      originalName: fileName,
      size: fileSize,
      type: normalizedContentType,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "File upload failed." }, { status: 500 });
  }
}
