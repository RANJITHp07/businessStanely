import { NextRequest, NextResponse } from "next/server";
import { getSignedDownloadUrl } from "@/lib/aws";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    const s3Key = `uploads/${filename}`;

    const signedUrl = await getSignedDownloadUrl(s3Key);
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error("Error serving S3 image:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}