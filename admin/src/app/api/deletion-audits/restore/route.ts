import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { prismaRaw } from "@/lib/prisma";
import {
  recordDeletionAudit,
  actorFromAdmin,
  restoreData,
  AuditEntityType,
} from "@/lib/audit";
import { SOFT_DELETE_MODELS } from "@/lib/softDelete";

/**
 * POST /api/deletion-audits/restore
 * Body: { entityType, entityId }
 *
 * Clears a soft-delete stamp, bringing the row back into normal reads. Uses the
 * unfiltered client, since the row it needs to load is by definition hidden from
 * the extended one.
 */
export async function POST(req: NextRequest) {
  try {
    const currentAdmin = await getCurrentAdmin(req);

    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Restoring reverses another admin's decision, so it is owner-only.
    if (currentAdmin.adminType !== "owner") {
      return NextResponse.json(
        { error: "Only owners can restore deleted records" },
        { status: 403 }
      );
    }

    const { entityType, entityId } = await req.json();

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "entityType and entityId are required" },
        { status: 400 }
      );
    }

    if (!SOFT_DELETE_MODELS.includes(entityType)) {
      return NextResponse.json(
        { error: `Unsupported entityType: ${entityType}` },
        { status: 400 }
      );
    }

    const delegate = (prismaRaw as any)[
      entityType.charAt(0).toLowerCase() + entityType.slice(1)
    ];

    const existing = await delegate.findUnique({ where: { id: entityId } });

    if (!existing) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    if (!existing.deletedAt) {
      return NextResponse.json(
        { error: "Record is not deleted" },
        { status: 409 }
      );
    }

    await delegate.update({
      where: { id: entityId },
      data: restoreData(),
    });

    // Restoring a retainership brings back the legislations and tasks that were
    // cascaded with it, but only those deleted in the same action — anything
    // deleted separately beforehand stays deleted.
    let restoredLegislationCount = 0;
    let restoredTaskCount = 0;
    if (entityType === "Retainership") {
      const cascaded = await prismaRaw.legislation.updateMany({
        where: { retainershipId: entityId, deletedAt: existing.deletedAt },
        data: restoreData(),
      });
      restoredLegislationCount = cascaded.count;

      // Tasks hang off the retainership directly or off one of its
      // legislations, so both paths are matched. The legislation ids are read
      // after the restore above, when they are live again.
      const legislationIds = (
        await prismaRaw.legislation.findMany({
          where: { retainershipId: entityId },
          select: { id: true },
        })
      ).map((l) => l.id);

      const tasks = await prismaRaw.task.updateMany({
        where: {
          AND: [
            {
              OR: [
                { retainershipId: entityId },
                ...(legislationIds.length
                  ? [{ legislationId: { in: legislationIds } }]
                  : []),
              ],
            },
            { deletedAt: existing.deletedAt },
          ],
        },
        data: restoreData(),
      });
      restoredTaskCount = tasks.count;
    }

    // Restoring a client brings back the tasks, retainerships, legislations and
    // diary entries cascaded with it, matched on the shared delete timestamp so
    // anything deleted separately beforehand stays deleted.
    if (entityType === "Client") {
      const retainershipIds = (
        await prismaRaw.retainership.findMany({
          where: { clientId: entityId, deletedAt: existing.deletedAt },
          select: { id: true },
        })
      ).map((r) => r.id);

      const [tasks] = await prismaRaw.$transaction([
        prismaRaw.task.updateMany({
          where: { clientId: entityId, deletedAt: existing.deletedAt },
          data: restoreData(),
        }),
        prismaRaw.retainership.updateMany({
          where: { clientId: entityId, deletedAt: existing.deletedAt },
          data: restoreData(),
        }),
        prismaRaw.clientDiaryEntry.updateMany({
          where: { clientId: entityId, deletedAt: existing.deletedAt },
          data: restoreData(),
        }),
      ]);

      if (retainershipIds.length) {
        const legislations = await prismaRaw.legislation.updateMany({
          where: {
            retainershipId: { in: retainershipIds },
            deletedAt: existing.deletedAt,
          },
          data: restoreData(),
        });
        restoredLegislationCount = legislations.count;
      }

      restoredTaskCount = tasks.count;
    }

    await recordDeletionAudit({
      entityType: entityType as AuditEntityType,
      entityId,
      entityName: displayName(existing),
      action: "RESTORE",
      affectedTaskCount: restoredTaskCount,
      affectedLegislationCount: restoredLegislationCount,
      actor: actorFromAdmin(currentAdmin),
      req,
    });

    return NextResponse.json({
      message: "Record restored successfully",
      restoredLegislationCount,
      restoredTaskCount,
    });
  } catch (error) {
    console.error("Error restoring record:", error);
    return NextResponse.json(
      { error: "Failed to restore record" },
      { status: 500 }
    );
  }
}

/** Best-effort label across models with different name columns. */
function displayName(row: Record<string, unknown>): string {
  return (
    (row.name as string) ||
    (row.title as string) ||
    (row.organizationName as string) ||
    (row.heading as string) ||
    (row.email as string) ||
    "Untitled"
  );
}
