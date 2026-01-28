import { NextRequest, NextResponse } from "next/server";

import { uploadToS3 } from "@/lib/aws";

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file: File | null = data.get("file") as unknown as File;

    if (!file) {
      return NextResponse.json({ error: "No file received." }, { status: 400 });
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
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 },
      );
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size too large (max 10MB)" },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");

    try {
      const s3Key = await uploadToS3(buffer, originalName, file.type);

      return NextResponse.json({
        message: "File uploaded successfully",
        filename: originalName,
        originalName: file.name,
        size: file.size,
        type: file.type,
        url: s3Key, // Store the S3 key instead of full URL
      });
    } catch (error) {
      console.error("Error uploading to S3:", error);
      return NextResponse.json(
        { error: "Failed to upload file to S3." },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "File upload failed." }, { status: 500 });
  }
}
