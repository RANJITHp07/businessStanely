import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { istDateKey } from "@/lib/dailyTrack";
import { buildDailyTrackReport } from "@/lib/dailyTrackReport";

/**
 * Each agent with In Progress tasks and how many of them have a day track note
 * for `date`, with retainership tasks counted apart from the rest.
 */
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

    const counts = new Map<
      string,
      {
        tracked: number;
        inProgress: number;
        retainershipTracked: number;
        retainershipInProgress: number;
      }
    >();
    const totals = {
      totalTracked: 0,
      totalInProgress: 0,
      totalRetainershipTracked: 0,
      totalRetainershipInProgress: 0,
    };
    for (const task of report.tasks) {
      const row = counts.get(task.agent.id) ?? {
        tracked: 0,
        inProgress: 0,
        retainershipTracked: 0,
        retainershipInProgress: 0,
      };
      if (task.isRetainership) {
        row.retainershipInProgress += 1;
        totals.totalRetainershipInProgress += 1;
        if (task.note) {
          row.retainershipTracked += 1;
          totals.totalRetainershipTracked += 1;
        }
      } else {
        row.inProgress += 1;
        totals.totalInProgress += 1;
        if (task.note) {
          row.tracked += 1;
          totals.totalTracked += 1;
        }
      }
      counts.set(task.agent.id, row);
    }

    const missing = (row: {
      tracked: number;
      inProgress: number;
      retainershipTracked: number;
      retainershipInProgress: number;
    }) =>
      row.inProgress -
      row.tracked +
      row.retainershipInProgress -
      row.retainershipTracked;

    const agents = [...report.agents.values()]
      .map((agent) => ({ ...agent, ...counts.get(agent.id)! }))
      .sort((a, b) => missing(b) - missing(a) || a.name.localeCompare(b.name));

    return NextResponse.json({
      date,
      agents,
      ...totals,
    });
  } catch (error) {
    console.error("Error fetching day tracker:", error);
    return NextResponse.json(
      { error: "Failed to fetch day tracker" },
      { status: 500 },
    );
  }
}
