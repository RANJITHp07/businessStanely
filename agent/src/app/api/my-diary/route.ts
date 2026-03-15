import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";

// Temporary compatibility for newly added model until `prisma generate` is run.
const prismaWithDiary = prisma as typeof prisma & {
  diaryEntry: {
    findMany: (...args: any[]) => Promise<any[]>;
    create: (...args: any[]) => Promise<any>;
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

export async function GET(req: NextRequest) {
  try {
    const currentAgent = await getCurrentAgent(req);

    if (!currentAgent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const entries = await prismaWithDiary.diaryEntry.findMany({
      where: {
        createdByAgentId: currentAgent.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Error fetching diary entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch diary entries" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentAgent = await getCurrentAgent(req);

    if (!currentAgent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const entry = await prismaWithDiary.diaryEntry.create({
      data: {
        title: deriveTitle(title, content),
        content,
        createdByAgentId: currentAgent.id,
      },
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("Error creating diary entry:", error);
    return NextResponse.json(
      { error: "Failed to create diary entry" },
      { status: 500 },
    );
  }
}
