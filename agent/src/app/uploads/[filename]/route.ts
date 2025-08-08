import { NextRequest, NextResponse } from "next/server";
import { getSignedDownloadUrl } from "@/lib/aws";
import { readFile } from "fs/promises";
import path from "path";

// Check if AWS is configured
const isS3Configured = () => {
  return !!(
    (process.env.AWS_ACCESS_KEY_ID || process.env.APP_AWS_ACCESS_KEY_ID) &&
    (process.env.AWS_SECRET_ACCESS_KEY || process.env.APP_AWS_SECRET_ACCESS_KEY) &&
    (process.env.AWS_S3_BUCKET || process.env.APP_AWS_S3_BUCKET_NAME)
  );
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    if (isS3Configured()) {
      // Serve from S3
      const s3Key = `uploads/${filename}`;
      const signedUrl = await getSignedDownloadUrl(s3Key);
      return NextResponse.redirect(signedUrl);
    } else {
      // Serve from local storage
      const filePath = path.join(process.cwd(), "public", "uploads", filename);
      
      try {
        const fileBuffer = await readFile(filePath);
        
        // Determine content type based on file extension
        const ext = path.extname(filename).toLowerCase();
        const contentTypeMap: Record<string, string> = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.pdf': 'application/pdf',
          '.txt': 'text/plain',
          '.doc': 'application/msword',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        };
        
        const contentType = contentTypeMap[ext] || 'application/octet-stream';
        
        return new NextResponse(new Uint8Array(fileBuffer), {
          headers: {
            'Content-Type': contentType,
            'Content-Length': fileBuffer.length.toString(),
          },
        });
      } catch (fileError) {
        console.error("Error reading local file:", fileError);
        return NextResponse.json(
          { error: "File not found" },
          { status: 404 }
        );
      }
    }
  } catch (error) {
    console.error("Error serving file:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
