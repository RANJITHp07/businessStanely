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

    // Restoring a retainership brings back the legislations that were cascaded
    // with it, but only those deleted in the same action — anything deleted
    // separately beforehand stays deleted.
    let restoredLegislationCount = 0;
    if (entityType === "Retainership") {
      const cascaded = await prismaRaw.legislation.updateMany({
        where: { retainershipId: entityId, deletedAt: existing.deletedAt },
        data: restoreData(),
      });
      restoredLegislationCount = cascaded.count;
    }

    await recordDeletionAudit({
      entityType: entityType as AuditEntityType,
      entityId,
      entityName: displayName(existing),
      action: "RESTORE",
      affectedLegislationCount: restoredLegislationCount,
      actor: actorFromAdmin(currentAdmin),
      req,
    });

    return NextResponse.json({
      message: "Record restored successfully",
      restoredLegislationCount,
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
