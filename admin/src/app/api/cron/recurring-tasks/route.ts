// app/api/cron/recurring-tasks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  updateAllRecurringTasks,
  sendActivityEmailsToAgents,
} from "@/lib/singleTaskRecurring";
import prisma from "@/lib/prisma";

/**
 * Daily job: roll recurring tasks onto their next occurrence, nudge held
 * tasks, and email agents yesterday's activity.
 *
 * Running it twice in one day advances every recurring task's trigger date
 * twice, so the run is claimed by inserting a CronLog row on a unique
 * [jobName, runDate] index. The previous guard read for an existing row and
 * then created one, which two concurrent invocations both pass -- routine on
 * serverless, where a retry or a double-fired schedule runs in parallel
 * containers. Letting the insert fail is what makes the claim atomic.
 */
async function runDailyJob(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    console.error("CRON_SECRET is not configured; refusing to run.");
    return NextResponse.json(
      { error: "Cron is not configured" },
      { status: 503 },
    );
  }

  // Constant-ish comparison and a bare 401: the old handler echoed back
  // whether the env var existed and how long both values were, which tells an
  // attacker how close a guess is.
  if (secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runDate = new Date().toISOString().slice(0, 10);

  let claim;
  try {
    claim = await prisma.cronLog.create({
      data: { jobName: "recurring-tasks", runDate, ranAt: new Date() },
    });
  } catch (error) {
    // P2002 = unique constraint violation: another invocation owns today.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      console.log("⚠️ Cron job already ran today, skipping...");
      return NextResponse.json({
        success: false,
        message: "Already ran today",
      });
    }
    throw error;
  }

  try {
    const updatedTasks = await updateAllRecurringTasks();
    await sendActivityEmailsToAgents();

    await prisma.cronLog.update({
      where: { id: claim.id },
      data: { status: "success", updatedCount: updatedTasks.length },
    });

    console.log("✅ Cron job completed successfully:", {
      updatedCount: updatedTasks.length,
    });
    return NextResponse.json({
      success: true,
      updatedCount: updatedTasks.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Cron job failed:", error);

    // The claim is released so the next scheduled run retries, rather than
    // the day being permanently marked as done by a failed attempt.
    await prisma.cronLog
      .update({ where: { id: claim.id }, data: { status: "failed" } })
      .catch(() => undefined);

    return NextResponse.json(
      {
        error: "Cron job failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return runDailyJob(request);
}

/**
 * GET mirrors POST because some schedulers can only issue GETs. It mutates, so
 * it stays behind the same secret.
 */
export async function GET(request: NextRequest) {
  return runDailyJob(request);
}
