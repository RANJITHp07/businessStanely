import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { SOFT_DELETE_MODELS } from "@/lib/softDelete";

// GET /api/deletion-audits - Delete/restore/update history, newest first.
// Supports ?entityType=, ?entityId=, ?action=SOFT_DELETE|RESTORE|UPDATE,
// ?days=, ?page=, ?pageSize=
export async function GET(req: NextRequest) {
  try {
    const currentAdmin = await getCurrentAdmin(req);

    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // The audit trail names who deleted what, so it is owner-only.
    if (currentAdmin.adminType !== "owner") {
      return NextResponse.json(
        { error: "Only owners can view deletion audits" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const action = searchParams.get("action");
    const days = searchParams.get("days");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10))
    );

    const where = {
      ...(entityType && (SOFT_DELETE_MODELS as readonly string[]).includes(entityType)
        ? { entityType }
        : {}),
      ...(entityId ? { entityId } : {}),
      ...(action && ["SOFT_DELETE", "RESTORE", "UPDATE"].includes(action)
        ? { action }
        : {}),
      ...(days
        ? {
            createdAt: {
              gte: new Date(Date.now() - parseInt(days, 10) * 86400000),
            },
          }
        : {}),
    };

    const [audits, total] = await Promise.all([
      prisma.deletionAudit.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.deletionAudit.count({ where }),
    ]);

    return NextResponse.json({
      data: audits,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching deletion audits:", error);
    return NextResponse.json(
      { error: "Failed to fetch deletion audits" },
      { status: 500 }
    );
  }
}
