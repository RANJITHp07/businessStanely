import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { recordUpdateAudit, actorFromAdmin } from "@/lib/audit";
import { withActor } from "@/lib/auditContext";
import { NOT_DELETED } from "@/lib/softDelete";
import { clientDisplayName } from "@/lib/entityNames";

/**
 * Moves legislation tasks from this retainership to another legislation.
 *
 * The target legislation may sit on this same retainership (a transfer between
 * legislations) or on another retainership (a transfer between retainerships).
 * Both are the same write -- a legislation task belongs to whichever legislation
 * its `legislationId` names, and the retainership comes with it -- so one route
 * serves both and the dialog only differs in which retainership the admin picks
 * the target from.
 *
 * The source is this retainership as a whole, or one of its legislations when
 * `legislationId` is given (the legislation detail page opens it that way).
 *
 * Like `convert-tasks`, the update stamps `retainershipId` and hands the task to
 * the target legislation's agent, so a moved task does not show up under the
 * new legislation while still sitting in the old agent's queue.
 *
 * A retainership belongs to one client, so when the target retainership is
 * another client's, the task's own `clientId` moves with it. Leaving it behind
 * would file the task under one client's retainership while the client views
 * still list it under the old one. Only the selected tasks move; the source
 * retainership and its other tasks stay where they are.
 */

/*
 * Reads carry no `deletedAt` condition: the soft-delete extension injects the
 * absent-aware one, and naming deletedAt here would suppress it. The write
 * spells it out with NOT_DELETED, since the extension does not rewrite
 * updateMany.
 */

const TASK_LIST_SELECT = {
  id: true,
  title: true,
  status: true,
  priority: true,
  dueDate: true,
  createdAt: true,
  legislationId: true,
  assignedTo: { select: { id: true, name: true } },
  legislation: { select: { id: true, title: true } },
} satisfies Prisma.TaskSelect;

const LEGISLATION_SELECT = {
  id: true,
  title: true,
  assignedAgentId: true,
  assignedAgent: { select: { id: true, name: true } },
} satisfies Prisma.LegislationSelect;

const CLIENT_NAME_SELECT = {
  id: true,
  clientType: true,
  firstName: true,
  lastName: true,
  organizationName: true,
  email: true,
} satisfies Prisma.ClientSelect;

/** A rejected retainership is closed, so it is never offered as a target. */
const TARGET_RETAINERSHIP_FILTER: Prisma.RetainershipWhereInput = {
  status: { not: "rejected" },
};

/**
 * Tasks that count as this retainership's: those filed under one of its
 * legislations, plus any stamped with its retainershipId directly. Tasks made
 * from `/task/create?legislationId=` carry only the legislationId, so the
 * retainershipId alone would miss most of them.
 */
function retainershipTaskFilter(
  retainershipId: string,
  legislationIds: string[],
): Prisma.TaskWhereInput {
  return {
    OR: [
      { retainershipId },
      ...(legislationIds.length
        ? [{ legislationId: { in: legislationIds } }]
        : []),
    ],
  };
}

/**
 * Resolves the source scope: the retainership, its live legislations, and the
 * task filter for either the whole retainership or the one named legislation.
 * Returns a response instead when the source does not exist.
 */
async function loadSource(
  retainershipId: string,
  legislationId: string | null | undefined,
) {
  const retainership = await prisma.retainership.findFirst({
    where: { id: retainershipId },
    select: {
      id: true,
      name: true,
      clientId: true,
      client: { select: CLIENT_NAME_SELECT },
      legislation: {
        select: { id: true, title: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!retainership) {
    return {
      error: NextResponse.json(
        { error: "Retainership not found" },
        { status: 404 },
      ),
    } as const;
  }

  // The legislation is checked against this retainership's own list so a
  // caller cannot reach another retainership's tasks through this route.
  const sourceLegislation = legislationId
    ? retainership.legislation.find((item) => item.id === legislationId)
    : undefined;

  if (legislationId && !sourceLegislation) {
    return {
      error: NextResponse.json(
        { error: "Legislation not found for this retainership" },
        { status: 404 },
      ),
    } as const;
  }

  const taskFilter: Prisma.TaskWhereInput = sourceLegislation
    ? { legislationId: sourceLegislation.id }
    : retainershipTaskFilter(
        retainership.id,
        retainership.legislation.map((item) => item.id),
      );

  return { retainership, sourceLegislation, taskFilter } as const;
}

/**
 * GET — the tasks that can be moved, plus the legislations they can move to.
 *
 * Query: legislationId? (narrow the source), search?, page?, pageSize?
 *
 * Targets come grouped by retainership, current one first, so the dialog can
 * pick a retainership and then one of its legislations.
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
    const legislationId = searchParams.get("legislationId");
    const search = searchParams.get("search")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") || "25", 10)),
    );

    const source = await loadSource(retainershipId, legislationId);
    if ("error" in source) return source.error;
    const { retainership, sourceLegislation, taskFilter } = source;

    const where: Prisma.TaskWhereInput = {
      AND: [
        taskFilter,
        ...(search
          ? [
              {
                OR: [
                  { title: { contains: search, mode: "insensitive" as const } },
                  {
                    description: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };

    // The current retainership is always offered, even if it was since rejected,
    // so its tasks can still be moved between its own legislations.
    const targetWhere: Prisma.RetainershipWhereInput = {
      OR: [{ id: retainership.id }, TARGET_RETAINERSHIP_FILTER],
    };

    const [tasks, total, targetRetainerships] = await Promise.all([
      prisma.task.findMany({
        where,
        select: TASK_LIST_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.task.count({ where }),
      prisma.retainership.findMany({
        where: targetWhere,
        select: {
          id: true,
          name: true,
          status: true,
          clientId: true,
          client: { select: CLIENT_NAME_SELECT },
          legislation: {
            select: LEGISLATION_SELECT,
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    // The current retainership leads the list, then the rest of the same
    // client's: moving between its own legislations is the common case, so it
    // is the dialog's default, and another client is the least likely target.
    const rank = (target: { id: string; clientId: string | null }) =>
      target.id === retainership.id
        ? 0
        : retainership.clientId && target.clientId === retainership.clientId
          ? 1
          : 2;
    targetRetainerships.sort((a, b) => rank(a) - rank(b));

    return NextResponse.json({
      retainership: {
        id: retainership.id,
        name: retainership.name,
        clientId: retainership.clientId,
      },
      sourceLegislation: sourceLegislation ?? null,
      sourceLegislations: retainership.legislation,
      targets: targetRetainerships.map(({ client, ...target }) => ({
        ...target,
        clientName: client ? clientDisplayName(client) : null,
      })),
      tasks,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error loading transferable tasks:", error);
    return NextResponse.json(
      { error: "Failed to load transferable tasks" },
      { status: 500 },
    );
  }
}

/**
 * POST — move the given tasks to the target legislation.
 *
 * Body: { targetLegislationId: string, taskIds: string[], legislationId?: string }
 *
 * `legislationId` narrows the source exactly as it does for GET, so a request
 * made from a legislation page cannot move tasks from that legislation's
 * siblings.
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

    const targetLegislationId: string | undefined = body.targetLegislationId;
    const sourceLegislationId: string | undefined =
      typeof body.legislationId === "string" && body.legislationId
        ? body.legislationId
        : undefined;
    const taskIds: string[] = Array.isArray(body.taskIds)
      ? body.taskIds.filter(
          (taskId: unknown): taskId is string =>
            typeof taskId === "string" && taskId.length > 0,
        )
      : [];

    if (!targetLegislationId) {
      return NextResponse.json(
        { error: "targetLegislationId is required" },
        { status: 400 },
      );
    }

    if (taskIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one task to transfer" },
        { status: 400 },
      );
    }

    if (sourceLegislationId && sourceLegislationId === targetLegislationId) {
      return NextResponse.json(
        { error: "Cannot transfer tasks to the legislation they are already in" },
        { status: 400 },
      );
    }

    const source = await loadSource(retainershipId, sourceLegislationId);
    if ("error" in source) return source.error;
    const { retainership, taskFilter } = source;

    // A soft-deleted legislation or retainership is invisible to the extended
    // client, so this also rejects transferring into one that was deleted.
    const targetLegislation = await prisma.legislation.findFirst({
      where: { id: targetLegislationId },
      select: {
        ...LEGISLATION_SELECT,
        retainershipId: true,
        retainership: {
          select: {
            id: true,
            name: true,
            clientId: true,
            status: true,
            client: { select: CLIENT_NAME_SELECT },
          },
        },
      },
    });

    if (!targetLegislation || !targetLegislation.retainership) {
      return NextResponse.json(
        { error: "Target legislation not found" },
        { status: 404 },
      );
    }

    const targetRetainership = targetLegislation.retainership;
    const isCrossRetainership = targetRetainership.id !== retainership.id;

    if (isCrossRetainership && targetRetainership.status === "rejected") {
      return NextResponse.json(
        { error: "Cannot transfer tasks to a rejected retainership" },
        { status: 400 },
      );
    }

    // The task follows the target retainership's client. A target with no
    // client has nothing to follow, so the task keeps the one it has.
    const targetClientId =
      isCrossRetainership &&
      targetRetainership.clientId &&
      targetRetainership.clientId !== retainership.clientId
        ? targetRetainership.clientId
        : null;
    const targetClientName =
      targetClientId && targetRetainership.client
        ? clientDisplayName(targetRetainership.client)
        : null;

    // Re-filtered rather than trusted: the source filter is what stops a crafted
    // request from moving tasks that do not belong to this retainership, and a
    // task already on the target is dropped rather than rewritten.
    const eligibleTasks = await prisma.task.findMany({
      where: {
        AND: [
          taskFilter,
          { id: { in: taskIds } },
          {
            OR: [
              { legislationId: { not: targetLegislation.id } },
              { legislationId: null },
            ],
          },
        ],
      },
      select: {
        id: true,
        title: true,
        legislationId: true,
        legislation: { select: { id: true, title: true } },
      },
    });

    if (eligibleTasks.length === 0) {
      return NextResponse.json(
        {
          error:
            "None of the selected tasks can be transferred. They may have been deleted, moved, or already be in the target legislation.",
        },
        { status: 409 },
      );
    }

    const eligibleIds = eligibleTasks.map((task) => task.id);
    const skippedCount = taskIds.length - eligibleIds.length;

    const actor = actorFromAdmin(currentAdmin);

    const transferred = await withActor(actor, async () =>
      prisma.task.updateMany({
        where: { id: { in: eligibleIds }, OR: [...NOT_DELETED.OR] },
        data: {
          legislationId: targetLegislation.id,
          retainershipId: targetRetainership.id,
          ...(targetClientId ? { clientId: targetClientId } : {}),
          // A legislation task belongs to the agent who owns the legislation.
          // Left unset when the target has no agent, so an existing assignment
          // is not wiped in exchange for nothing.
          ...(targetLegislation.assignedAgentId
            ? {
                assignedToId: targetLegislation.assignedAgentId,
                ownerShipId: targetLegislation.assignedAgentId,
              }
            : {}),
        },
      }),
    );

    const targetLabel = isCrossRetainership
      ? `legislation "${targetLegislation.title}" on retainership "${targetRetainership.name}"`
      : `legislation "${targetLegislation.title}"`;

    // One UPDATE row per task: the audit trail is keyed by entityId, so a single
    // summary row would leave the individual tasks with no record of the move.
    await Promise.all(
      eligibleTasks.map((task) =>
        recordUpdateAudit({
          entityType: "Task",
          entityId: task.id,
          entityName: task.title,
          changedFields: [
            `legislationId: transferred from ${
              task.legislation
                ? `legislation "${task.legislation.title}"`
                : "no legislation"
            } to ${targetLabel}`,
            ...(isCrossRetainership
              ? [
                  `retainershipId: moved from retainership "${retainership.name}" to "${targetRetainership.name}"`,
                ]
              : []),
            ...(targetClientId
              ? [`clientId: moved to client "${targetClientName}"`]
              : []),
            ...(targetLegislation.assignedAgentId
              ? ["assignedToId: reassigned to the target legislation's agent"]
              : []),
          ],
          actor,
          req,
        }),
      ),
    );

    // A retainership-wide transfer can draw from several legislations, so each
    // source legislation gets its own row naming how many tasks left it.
    const leftBySourceLegislation = new Map<
      string,
      { title: string; count: number }
    >();
    for (const task of eligibleTasks) {
      if (!task.legislation) continue;
      const entry = leftBySourceLegislation.get(task.legislation.id) ?? {
        title: task.legislation.title,
        count: 0,
      };
      entry.count += 1;
      leftBySourceLegislation.set(task.legislation.id, entry);
    }

    await Promise.all([
      ...[...leftBySourceLegislation].map(([legislationId, { title, count }]) =>
        recordUpdateAudit({
          entityType: "Legislation",
          entityId: legislationId,
          entityName: title,
          changedFields: [`tasks: ${count} task(s) transferred to ${targetLabel}`],
          actor,
          req,
        }),
      ),
      recordUpdateAudit({
        entityType: "Legislation",
        entityId: targetLegislation.id,
        entityName: targetLegislation.title,
        changedFields: [
          `tasks: ${transferred.count} task(s) received${
            isCrossRetainership
              ? ` from retainership "${retainership.name}"`
              : ""
          }`,
        ],
        actor,
        req,
      }),
      ...(isCrossRetainership
        ? [
            recordUpdateAudit({
              entityType: "Retainership",
              entityId: retainership.id,
              entityName: retainership.name,
              changedFields: [
                `tasks: ${transferred.count} task(s) transferred to retainership "${targetRetainership.name}"`,
              ],
              actor,
              req,
            }),
            recordUpdateAudit({
              entityType: "Retainership",
              entityId: targetRetainership.id,
              entityName: targetRetainership.name,
              changedFields: [
                `tasks: ${transferred.count} task(s) received from retainership "${retainership.name}"`,
              ],
              actor,
              req,
            }),
          ]
        : []),
      // The client audit is what the client pages read, so a cross-client move
      // is recorded there too rather than only on the retainerships.
      ...(targetClientId
        ? [
            recordUpdateAudit({
              entityType: "Client",
              entityId: targetClientId,
              entityName: targetClientName ?? "Unnamed client",
              changedFields: [
                `tasks: ${transferred.count} task(s) received from retainership "${retainership.name}"`,
              ],
              actor,
              req,
            }),
            ...(retainership.clientId
              ? [
                  recordUpdateAudit({
                    entityType: "Client",
                    entityId: retainership.clientId,
                    entityName: retainership.client
                      ? clientDisplayName(retainership.client)
                      : "Unnamed client",
                    changedFields: [
                      `tasks: ${transferred.count} task(s) transferred to client "${targetClientName}" (retainership "${targetRetainership.name}")`,
                    ],
                    actor,
                    req,
                  }),
                ]
              : []),
          ]
        : []),
    ]);

    const baseMessage = targetClientId
      ? `Transferred ${transferred.count} task(s) to ${targetLabel} (client "${targetClientName}").`
      : `Transferred ${transferred.count} task(s) to ${targetLabel}.`;

    return NextResponse.json({
      success: true,
      message:
        skippedCount > 0
          ? `${baseMessage} ${skippedCount} were skipped as no longer transferable.`
          : baseMessage,
      summary: {
        sourceRetainershipId: retainership.id,
        sourceLegislationId: sourceLegislationId ?? null,
        targetRetainershipId: targetRetainership.id,
        targetLegislationId: targetLegislation.id,
        crossRetainership: isCrossRetainership,
        targetClientId,
        transferredCount: transferred.count,
        skippedCount,
        transferredAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error transferring legislation tasks:", error);
    return NextResponse.json(
      { error: "Failed to transfer tasks" },
      { status: 500 },
    );
  }
}
