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

  /**
   * A claim only releases itself on a thrown error. A run killed mid-flight --
   * a Lambda timeout, an OOM, a container recycle -- never reaches that catch,
   * so its row stays `running` and keeps owning the day on the unique
   * [jobName, runDate] index. Every retry then reports "Already ran today" and
   * the day's roll-forward is skipped for good.
   *
   * A `running` row older than this window is therefore treated as abandoned
   * and may be taken over. The window has to exceed the job's real runtime
   * (it emails every active agent) so a slow-but-alive run is never stolen
   * from underneath itself and the tasks advanced twice.
   */
  const STALE_CLAIM_MS = 60 * 60 * 1000; // 1 hour

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
      const staleBefore = new Date(Date.now() - STALE_CLAIM_MS);

      // Reclaiming is a conditional write, not a read-then-write: the filter
      // on status + ranAt is part of the update, so of two invocations racing
      // to adopt the same abandoned row only the first matches.
      const reclaimed = await prisma.cronLog.updateMany({
        where: {
          jobName: "recurring-tasks",
          runDate,
          status: "running",
          ranAt: { lt: staleBefore },
        },
        data: { ranAt: new Date(), status: "running" },
      });

      if (reclaimed.count === 0) {
        console.log("⚠️ Cron job already ran today, skipping...");
        return NextResponse.json({
          success: false,
          message: "Already ran today",
        });
      }

      const adopted = await prisma.cronLog.findFirst({
        where: { jobName: "recurring-tasks", runDate },
      });

      if (!adopted) {
        return NextResponse.json({
          success: false,
          message: "Already ran today",
        });
      }

      console.warn(
        `♻️ Adopted an abandoned ${runDate} claim (previous run died without ` +
          `releasing it); continuing.`,
      );
      claim = adopted;
    } else {
      throw error;
    }
  }

  try {
    const updatedTasks = await updateAllRecurringTasks();

    // The activity emails are reporting, not scheduling. Letting them throw
    // here failed the whole run *after* the tasks had already been advanced,
    // which released the claim and let the next run advance them a second
    // time. They get their own boundary so mail trouble cannot move a
    // trigger date.
    try {
      await sendActivityEmailsToAgents();
    } catch (error) {
      console.error("Activity emails failed; recurrence roll-forward stands:", error);
    }

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
    // Deleting (not just flagging) the claim is what actually releases the
    // day. A row left behind still occupies the unique [jobName, runDate]
    // index, so every retry that day hits P2002 and reports "Already ran
    // today" -- one transient failure (a bad SMTP handshake in the activity
    // emails, say) permanently skipped that day's recurrence roll-forward.
    await prisma.cronLog.delete({ where: { id: claim.id } }).catch(() => undefined);

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
