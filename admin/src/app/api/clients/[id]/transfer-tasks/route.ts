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
import { clientDisplayName } from "@/lib/entityNames";

/**
 * Moves a client's tasks and retainerships to another client.
 *
 * Two entry points share this route: the standalone "Transfer Tasks" action, and
 * the delete dialog's "transfer then delete" option (`deleteSource: true`).
 * Deleting a client is a soft delete, and soft delete does not cascade, so a
 * client deleted with work still attached leaves that work live but pointing at
 * a hidden parent. Transferring first is what keeps it reachable.
 *
 * Both models carry `clientId`, so both move together -- a retainership left on
 * the source would be split from the tasks that belong to it. Legislations
 * follow their retainership implicitly, since they hang off `retainershipId`.
 *
 * Every live task moves, completed ones included: the tasks are the client's
 * record of work, and splitting them across two clients on a status boundary
 * would leave the target with a partial history.
 */

/** Tasks that still exist. Soft-deleted rows are already hidden by the client extension. */
const LIVE_TASK_FILTER: Prisma.TaskWhereInput = { deletedAt: null };

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

    const [totalTasks, openTasks, retainerships, diaryEntries] =
      await Promise.all([
        prisma.task.count({ where: { clientId, ...LIVE_TASK_FILTER } }),
        prisma.task.count({
          where: {
            clientId,
            status: { notIn: ["Completed", "completed", "Abandoned"] },
            ...LIVE_TASK_FILTER,
          },
        }),
        prisma.retainership.count({ where: { clientId, deletedAt: null } }),
        prisma.clientDiaryEntry.count({ where: { clientId, deletedAt: null } }),
      ]);

    return NextResponse.json({
      clientId,
      clientName: clientDisplayName(client),
      counts: { totalTasks, openTasks, retainerships, diaryEntries },
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
 * Body: { targetClientId: string, deleteSource?: boolean }
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

    const result = await withActor(actor, async () => {
      const movedTasks = await prisma.task.updateMany({
        where: { clientId: sourceClientId, ...LIVE_TASK_FILTER },
        data: { clientId: targetClientId },
      });

      // Retainerships carry the same clientId, so leaving them behind would
      // strand a live retainership on a hidden client and split a task from the
      // retainership it belongs to. Their legislations follow implicitly --
      // those hang off retainershipId, not clientId.
      const movedRetainerships = await prisma.retainership.updateMany({
        where: { clientId: sourceClientId, deletedAt: null },
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

    // One UPDATE row per client so the move is visible from either side of the
    // audit trail, which is keyed by entityId.
    await recordUpdateAudit({
      entityType: "Client",
      entityId: sourceClientId,
      entityName: sourceName,
      changedFields: [
        `tasks: ${result.tasksTransferredCount} transferred to ${targetName}`,
        `retainerships: ${result.retainershipsTransferredCount} transferred to ${targetName}`,
      ],
      actor,
      req,
    });

    await recordUpdateAudit({
      entityType: "Client",
      entityId: targetClientId,
      entityName: targetName,
      changedFields: [
        `tasks: ${result.tasksTransferredCount} received from ${sourceName}`,
        `retainerships: ${result.retainershipsTransferredCount} received from ${sourceName}`,
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
        : `Transferred ${result.tasksTransferredCount} task(s) and ${result.retainershipsTransferredCount} retainership(s) to ${targetName}.`,
      summary: {
        sourceClientId,
        targetClientId,
        transferredAt: new Date().toISOString(),
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
