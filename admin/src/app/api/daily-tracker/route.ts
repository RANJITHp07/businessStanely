import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { istDateKey } from "@/lib/dailyTrack";
import { buildDailyTrackReport } from "@/lib/dailyTrackReport";

/** Each agent with In Progress tasks and how many of them have a day track note for `date`. */
export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const date = req.nextUrl.searchParams.get("date") || istDateKey();
    const report = await buildDailyTrackReport(date);
    if (!report) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 },
      );
    }

    const counts = new Map<string, { tracked: number; inProgress: number }>();
    for (const task of report.tasks) {
      const row = counts.get(task.agent.id) ?? { tracked: 0, inProgress: 0 };
      row.inProgress += 1;
      if (task.note) row.tracked += 1;
      counts.set(task.agent.id, row);
    }

    const agents = [...report.agents.values()]
      .map((agent) => ({ ...agent, ...counts.get(agent.id)! }))
      .sort(
        (a, b) =>
          b.inProgress - b.tracked - (a.inProgress - a.tracked) ||
          a.name.localeCompare(b.name),
      );

    return NextResponse.json({
      date,
      agents,
      totalTracked: report.tasks.filter((t) => t.note).length,
      totalInProgress: report.tasks.length,
    });
  } catch (error) {
    console.error("Error fetching day tracker:", error);
    return NextResponse.json(
      { error: "Failed to fetch day tracker" },
      { status: 500 },
    );
  }
}
