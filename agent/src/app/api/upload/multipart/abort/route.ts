import { NextRequest, NextResponse } from "next/server";

import { abortMultipartUpload } from "@/lib/aws";

type MultipartAbortRequest = {
  key?: string;
  uploadId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MultipartAbortRequest;

    if (!body.key || !body.uploadId) {
      return NextResponse.json(
        { error: "Invalid multipart abort payload" },
        { status: 400 },
      );
    }

    await abortMultipartUpload(body.key, body.uploadId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Multipart abort error:", error);
    return NextResponse.json(
      { error: "Failed to abort multipart upload" },
      { status: 500 },
    );
  }
}
