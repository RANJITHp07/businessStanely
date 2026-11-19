import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// "Add Time Entry" records store a work date plus HH:MM strings entered in
// India time. Turn them into instants so the Activities tab can show the
// session and group the entry under the day the work was done.
const IST_OFFSET_MS = 330 * 60 * 1000;
function timeEntryInstant(date: Date, hhmm: string): Date | null {
  if (!/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const day = new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
  const instant = new Date(`${day}T${hhmm.padStart(5, "0")}:00+05:30`);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

async function fetchTimeEntries(agentId: string) {
  // Login/logout rows are attendance markers, not work, so only task entries.
  const entries = await prisma.timesheetEntry.findMany({
    where: { agentId, type: "task" },
    select: {
      title: true,
      description: true,
      date: true,
      startTime: true,
      endTime: true,
      createdAt: true,
    },
  });
  return entries.map((entry) => {
    const start = timeEntryInstant(entry.date, entry.startTime);
    const end = timeEntryInstant(entry.date, entry.endTime);
    return {
      title: entry.title,
      content: entry.description || entry.title,
      createdAt: start ?? entry.createdAt,
      startTime: start,
      endTime: end,
    };
  });
}

// GET /api/comments/agent-activities?agentId=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    if (!agentId) {
      return NextResponse.json(
        { error: "agentId is required" },
        { status: 400 },
      );
    }
    // Find all comments made by this agent, with whatever record each was left on
    const comments = await prisma.comment.findMany({
      where: { authorId: agentId, authorType: "AGENT" },
      select: {
        content: true,
        createdAt: true,
        startTime: true,
        endTime: true,
        task: { select: { id: true, title: true } },
        prospect: { select: { id: true, name: true } },
        opportunity: { select: { id: true, name: true } },
        enquiry: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    // Format for activities tab. A comment belongs to exactly one record, and
    // the page needs its type to link to the right detail route.
    const activities = comments.map((comment) => {
      const target = comment.task
        ? { type: "task", id: comment.task.id, title: comment.task.title }
        : comment.prospect
          ? { type: "prospect", id: comment.prospect.id, title: comment.prospect.name }
          : comment.opportunity
            ? { type: "opportunity", id: comment.opportunity.id, title: comment.opportunity.name }
            : comment.enquiry
              ? { type: "enquiry", id: comment.enquiry.id, title: comment.enquiry.name }
              : null;
      return {
        entityType: target?.type ?? null,
        entityId: target?.id ?? null,
        entityTitle: target?.title ?? null,
        content: comment.content,
        createdAt: comment.createdAt,
        startTime: comment.startTime,
        endTime: comment.endTime,
      };
    });
    const timeEntries = (await fetchTimeEntries(agentId)).map((entry) => ({
      entityType: "timeEntry",
      entityId: null,
      entityTitle: entry.title,
      content: entry.content,
      createdAt: entry.createdAt,
      startTime: entry.startTime,
      endTime: entry.endTime,
    }));
    const merged = [...activities, ...timeEntries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return NextResponse.json(merged);
  } catch (error) {
    console.error("Error fetching agent activities:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent activities" },
      { status: 500 },
    );
  }
}
