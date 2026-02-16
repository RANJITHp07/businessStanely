import { NextRequest, NextResponse } from "next/server";
import {
  sendActivityEmailsToAgents,
  updateAllRecurringTasks,
} from "@/lib/singleTaskRecurring";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const updatedTasks = await updateAllRecurringTasks();
    await sendActivityEmailsToAgents();
    return NextResponse.json({
      success: true,
      updatedCount: updatedTasks.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Cron job failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
