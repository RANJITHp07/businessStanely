import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Temporary compatibility for newly added model until `prisma generate` is run.
const prismaWithDiary = prisma as typeof prisma & {
  clientDiaryEntry: {
    findUnique: (...args: any[]) => Promise<any>;
    update: (...args: any[]) => Promise<any>;
  };
};

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const normalizeEntryDate = (rawDate: string) => {
  const trimmedDate = rawDate.trim();
  if (!trimmedDate) return "";

  if (DATE_ONLY_REGEX.test(trimmedDate)) {
    return trimmedDate;
  }

  const parsedDate = new Date(trimmedDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toISOString().slice(0, 10);
};

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; entryId: string } },
) {
  try {
    const clientId = params.id;
    const entryId = params.entryId;

    if (!clientId || !entryId) {
      return NextResponse.json(
        { error: "Missing client id or entry id" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const entryDate =
      typeof body.entryDate === "string"
        ? normalizeEntryDate(body.entryDate)
        : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (!entryDate) {
      return NextResponse.json(
        { error: "Entry date is required" },
        { status: 400 },
      );
    }

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 },
      );
    }

    const existingEntry = await prismaWithDiary.clientDiaryEntry.findUnique({
      where: { id: entryId },
      select: { id: true, clientId: true },
    });

    if (!existingEntry || existingEntry.clientId !== clientId) {
      return NextResponse.json(
        { error: "Diary entry not found" },
        { status: 404 },
      );
    }

    const updatedEntry = await prismaWithDiary.clientDiaryEntry.update({
      where: { id: entryId },
      data: {
        entryDate,
        content,
      },
    });

    return NextResponse.json({ entry: updatedEntry });
  } catch (error) {
    console.error("Error updating client diary entry:", error);
    return NextResponse.json(
      { error: "Failed to update client diary entry" },
      { status: 500 },
    );
  }
}
