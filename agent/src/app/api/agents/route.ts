import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AGENT_SECRET_FIELDS } from "@/lib/agentSecretFields";

export async function GET(req: NextRequest) {
  try {
    const statusParam = req.nextUrl.searchParams.get("status");
    const normalizedStatus = statusParam?.trim().toLowerCase();

    const agents = await prisma.agent.findMany({
      omit: AGENT_SECRET_FIELDS,
      where:
        normalizedStatus === "inactive"
          ? { status: "inactive" }
          : { status: { not: "inactive" } },
      orderBy: {
        createdAt: "desc",
      },
    });
    return NextResponse.json(agents);
  } catch (error) {
    console.error("Error fetching agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 },
    );
  }
}
