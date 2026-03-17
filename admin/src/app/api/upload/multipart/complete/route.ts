import { NextRequest, NextResponse } from "next/server";

import { completeMultipartUpload } from "@/lib/aws";

type CompletePart = {
  ETag: string;
  PartNumber: number;
};

type MultipartCompleteRequest = {
  key?: string;
  uploadId?: string;
  originalName?: string;
  size?: number;
  type?: string;
  parts?: CompletePart[];
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MultipartCompleteRequest;

    if (
      !body.key ||
      !body.uploadId ||
      !Array.isArray(body.parts) ||
      body.parts.length === 0
    ) {
      return NextResponse.json(
        { error: "Invalid multipart completion payload" },
        { status: 400 },
      );
    }

    const sanitizedParts = body.parts
      .filter(
        (part) =>
          part &&
          typeof part.PartNumber === "number" &&
          typeof part.ETag === "string",
      )
      .map((part) => ({
        PartNumber: part.PartNumber,
        ETag: part.ETag.replace(/^\"|\"$/g, ""),
      }))
      .sort((a, b) => a.PartNumber - b.PartNumber);

    if (sanitizedParts.length === 0) {
      return NextResponse.json(
        { error: "No valid parts provided" },
        { status: 400 },
      );
    }

    await completeMultipartUpload(body.key, body.uploadId, sanitizedParts);

    return NextResponse.json({
      url: body.key,
      originalName: body.originalName,
      size: body.size,
      type: body.type,
    });
  } catch (error) {
    console.error("Multipart complete error:", error);
    return NextResponse.json(
      { error: "Failed to complete multipart upload" },
      { status: 500 },
    );
  }
}
