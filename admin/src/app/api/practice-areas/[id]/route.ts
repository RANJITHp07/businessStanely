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
import {
  parameterTypeLabel,
  parseParameterList,
  parsePracticeAreaInput,
  type ParameterListItem,
} from "@/lib/practiceAreaParameters";
import {
  OBJECT_ID_PATTERN,
  countAreaUsage,
  countParameterUsage,
  ownerOnly,
  titleTaken,
  toDefinition,
} from "@/lib/practiceAreaStore";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/practice-areas/:id - the area with its parameters in form order
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!OBJECT_ID_PATTERN.test(id)) {
      return NextResponse.json({ error: "Practice area not found" }, { status: 404 });
    }

    const area = await prisma.practiceArea.findUnique({
      where: { id },
      include: {
        parameters: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      },
    });
    if (!area) {
      return NextResponse.json({ error: "Practice area not found" }, { status: 404 });
    }

    const { parameters, ...rest } = area;
    return NextResponse.json({
      ...rest,
      enquiryCount: await countAreaUsage(id),
      parameters: await Promise.all(
        parameters.map(async (row) => ({
          ...toDefinition(row),
          usageCount: await countParameterUsage(row.id),
        })),
      ),
    });
  } catch (error) {
    console.error("Error fetching parameter area:", error);
    return NextResponse.json({ error: "Failed to fetch parameter area" }, { status: 500 });
  }
}

// PUT /api/practice-areas/:id
// With a `parameters` array, that array becomes the area's full parameter
// list: entries with an id are updated, entries without one are added, and
// parameters left out are removed (soft deleted). Without it, parameters are
// left alone.
export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!OBJECT_ID_PATTERN.test(id)) {
      return NextResponse.json({ error: "Practice area not found" }, { status: 404 });
    }

    const existing = await prisma.practiceArea.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Practice area not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = parsePracticeAreaInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    let parameterList: ParameterListItem[] | null = null;
    if (body.parameters !== undefined) {
      const list = parseParameterList(body.parameters);
      if (!list.ok) {
        return NextResponse.json({ error: list.error }, { status: 400 });
      }
      parameterList = list.data;
    }

    const others = await prisma.practiceArea.findMany({ select: { id: true, title: true } });
    if (titleTaken(others, parsed.data.title, id)) {
      return NextResponse.json(
        { error: `A parameter area called "${parsed.data.title}" already exists` },
        { status: 409 },
      );
    }

    const actor = actorFromAdmin(currentAdmin);

    if (!parameterList) {
      const updated = await withActor(actor, () =>
        prisma.practiceArea.update({ where: { id }, data: parsed.data }),
      );
      await recordUpdateAudit({
        entityType: "PracticeArea",
        entityId: id,
        entityName: updated.title,
        changedFields: changedFields(existing, { ...parsed.data }),
        actor,
        req,
      });
      return NextResponse.json(updated);
    }

    // ---- Full parameter list: check everything before writing anything ----
    const current = await prisma.practiceAreaParameter.findMany({ where: { practiceAreaId: id } });
    const currentById = new Map(current.map((p) => [p.id, p]));

    for (const item of parameterList) {
      if (!item.id) continue;
      const before = OBJECT_ID_PATTERN.test(item.id) ? currentById.get(item.id) : undefined;
      if (!before) {
        return NextResponse.json(
          { error: "A parameter was changed or removed by someone else. Refresh and try again." },
          { status: 409 },
        );
      }
      // Stored answers were checked against the old type, so a parameter
      // anyone has answered keeps its type.
      if (item.type !== before.type) {
        const usage = await countParameterUsage(before.id);
        if (usage > 0) {
          return NextResponse.json(
            {
              error:
                `"${before.title}" already has answers on ${usage} enquir${usage === 1 ? "y" : "ies"}, ` +
                `so its type cannot change from ${parameterTypeLabel(before.type)}. ` +
                `Add a new parameter with the type you need and remove this one instead.`,
            },
            { status: 409 },
          );
        }
      }
    }

    const keptIds = new Set(parameterList.flatMap((item) => (item.id ? [item.id] : [])));
    const removed = current.filter((p) => !keptIds.has(p.id));
    const deletedAt = new Date();

    const results = await withActor(actor, () =>
      prisma.$transaction([
        prisma.practiceArea.update({ where: { id }, data: parsed.data }),
        ...parameterList.map(({ id: parameterId, ...definition }, index) =>
          parameterId
            ? prisma.practiceAreaParameter.update({
                where: { id: parameterId },
                data: { ...definition, sortOrder: index },
              })
            : prisma.practiceAreaParameter.create({
                data: {
                  ...definition,
                  practiceAreaId: id,
                  sortOrder: index,
                  createdById: currentAdmin.id,
                },
              }),
        ),
        ...removed.map((p) =>
          prisma.practiceAreaParameter.update({
            where: { id: p.id },
            data: softDeleteData(actor, deletedAt),
          }),
        ),
      ]),
    );
    const updated = results[0];

    await recordUpdateAudit({
      entityType: "PracticeArea",
      entityId: id,
      entityName: updated.title,
      changedFields: changedFields(existing, { ...parsed.data }),
      actor,
      req,
    });
    for (const { id: parameterId, ...definition } of parameterList) {
      const before = parameterId ? currentById.get(parameterId) : undefined;
      if (!before) continue;
      await recordUpdateAudit({
        entityType: "PracticeAreaParameter",
        entityId: before.id,
        entityName: definition.title,
        changedFields: changedFields(before, { ...definition }),
        actor,
        req,
      });
    }
    for (const p of removed) {
      await recordDeletionAudit({
        entityType: "PracticeAreaParameter",
        entityId: p.id,
        entityName: p.title,
        parentEntityType: "PracticeArea",
        parentEntityId: id,
        actor,
        req,
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating parameter area:", error);
    return NextResponse.json({ error: "Failed to update parameter area" }, { status: 500 });
  }
}

// DELETE /api/practice-areas/:id
// Soft deletes the area and its parameters with one shared timestamp. Enquiries
// that picked it keep their answers, which carry their own title snapshots.
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const forbidden = ownerOnly(currentAdmin);
    if (forbidden) return forbidden;

    const { id } = await params;
    if (!OBJECT_ID_PATTERN.test(id)) {
      return NextResponse.json({ error: "Practice area not found" }, { status: 404 });
    }

    const existing = await prisma.practiceArea.findUnique({
      where: { id },
      include: { parameters: { select: { id: true, title: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Practice area not found" }, { status: 404 });
    }

    const actor = actorFromAdmin(currentAdmin);
    const deletedAt = new Date();

    await prisma.$transaction([
      prisma.practiceArea.update({
        where: { id },
        data: softDeleteData(actor, deletedAt),
      }),
      // updateMany is not a read, so the soft-delete extension adds no filter:
      // scope it to live rows so a parameter removed earlier keeps its stamp.
      prisma.practiceAreaParameter.updateMany({
        where: {
          practiceAreaId: id,
          OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
        },
        data: softDeleteData(actor, deletedAt),
      }),
    ]);

    await recordDeletionAudit({
      entityType: "PracticeArea",
      entityId: id,
      entityName: existing.title,
      actor,
      req,
    });
    for (const parameter of existing.parameters) {
      await recordDeletionAudit({
        entityType: "PracticeAreaParameter",
        entityId: parameter.id,
        entityName: parameter.title,
        reason: "Cascaded from parameter area deletion",
        parentEntityType: "PracticeArea",
        parentEntityId: id,
        actor,
        req,
      });
    }

    return NextResponse.json({ message: "Practice area deleted" });
  } catch (error) {
    console.error("Error deleting parameter area:", error);
    return NextResponse.json({ error: "Failed to delete parameter area" }, { status: 500 });
  }
}
