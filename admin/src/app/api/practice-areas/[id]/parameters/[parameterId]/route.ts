import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import {
  actorFromAdmin,
  changedFields,
  recordDeletionAudit,
  recordUpdateAudit,
  softDeleteData,
} from "@/lib/audit";
import { withActor } from "@/lib/auditContext";
import prisma from "@/lib/prisma";
import { parameterTypeLabel, parseDefinitionInput } from "@/lib/practiceAreaParameters";
import {
  OBJECT_ID_PATTERN,
  countParameterUsage,
  titleTaken,
  toDefinition,
} from "@/lib/practiceAreaStore";

type RouteContext = { params: Promise<{ id: string; parameterId: string }> };

async function findParameter(params: RouteContext["params"]) {
  const { id, parameterId } = await params;
  if (!OBJECT_ID_PATTERN.test(id) || !OBJECT_ID_PATTERN.test(parameterId)) return null;
  return prisma.practiceAreaParameter.findFirst({
    where: { id: parameterId, practiceAreaId: id },
  });
}

// PUT /api/practice-areas/:id/parameters/:parameterId
export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await findParameter(params);
    if (!existing) {
      return NextResponse.json({ error: "Parameter not found" }, { status: 404 });
    }

    const parsed = parseDefinitionInput(await req.json());
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    // Stored answers were checked against the old type. Switching type under
    // them (Text -> Number, say) would leave answers the new type rejects.
    // Only a parameter nobody has answered yet may change type.
    if (parsed.data.type !== existing.type) {
      const usage = await countParameterUsage(existing.id);
      if (usage > 0) {
        return NextResponse.json(
          {
            error:
              `"${existing.title}" already has answers on ${usage} enquir${usage === 1 ? "y" : "ies"}, ` +
              `so its type cannot change from ${parameterTypeLabel(existing.type)}. ` +
              `Add a new parameter with the type you need and remove this one instead.`,
          },
          { status: 409 },
        );
      }
    }

    const siblings = await prisma.practiceAreaParameter.findMany({
      where: { practiceAreaId: existing.practiceAreaId },
      select: { id: true, title: true },
    });
    if (titleTaken(siblings, parsed.data.title, existing.id)) {
      return NextResponse.json(
        { error: `This parameter area already has a parameter called "${parsed.data.title}"` },
        { status: 409 },
      );
    }

    const actor = actorFromAdmin(currentAdmin);
    const updated = await withActor(actor, () =>
      prisma.practiceAreaParameter.update({ where: { id: existing.id }, data: parsed.data }),
    );

    await recordUpdateAudit({
      entityType: "PracticeAreaParameter",
      entityId: existing.id,
      entityName: updated.title,
      changedFields: changedFields(existing, { ...parsed.data }),
      actor,
      req,
    });

    return NextResponse.json({
      ...toDefinition(updated),
      usageCount: await countParameterUsage(existing.id),
    });
  } catch (error) {
    console.error("Error updating parameter area parameter:", error);
    return NextResponse.json({ error: "Failed to update parameter" }, { status: 500 });
  }
}

// DELETE /api/practice-areas/:id/parameters/:parameterId
// Soft delete only. Answers already on enquiries keep their snapshot and stay
// visible there.
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await findParameter(params);
    if (!existing) {
      return NextResponse.json({ error: "Parameter not found" }, { status: 404 });
    }

    const actor = actorFromAdmin(currentAdmin);
    const usage = await countParameterUsage(existing.id);

    await prisma.practiceAreaParameter.update({
      where: { id: existing.id },
      data: softDeleteData(actor),
    });

    await recordDeletionAudit({
      entityType: "PracticeAreaParameter",
      entityId: existing.id,
      entityName: existing.title,
      parentEntityType: "PracticeArea",
      parentEntityId: existing.practiceAreaId,
      actor,
      req,
    });

    return NextResponse.json({ message: "Parameter removed", preservedAnswerCount: usage });
  } catch (error) {
    console.error("Error deleting parameter area parameter:", error);
    return NextResponse.json({ error: "Failed to delete parameter" }, { status: 500 });
  }
}
