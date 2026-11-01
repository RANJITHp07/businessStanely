import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { istDateKey } from "@/lib/dailyTrack";
import { findMissingDailyTrack } from "@/lib/dailyTrackReport";

/** Agents with In Progress tasks that have no daily track note for `date`. */
export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const date = req.nextUrl.searchParams.get("date") || istDateKey();
    const report = await findMissingDailyTrack(date);
    if (!report) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 },
      );
    }

    const byAgent = new Map<
      string,
      { id: string; name: string; email: string; missing: number }
    >();
    for (const task of report.missing) {
      const row = byAgent.get(task.agent.id) ?? { ...task.agent, missing: 0 };
      row.missing += 1;
      byAgent.set(task.agent.id, row);
    }

    const agents = [...byAgent.values()]
      .map((row) => ({
        ...row,
        inProgress: report.inProgressByAgent.get(row.id) ?? row.missing,
      }))
      .sort((a, b) => b.missing - a.missing || a.name.localeCompare(b.name));

    return NextResponse.json({
      date,
      agents,
      totalMissing: report.missing.length,
      totalAgentsWithInProgress: report.inProgressByAgent.size,
    });
  } catch (error) {
    console.error("Error fetching daily tracker:", error);
    return NextResponse.json(
      { error: "Failed to fetch daily tracker" },
      { status: 500 },
    );
  }
}
