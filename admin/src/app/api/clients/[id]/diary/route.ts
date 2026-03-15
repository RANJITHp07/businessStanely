import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Temporary compatibility for newly added model until `prisma generate` is run.
const prismaWithDiary = prisma as typeof prisma & {
  clientDiaryEntry: {
    findMany: (...args: any[]) => Promise<any[]>;
    create: (...args: any[]) => Promise<any>;
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

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const clientId = params.id;

    if (!clientId) {
      return NextResponse.json({ error: "Missing client id" }, { status: 400 });
    }

    const date = req.nextUrl.searchParams.get("date")?.trim() || "";
    const normalizedDate = date ? normalizeEntryDate(date) : "";

    if (date && !normalizedDate) {
      return NextResponse.json(
        { error: "Invalid date filter" },
        { status: 400 },
      );
    }

    const entries = await prismaWithDiary.clientDiaryEntry.findMany({
      where: {
        clientId,
        ...(normalizedDate
          ? {
              OR: [
                { entryDate: normalizedDate },
                // Keep old records queryable when date was previously stored as ISO timestamp.
                { entryDate: { startsWith: `${normalizedDate}T` } },
              ],
            }
          : {}),
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const normalizedEntries = entries.map((entry) => ({
      ...entry,
      entryDate: normalizeEntryDate(String(entry.entryDate ?? "")),
    }));

    return NextResponse.json({ entries: normalizedEntries });
  } catch (error) {
    console.error("Error fetching client diary entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch client diary entries" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const clientId = params.id;

    if (!clientId) {
      return NextResponse.json({ error: "Missing client id" }, { status: 400 });
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

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const entry = await prismaWithDiary.clientDiaryEntry.create({
      data: {
        clientId,
        entryDate,
        content,
      },
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("Error creating client diary entry:", error);
    return NextResponse.json(
      { error: "Failed to create client diary entry" },
      { status: 500 },
    );
  }
}
