import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const currentAdmin = await getCurrentAgent(req);

    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const leadSources = await prisma.leadSource.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(leadSources);
  } catch (error) {
    console.error("Error fetching lead sources:", error);
    return NextResponse.json(
      { error: "Error fetching lead sources" },
      { status: 500 }
    );
  }
}
