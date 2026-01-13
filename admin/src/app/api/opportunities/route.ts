import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

// GET: List all opportunities from Opportunity model
export async function GET(req: NextRequest) {
  try {
    const agent = await getCurrentAdmin(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // MongoDB does not support relation filtering in Prisma, so filter in-memory
    const allOpportunities = await prisma.opportunity.findMany({
      include: {
        prospect: { include: { assignedAgent: true } },
        comments: true,
      },
      orderBy: { createdAt: "desc" },
    });
    let opportunities = allOpportunities;
    return NextResponse.json({ opportunities });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch opportunities" },
      { status: 500 }
    );
  }
}
