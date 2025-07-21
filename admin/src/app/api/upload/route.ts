import { NextRequest, NextResponse } from "next/server";
import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ error: "No file received." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create unique filename with timestamp
    const timestamp = Date.now();
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_'); // Sanitize filename
    const filename = `${timestamp}_${originalName}`;
    
    // Save to public/uploads directory
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    const filePath = join(uploadDir, filename);

    try {
      await writeFile(filePath, buffer);
    } catch (error) {
      console.error('Error writing file:', error);
      return NextResponse.json({ error: "Failed to save file." }, { status: 500 });
    }

    // Return file metadata
    return NextResponse.json({
      message: "File uploaded successfully",
      filename: filename,
      originalName: file.name,
      size: file.size,
      type: file.type,
      url: `/uploads/${filename}`
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: "File upload failed." }, { status: 500 });
  }
}
