import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { recordUpdateAudit, actorFromAdmin } from "@/lib/audit";
import { withActor } from "@/lib/auditContext";

/**
 * Bulk converts normal tasks into legislation tasks under one retainership.
 *
 * A task is "normal" while `legislationId` is null and "legislation" once it
 * points at a Legislation row, so the conversion is the assignment of that id --
 * there is no separate type column to flip. Doing it one task at a time through
 * the task edit form is the only route that existed before this one, which made
 * moving a backlog of tasks onto a retainership impractical.
 *
 * Alongside `legislationId` the update stamps `retainershipId` and reassigns the
 * task to the legislation's agent, mirroring what `/task/create?legislationId=`
 * already prefills when a legislation task is made by hand. Without the
 * reassignment the converted task would show up in the retainership's views
 * while still sitting in some other agent's queue.
 */

/** Only live, still-normal tasks can be converted. */
const CONVERTIBLE_TASK_FILTER: Prisma.TaskWhereInput = {
  deletedAt: null,
  legislationId: null,
};

const TASK_LIST_SELECT = {
  id: true,
  title: true,
  status: true,
  priority: true,
  dueDate: true,
  createdAt: true,
  assignedTo: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
} satisfies Prisma.TaskSelect;

/**
 * GET — the normal tasks this retainership can absorb, plus its legislations.
 *
 * The dialog needs both halves in one call: the tasks to tick and the
 * legislation to file them under. The pool is limited to the retainership's own
 * client, and `search` narrows it further.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: retainershipId } = await params;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") || "25", 10)),
    );

    const retainership = await prisma.retainership.findFirst({
      where: { id: retainershipId, deletedAt: null },
      select: {
        id: true,
        name: true,
        clientId: true,
        legislation: {
          where: { deletedAt: null },
          select: {
            id: true,
            title: true,
            assignedAgentId: true,
            assignedAgent: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!retainership) {
      return NextResponse.json(
        { error: "Retainership not found" },
        { status: 404 },
      );
    }

    // A retainership belongs to one client, so only that client's tasks can be
    // filed under its legislation. A retainership with no client has no pool.
    if (!retainership.clientId) {
      return NextResponse.json({
        retainership: {
          id: retainership.id,
          name: retainership.name,
          clientId: null,
        },
        legislations: retainership.legislation,
        tasks: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      });
    }

    const where: Prisma.TaskWhereInput = {
      ...CONVERTIBLE_TASK_FILTER,
      clientId: retainership.clientId,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        select: TASK_LIST_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.task.count({ where }),
    ]);

    return NextResponse.json({
      retainership: {
        id: retainership.id,
        name: retainership.name,
        clientId: retainership.clientId,
      },
      legislations: retainership.legislation,
      tasks,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error loading convertible tasks:", error);
    return NextResponse.json(
      { error: "Failed to load convertible tasks" },
      { status: 500 },
    );
  }
}

/**
 * POST — convert the given tasks.
 *
 * Body: { legislationId: string, taskIds: string[] }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: retainershipId } = await params;
    const body = await req.json().catch(() => ({}));

    const legislationId: string | undefined = body.legislationId;
    const taskIds: string[] = Array.isArray(body.taskIds)
      ? body.taskIds.filter(
          (taskId: unknown): taskId is string =>
            typeof taskId === "string" && taskId.length > 0,
        )
      : [];

    if (!legislationId) {
      return NextResponse.json(
        { error: "legislationId is required" },
        { status: 400 },
      );
    }

    if (taskIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one task to convert" },
        { status: 400 },
      );
    }

    const retainership = await prisma.retainership.findFirst({
      where: { id: retainershipId, deletedAt: null },
      select: { id: true, name: true, clientId: true },
    });

    if (!retainership) {
      return NextResponse.json(
        { error: "Retainership not found" },
        { status: 404 },
      );
    }

    if (!retainership.clientId) {
      return NextResponse.json(
        { error: "This retainership has no client, so it has no tasks to convert" },
        { status: 400 },
      );
    }

    // The legislation is looked up through the retainership so a caller cannot
    // file tasks under another retainership's legislation by passing its id.
    const legislation = await prisma.legislation.findFirst({
      where: { id: legislationId, retainershipId, deletedAt: null },
      select: { id: true, title: true, assignedAgentId: true },
    });

    if (!legislation) {
      return NextResponse.json(
        { error: "Legislation not found for this retainership" },
        { status: 404 },
      );
    }

    // Re-filtered rather than trusted: a task the client listed may have been
    // deleted or already converted between the dialog opening and submitting.
    // The clientId match is what stops a crafted request from filing another
    // client's task under this retainership.
    const eligibleTasks = await prisma.task.findMany({
      where: {
        id: { in: taskIds },
        clientId: retainership.clientId,
        ...CONVERTIBLE_TASK_FILTER,
      },
      select: { id: true, title: true },
    });

    if (eligibleTasks.length === 0) {
      return NextResponse.json(
        {
          error:
            "None of the selected tasks can be converted. They may have been deleted or already converted.",
        },
        { status: 409 },
      );
    }

    const eligibleIds = eligibleTasks.map((task) => task.id);
    const skippedCount = taskIds.length - eligibleIds.length;

    const actor = actorFromAdmin(currentAdmin);

    const converted = await withActor(actor, async () =>
      prisma.task.updateMany({
        where: { id: { in: eligibleIds } },
        data: {
          legislationId: legislation.id,
          retainershipId: retainership.id,
          // A legislation task belongs to the agent who owns the legislation.
          // Left unset when the legislation has no agent, so an existing
          // assignment is not wiped in exchange for nothing.
          ...(legislation.assignedAgentId
            ? {
                assignedToId: legislation.assignedAgentId,
                ownerShipId: legislation.assignedAgentId,
              }
            : {}),
        },
      }),
    );

    // One UPDATE row per task: the audit trail is keyed by entityId, so a single
    // summary row would leave the individual tasks with no record of the change.
    await Promise.all(
      eligibleTasks.map((task) =>
        recordUpdateAudit({
          entityType: "Task",
          entityId: task.id,
          entityName: task.title,
          changedFields: [
            `legislationId: converted to legislation "${legislation.title}"`,
            `retainershipId: linked to retainership "${retainership.name}"`,
            ...(legislation.assignedAgentId
              ? ["assignedToId: reassigned to the legislation's agent"]
              : []),
          ],
          actor,
          req,
        }),
      ),
    );

    await recordUpdateAudit({
      entityType: "Legislation",
      entityId: legislation.id,
      entityName: legislation.title,
      changedFields: [
        `tasks: ${converted.count} normal task(s) converted to legislation tasks`,
      ],
      actor,
      req,
    });

    return NextResponse.json({
      success: true,
      message:
        skippedCount > 0
          ? `Converted ${converted.count} task(s) to legislation "${legislation.title}". ${skippedCount} were skipped as no longer convertible.`
          : `Converted ${converted.count} task(s) to legislation "${legislation.title}".`,
      summary: {
        retainershipId,
        legislationId: legislation.id,
        convertedCount: converted.count,
        skippedCount,
        convertedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error converting tasks to legislation tasks:", error);
    return NextResponse.json(
      { error: "Failed to convert tasks" },
      { status: 500 },
    );
  }
}
