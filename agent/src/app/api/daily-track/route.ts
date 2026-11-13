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
import { followUpRestart, needsDayTrackOn } from "@/lib/taskFollowUp";

/** Today's (IST) day track notes written by the signed-in agent, keyed by task. */
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
    console.error("Error fetching day track:", error);
    return NextResponse.json(
      { error: "Failed to fetch day track" },
      { status: 500 },
    );
  }
}

/**
 * Saves today's day track note on a task. One note per task per IST day: a
 * second save the same day rewrites that note instead of adding another. On a
 * 48hr/1w follow-up the first save also restarts the wait (Task.followUpUntil),
 * so the task moves from In Progress back to the Followups group at once.
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
      select: {
        assignedToId: true,
        status: true,
        followUpDuration: true,
        followUpUntil: true,
        active: true,
        updatedAt: true,
      },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    if (task.assignedToId !== agent.id) {
      return NextResponse.json(
        { error: "Only the assigned agent can add the day track" },
        { status: 403 },
      );
    }
    if (!DAILY_TRACK_STATUSES.includes(task.status)) {
      return NextResponse.json(
        { error: "Day track is only for In Progress tasks" },
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

    // Today's note can always be rewritten: on a follow-up the first save has
    // already moved the task back to the group, so it no longer "needs" one.
    if (!existing && !needsDayTrackOn(task)) {
      return NextResponse.json(
        { error: "This follow-up task does not need a day track today" },
        { status: 400 },
      );
    }

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

    // First note of the day on a follow-up: start the 48hr/1w wait over, so
    // the task returns to the Followups group now rather than tomorrow.
    // updatedAt is kept: moving the cycle on is not an edit to the task.
    let followUpUntil = task.followUpUntil;
    const restart = existing ? {} : followUpRestart(task);
    if (restart.followUpUntil) {
      await prisma.task.update({
        where: { id: taskId },
        data: { followUpUntil: restart.followUpUntil, updatedAt: task.updatedAt },
      });
      followUpUntil = restart.followUpUntil;
    }

    return NextResponse.json(
      {
        taskId,
        entry: {
          id: saved.id,
          note: stripDailyTrackPrefix(saved.content),
          updatedAt: saved.updatedAt,
        },
        task: { followUpUntil },
      },
      { status: existing ? 200 : 201 },
    );
  } catch (error) {
    console.error("Error saving day track:", error);
    return NextResponse.json(
      { error: "Failed to save day track" },
      { status: 500 },
    );
  }
}
