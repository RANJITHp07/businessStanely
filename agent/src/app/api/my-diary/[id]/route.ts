import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";

// Temporary compatibility for newly added model until `prisma generate` is run.
const prismaWithDiary = prisma as typeof prisma & {
  diaryEntry: {
    findUnique: (...args: any[]) => Promise<any | null>;
    update: (...args: any[]) => Promise<any>;
    delete: (...args: any[]) => Promise<any>;
  };
};

const getPlainText = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const deriveTitle = (title: string, content: string) => {
  const plainText = getPlainText(content);
  return title.trim() || plainText.slice(0, 80);
};

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const currentAgent = await getCurrentAgent(req);

    if (!currentAgent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entryId = params.id?.trim();
    if (!entryId) {
      return NextResponse.json({ error: "Missing diary id" }, { status: 400 });
    }

    const existing = await prismaWithDiary.diaryEntry.findUnique({
      where: { id: entryId },
    });

    if (!existing || existing.createdByAgentId !== currentAgent.id) {
      return NextResponse.json(
        { error: "Diary entry not found" },
        { status: 404 },
      );
    }

    const body = await req.json();
    const title = typeof body.title === "string" ? body.title : "";
    const content = typeof body.content === "string" ? body.content : "";

    if (!getPlainText(content)) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 },
      );
    }

    const updatedEntry = await prismaWithDiary.diaryEntry.update({
      where: { id: entryId },
      data: {
        title: deriveTitle(title, content),
        content,
      },
    });

    return NextResponse.json({ entry: updatedEntry });
  } catch (error) {
    console.error("Error updating diary entry:", error);
    return NextResponse.json(
      { error: "Failed to update diary entry" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const currentAgent = await getCurrentAgent(req);

    if (!currentAgent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entryId = params.id?.trim();
    if (!entryId) {
      return NextResponse.json({ error: "Missing diary id" }, { status: 400 });
    }

    const existing = await prismaWithDiary.diaryEntry.findUnique({
      where: { id: entryId },
    });

    if (!existing || existing.createdByAgentId !== currentAgent.id) {
      return NextResponse.json(
        { error: "Diary entry not found" },
        { status: 404 },
      );
    }

    await prismaWithDiary.diaryEntry.delete({
      where: { id: entryId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting diary entry:", error);
    return NextResponse.json(
      { error: "Failed to delete diary entry" },
      { status: 500 },
    );
  }
}
