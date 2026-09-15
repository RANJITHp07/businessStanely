import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import {
  recordDeletionAudit,
  recordUpdateAudit,
  actorFromAdmin,
  softDeleteData,
} from "@/lib/audit";
import { withActor } from "@/lib/auditContext";
import { NOT_DELETED } from "@/lib/softDelete";
import { clientDisplayName } from "@/lib/entityNames";

/**
 * Moves a client's tasks and retainerships to another client.
 *
 * Two entry points share this route: the standalone "Transfer Tasks" action, and
 * the delete dialog's "transfer then delete" option (`deleteSource: true`).
 * Deleting a client now cascades the soft delete to its tasks and retainerships,
 * so work left behind is hidden rather than orphaned. Transferring first is what
 * keeps it *live* under another client instead.
 *
 * Both models carry `clientId`, so both move together -- a retainership left on
 * the source would be split from the tasks that belong to it. Legislations
 * follow their retainership implicitly, since they hang off `retainershipId`.
 *
 * Scope is the caller's choice. With no `taskIds` the whole client moves --
 * every live task, completed ones included, plus the retainerships, because the
 * tasks are the client's record of work and splitting them on a status boundary
 * would leave the target with a partial history.
 *
 * With `taskIds` only those tasks move. Retainerships stay put in that case: a
 * retainership belongs to the client as a whole, and moving it because one of
 * its tasks was picked would drag along every sibling task still on the source.
 * A retainership task moved on its own keeps its retainershipId, so it stays
 * readable, but its retainership now sits under the other client.
 */

/**
 * Note on not-deleted filtering: reads here carry no `deletedAt` condition on
 * purpose. The client extension injects the correct one, and an explicit
 * `deletedAt: null` would both suppress that injection and silently match
 * nothing -- on MongoDB `null` does not match a document where the field is
 * absent, which is every row written before soft delete shipped. Writes are not
 * rewritten by the extension, so they spell the condition out with NOT_DELETED.
 */

const CLIENT_NAME_SELECT = {
  id: true,
  clientType: true,
  firstName: true,
  lastName: true,
  organizationName: true,
  email: true,
} satisfies Prisma.ClientSelect;

/**
 * GET — what a transfer from this client would move.
 *
 * The dialog shows these counts before the admin commits, so the confirmation
 * names a number rather than "some tasks".
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

    const { id: clientId } = await params;

    const client = await prisma.client.findFirst({
      where: { id: clientId },
      select: CLIENT_NAME_SELECT,
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const [totalTasks, openTasks, retainerships, diaryEntries, tasks] =
      await Promise.all([
        prisma.task.count({ where: { clientId } }),
        prisma.task.count({
          where: {
            clientId,
            status: { notIn: ["Completed", "completed", "Abandoned"] },
          },
        }),
        prisma.retainership.count({ where: { clientId } }),
        prisma.clientDiaryEntry.count({ where: { clientId } }),
        // The dialog's "selected tasks" mode picks from this list, so it ships
        // with the summary rather than costing a second round trip.
        prisma.task.findMany({
          where: { clientId },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            retainershipId: true,
            assignedTo: { select: { id: true, name: true } },
          },
        }),
      ]);

    return NextResponse.json({
      clientId,
      clientName: clientDisplayName(client),
      counts: { totalTasks, openTasks, retainerships, diaryEntries },
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        isRetainershipTask: !!task.retainershipId,
        assignedTo: task.assignedTo?.name ?? null,
      })),
    });
  } catch (error) {
    console.error("Error loading client transfer summary:", error);
    return NextResponse.json(
      { error: "Failed to load transfer summary" },
      { status: 500 },
    );
  }
}

/**
 * POST — move the tasks, optionally soft deleting the source afterwards.
 *
 * Body: { targetClientId: string, deleteSource?: boolean, taskIds?: string[] }
 *
 * Omit `taskIds` to move everything. Pass it to move only those tasks; see the
 * note above on why retainerships do not follow a partial move.
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

    const { id: sourceClientId } = await params;
    const body = await req.json().catch(() => ({}));

    const targetClientId: string | undefined = body.targetClientId;
    const deleteSource: boolean = body.deleteSource === true;

    // Absent means "everything". An explicit empty array is a caller bug rather
    // than a request to move nothing, so it is rejected below.
    const taskIds: string[] | undefined = Array.isArray(body.taskIds)
      ? body.taskIds
      : undefined;
    const isPartial = taskIds !== undefined;

    if (isPartial && taskIds.length === 0) {
      return NextResponse.json(
        { error: "taskIds cannot be empty" },
        { status: 400 },
      );
    }

    // Deleting the source while leaving some of its tasks behind would hide the
    // ones that did not move, which is the opposite of what transfer-then-delete
    // is for.
    if (isPartial && deleteSource) {
      return NextResponse.json(
        { error: "Cannot delete the source client during a partial transfer" },
        { status: 400 },
      );
    }

    if (!targetClientId) {
      return NextResponse.json(
        { error: "targetClientId is required" },
        { status: 400 },
      );
    }

    if (targetClientId === sourceClientId) {
      return NextResponse.json(
        { error: "Cannot transfer tasks to the same client" },
        { status: 400 },
      );
    }

    const [sourceClient, targetClient] = await Promise.all([
      prisma.client.findFirst({
        where: { id: sourceClientId },
        select: CLIENT_NAME_SELECT,
      }),
      prisma.client.findFirst({
        where: { id: targetClientId },
        select: CLIENT_NAME_SELECT,
      }),
    ]);

    if (!sourceClient) {
      return NextResponse.json(
        { error: "Source client not found" },
        { status: 404 },
      );
    }

    // A soft-deleted target is invisible to the extended client, so this also
    // rejects transferring into a client that was already deleted.
    if (!targetClient) {
      return NextResponse.json(
        { error: "Target client not found" },
        { status: 404 },
      );
    }

    const actor = actorFromAdmin(currentAdmin);
    const sourceName = clientDisplayName(sourceClient);
    const targetName = clientDisplayName(targetClient);

    // Scoping by id alone would let a caller move another client's tasks, so the
    // source clientId stays in the filter and the ids only narrow it further.
    const taskWhere = {
      clientId: sourceClientId,
      ...(isPartial ? { id: { in: taskIds } } : {}),
      OR: [...NOT_DELETED.OR],
    };

    // A requested id that is not on this client (or was already deleted) is
    // dropped by that filter; the response reports the shortfall rather than
    // failing. Zero matches means the whole request was wrong, so reject it.
    if (
      isPartial &&
      (await prisma.task.count({ where: taskWhere })) === 0
    ) {
      return NextResponse.json(
        { error: "None of the selected tasks belong to this client" },
        { status: 400 },
      );
    }

    const result = await withActor(actor, async () => {
      const movedTasks = await prisma.task.updateMany({
        where: taskWhere,
        data: { clientId: targetClientId },
      });

      // Retainerships carry the same clientId, so on a full move leaving them
      // behind would strand a live retainership on a hidden client and split a
      // task from the retainership it belongs to. Their legislations follow
      // implicitly -- those hang off retainershipId, not clientId.
      //
      // A partial move leaves them alone: see the note at the top of the file.
      const movedRetainerships = isPartial
        ? { count: 0 }
        : await prisma.retainership.updateMany({
            where: { clientId: sourceClientId, OR: [...NOT_DELETED.OR] },
            data: { clientId: targetClientId },
          });

      let sourceDeleted = false;
      if (deleteSource) {
        await prisma.client.update({
          where: { id: sourceClientId },
          data: softDeleteData(actor),
        });
        sourceDeleted = true;
      }

      return {
        tasksTransferredCount: movedTasks.count,
        retainershipsTransferredCount: movedRetainerships.count,
        sourceDeleted,
      };
    });

    // Reads as "3 of 12 tasks" in the audit trail, so a partial move is not
    // mistaken for a full one that happened to find only three tasks.
    const scopeLabel = isPartial ? ` (${taskIds.length} selected)` : "";

    // One UPDATE row per client so the move is visible from either side of the
    // audit trail, which is keyed by entityId.
    await recordUpdateAudit({
      entityType: "Client",
      entityId: sourceClientId,
      entityName: sourceName,
      changedFields: [
        `tasks: ${result.tasksTransferredCount} transferred to ${targetName}${scopeLabel}`,
        ...(isPartial
          ? []
          : [
              `retainerships: ${result.retainershipsTransferredCount} transferred to ${targetName}`,
            ]),
      ],
      actor,
      req,
    });

    await recordUpdateAudit({
      entityType: "Client",
      entityId: targetClientId,
      entityName: targetName,
      changedFields: [
        `tasks: ${result.tasksTransferredCount} received from ${sourceName}${scopeLabel}`,
        ...(isPartial
          ? []
          : [
              `retainerships: ${result.retainershipsTransferredCount} received from ${sourceName}`,
            ]),
      ],
      actor,
      req,
    });

    if (result.sourceDeleted) {
      await recordDeletionAudit({
        entityType: "Client",
        entityId: sourceClientId,
        entityName: sourceName,
        reason: `${result.tasksTransferredCount} task(s) and ${result.retainershipsTransferredCount} retainership(s) transferred to ${targetName} before deletion`,
        affectedTaskCount: result.tasksTransferredCount,
        actor,
        req,
      });
    }

    return NextResponse.json({
      success: true,
      message: result.sourceDeleted
        ? `Transferred ${result.tasksTransferredCount} task(s) and ${result.retainershipsTransferredCount} retainership(s) to ${targetName}, and deleted ${sourceName}.`
        : isPartial
          ? `Transferred ${result.tasksTransferredCount} selected task(s) to ${targetName}.`
          : `Transferred ${result.tasksTransferredCount} task(s) and ${result.retainershipsTransferredCount} retainership(s) to ${targetName}.`,
      summary: {
        sourceClientId,
        targetClientId,
        transferredAt: new Date().toISOString(),
        partial: isPartial,
        // Differs from tasksTransferredCount when an id was already moved,
        // deleted, or never belonged to this client.
        requestedTaskCount: isPartial ? taskIds.length : undefined,
        ...result,
      },
    });
  } catch (error) {
    console.error("Error transferring client tasks:", error);
    return NextResponse.json(
      { error: "Failed to transfer tasks" },
      { status: 500 },
    );
  }
}
