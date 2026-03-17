import { NextRequest, NextResponse } from "next/server";

import { getMultipartPartUploadUrl } from "@/lib/aws";

type PartUrlRequest = {
  key?: string;
  uploadId?: string;
  partNumber?: number;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PartUrlRequest;

    if (!body.key || !body.uploadId || typeof body.partNumber !== "number") {
      return NextResponse.json(
        { error: "Invalid part upload payload" },
        { status: 400 },
      );
    }

    if (body.partNumber < 1 || body.partNumber > 10000) {
      return NextResponse.json(
        { error: "Invalid part number" },
        { status: 400 },
      );
    }

    const uploadUrl = await getMultipartPartUploadUrl(
      body.key,
      body.uploadId,
      body.partNumber,
    );

    return NextResponse.json({ uploadUrl });
  } catch (error) {
    console.error("Multipart part-url error:", error);
    return NextResponse.json(
      { error: "Failed to generate part upload URL" },
      { status: 500 },
    );
  }
}
