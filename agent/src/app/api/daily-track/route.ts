import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";
import {
  DAILY_TRACK_MATCH,
  DAILY_TRACK_PREFIX,
  DAILY_TRACK_STATUSES,
  istDateKey,
  istDayRange,
  stripDailyTrackPrefix,
} from "@/lib/dailyTrack";

/** Today's (IST) daily track notes written by the signed-in agent, keyed by task. */
export async function GET(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const date = istDateKey();
    const { start, end } = istDayRange(date)!;

    const comments = await prisma.comment.findMany({
      where: {
        authorId: agent.id,
        authorType: "AGENT",
        taskId: { not: null },
        content: { startsWith: DAILY_TRACK_MATCH },
        createdAt: { gte: start, lt: end },
      },
      select: { id: true, taskId: true, content: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
    });

    const entries: Record<string, { id: string; note: string; updatedAt: Date }> = {};
    for (const c of comments) {
      if (c.taskId && !entries[c.taskId]) {
        entries[c.taskId] = {
          id: c.id,
          note: stripDailyTrackPrefix(c.content),
          updatedAt: c.updatedAt,
        };
      }
    }

    return NextResponse.json({ date, entries });
  } catch (error) {
    console.error("Error fetching daily track:", error);
    return NextResponse.json(
      { error: "Failed to fetch daily track" },
      { status: 500 },
    );
  }
}

/**
 * Saves today's daily track note on a task. One note per task per IST day: a
 * second save the same day rewrites that note instead of adding another.
 */
export async function POST(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const taskId = typeof body.taskId === "string" ? body.taskId : "";
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (!taskId || !note) {
      return NextResponse.json(
        { error: "taskId and note are required" },
        { status: 400 },
      );
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { assignedToId: true, status: true },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    if (task.assignedToId !== agent.id) {
      return NextResponse.json(
        { error: "Only the assigned agent can add the daily track" },
        { status: 403 },
      );
    }
    if (!DAILY_TRACK_STATUSES.includes(task.status)) {
      return NextResponse.json(
        { error: "Daily track is only for In Progress tasks" },
        { status: 400 },
      );
    }

    const { start, end } = istDayRange(istDateKey())!;
    const content = `${DAILY_TRACK_PREFIX} ${note}`;

    const existing = await prisma.comment.findFirst({
      where: {
        taskId,
        authorId: agent.id,
        authorType: "AGENT",
        content: { startsWith: DAILY_TRACK_MATCH },
        createdAt: { gte: start, lt: end },
      },
      select: { id: true },
    });

    const saved = existing
      ? await prisma.comment.update({
          where: { id: existing.id },
          data: { content, updatedById: agent.id, updatedByType: "AGENT" },
          select: { id: true, taskId: true, content: true, updatedAt: true },
        })
      : await prisma.comment.create({
          data: {
            content,
            task: { connect: { id: taskId } },
            authorType: "AGENT",
            agent: { connect: { id: agent.id } },
          },
          select: { id: true, taskId: true, content: true, updatedAt: true },
        });

    return NextResponse.json(
      {
        taskId,
        entry: {
          id: saved.id,
          note: stripDailyTrackPrefix(saved.content),
          updatedAt: saved.updatedAt,
        },
      },
      { status: existing ? 200 : 201 },
    );
  } catch (error) {
    console.error("Error saving daily track:", error);
    return NextResponse.json(
      { error: "Failed to save daily track" },
      { status: 500 },
    );
  }
}
