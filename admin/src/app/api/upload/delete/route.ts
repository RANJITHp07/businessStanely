import { NextRequest, NextResponse } from "next/server";
import { deleteFromS3 } from "@/lib/aws";

export async function DELETE(request: NextRequest) {
  try {
    const { fileUrl } = await request.json();

    if (!fileUrl) {
      return NextResponse.json(
        { error: "No file URL provided" },
        { status: 400 }
      );
    }

    if (!fileUrl.includes("amazonaws.com")) {
      return NextResponse.json({ error: "Invalid S3 URL" }, { status: 400 });
    }

    await deleteFromS3(fileUrl);

    return NextResponse.json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}