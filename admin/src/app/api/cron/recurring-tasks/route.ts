// app/api/cron/recurring-tasks/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  updateAllRecurringTasks,
  sendActivityEmailsToAgents,
} from "@/lib/singleTaskRecurring";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  console.log(secret, process.env.CRON_SECRET);
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        headerExists: !!secret,
        envExists: !!process.env.CRON_SECRET,
        headerLength: secret?.length ?? 0,
        envLength: process.env.CRON_SECRET?.length ?? 0,
      },
      { status: 401 },
    );
  }

  // ✅ Lock check — prevent running more than once per day
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const alreadyRan = await prisma.cronLog.findFirst({
    where: {
      jobName: "recurring-tasks",
      ranAt: { gte: today },
    },
  });

  if (alreadyRan) {
    console.log("⚠️ Cron job already ran today, skipping...");
    return NextResponse.json({
      success: false,
      message: "Already ran today",
      ranAt: alreadyRan.ranAt,
    });
  }

  // ✅ Log this run immediately to block duplicate runs
  await prisma.cronLog.create({
    data: {
      jobName: "recurring-tasks",
      ranAt: new Date(),
    },
  });

  try {
    const updatedTasks = await updateAllRecurringTasks();
    await sendActivityEmailsToAgents();

    // ✅ Update log with success
    await prisma.cronLog.updateMany({
      where: { jobName: "recurring-tasks", ranAt: { gte: today } },
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
    console.log(error);
    await prisma.cronLog.updateMany({
      where: { jobName: "recurring-tasks", ranAt: { gte: today } },
      data: { status: "failed" },
    });

    return NextResponse.json(
      {
        error: "Cron job failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  console.log(secret, process.env.CRON_SECRET);

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        headerExists: !!secret,
        envExists: !!process.env.CRON_SECRET,
        headerLength: secret?.length ?? 0,
        envLength: process.env.CRON_SECRET?.length ?? 0,
      },
      { status: 401 },
    );
  }

  // ✅ Lock check — prevent running more than once per day
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const alreadyRan = await prisma.cronLog.findFirst({
    where: {
      jobName: "recurring-tasks",
      ranAt: { gte: today },
    },
  });

  if (alreadyRan) {
    console.log("⚠️ Cron job already ran today, skipping...");
    return NextResponse.json({
      success: false,
      message: "Already ran today",
      ranAt: alreadyRan.ranAt,
    });
  }

  // ✅ Log this run immediately to block duplicate runs
  await prisma.cronLog.create({
    data: {
      jobName: "recurring-tasks",
      ranAt: new Date(),
    },
  });

  try {
    const updatedTasks = await updateAllRecurringTasks();
    await sendActivityEmailsToAgents();

    // ✅ Update log with success
    await prisma.cronLog.updateMany({
      where: { jobName: "recurring-tasks", ranAt: { gte: today } },
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
    console.log(error);
    await prisma.cronLog.updateMany({
      where: { jobName: "recurring-tasks", ranAt: { gte: today } },
      data: { status: "failed" },
    });

    return NextResponse.json(
      {
        error: "Cron job failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
