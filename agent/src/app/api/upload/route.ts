import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";
import { uploadToS3 } from "@/lib/aws";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// Check if AWS is configured
const isS3Configured = () => {
  return !!(
    (process.env.AWS_ACCESS_KEY_ID || process.env.APP_AWS_ACCESS_KEY_ID) &&
    (process.env.AWS_SECRET_ACCESS_KEY || process.env.APP_AWS_SECRET_ACCESS_KEY) &&
    (process.env.AWS_S3_BUCKET || process.env.APP_AWS_S3_BUCKET_NAME)
  );
};

export async function POST(request: NextRequest) {
  try {
    const agent = await getCurrentAgent(request);

    if (!agent) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

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
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 }
      );
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size too large (max 10MB)" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    
    try {
      let fileUrl: string;
      
      if (isS3Configured()) {
        // Use S3 upload
        const s3Key = await uploadToS3(buffer, originalName, file.type);
        fileUrl = s3Key;
      } else {
        // Use local storage as fallback
        const timestamp = Date.now();
        const filename = `${timestamp}_${originalName}`;
        const uploadDir = path.join(process.cwd(), "public", "uploads");
        
        // Ensure upload directory exists
        try {
          await mkdir(uploadDir, { recursive: true });
        } catch {
          // Directory might already exist
        }
        
        const filepath = path.join(uploadDir, filename);
        await writeFile(filepath, buffer);
        
        fileUrl = `/uploads/${filename}`;
      }

      return NextResponse.json({
        message: "File uploaded successfully",
        filename: originalName,
        originalName: file.name,
        size: file.size,
        type: file.type,
        url: fileUrl,
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      return NextResponse.json(
        { error: "Failed to upload file." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "File upload failed." }, { status: 500 });
  }
}
