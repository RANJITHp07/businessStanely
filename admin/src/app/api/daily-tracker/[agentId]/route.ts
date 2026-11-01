import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { istDateKey } from "@/lib/dailyTrack";
import {
  findMissingDailyTrack,
  lastDailyTrackDates,
} from "@/lib/dailyTrackReport";

/** One agent's In Progress tasks that have no daily track note for `date`. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const admin = await getCurrentAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { agentId } = await params;
    if (!/^[a-f0-9]{24}$/i.test(agentId)) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, name: true, email: true },
    });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const date = req.nextUrl.searchParams.get("date") || istDateKey();
    const report = await findMissingDailyTrack(date, agentId);
    if (!report) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 },
      );
    }

    const lastTracked = await lastDailyTrackDates(
      report.missing.map((t) => t.id),
      report.range.start,
    );

    return NextResponse.json({
      date,
      agent,
      inProgress: report.inProgressByAgent.get(agentId) ?? 0,
      tasks: report.missing.map(({ agent: _agent, ...task }) => ({
        ...task,
        lastTrackedAt: lastTracked.get(task.id) ?? null,
      })),
    });
  } catch (error) {
    console.error("Error fetching agent daily tracker:", error);
    return NextResponse.json(
      { error: "Failed to fetch daily tracker" },
      { status: 500 },
    );
  }
}
