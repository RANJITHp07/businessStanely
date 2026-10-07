import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { recordUpdateAudit, actorFromAdmin } from "@/lib/audit";
import { withActor } from "@/lib/auditContext";
import { NOT_DELETED } from "@/lib/softDelete";
import { clientDisplayName } from "@/lib/entityNames";

/**
 * Converts one task between "normal" and "legislation".
 *
 * There is no type column: a task is a legislation task while `legislationId`
 * points at a Legislation, and normal while it is null. Converting is therefore
 * setting or clearing that id, with `retainershipId` kept in step.
 *
 * To legislation, the task is also handed to the legislation's agent, the same
 * as `retainerships/[id]/convert-tasks` does in bulk. Back to normal, the
 * assignee is left alone: there is no legislation agent to defer to, and
 * unassigning would drop the task out of everyone's queue.
 *
 * Moving a task that is already a legislation task to a different legislation
 * is not done here; that is `retainerships/[id]/transfer-tasks`.
 */

/*
 * Reads carry no `deletedAt` condition: the soft-delete extension injects the
 * absent-aware one. The write spells it out with NOT_DELETED, since the
 * extension does not rewrite update filters.
 */

const CLIENT_NAME_SELECT = {
  id: true,
  clientType: true,
  firstName: true,
  lastName: true,
  organizationName: true,
  email: true,
} satisfies Prisma.ClientSelect;

const TASK_SELECT = {
  id: true,
  title: true,
  clientId: true,
  legislationId: true,
  retainershipId: true,
  legislation: { select: { id: true, title: true, retainershipId: true } },
} satisfies Prisma.TaskSelect;

/** A rejected retainership is closed, so its legislations are not offered. */
const OPEN_RETAINERSHIP_FILTER: Prisma.RetainershipWhereInput = {
  status: { not: "rejected" },
};

/**
 * GET — the legislations this task could be filed under, grouped by
 * retainership.
 *
 * Limited to the task's own client's retainerships: a retainership belongs to
 * one client, so filing another client's task under it would split the task
 * from its client. A task with no client can go under any retainership, and
 * picks up that retainership's client.
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

    const { id } = await params;

    const task = await prisma.task.findFirst({
      where: { id },
      select: TASK_SELECT,
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const retainerships = await prisma.retainership.findMany({
      where: {
        ...OPEN_RETAINERSHIP_FILTER,
        ...(task.clientId ? { clientId: task.clientId } : {}),
      },
      select: {
        id: true,
        name: true,
        status: true,
        clientId: true,
        client: { select: CLIENT_NAME_SELECT },
        legislation: {
          select: {
            id: true,
            title: true,
            assignedAgentId: true,
            assignedAgent: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      task: {
        id: task.id,
        title: task.title,
        clientId: task.clientId,
        isLegislationTask: !!task.legislationId,
        legislation: task.legislation,
      },
      retainerships: retainerships.map(({ client, ...retainership }) => ({
        ...retainership,
        clientName: client ? clientDisplayName(client) : null,
      })),
    });
  } catch (error) {
    console.error("Error loading task conversion options:", error);
    return NextResponse.json(
      { error: "Failed to load conversion options" },
      { status: 500 },
    );
  }
}

/**
 * POST — convert the task.
 *
 * Body: { to: "legislation", legislationId: string } | { to: "normal" }
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

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const to: unknown = body.to;

    if (to !== "legislation" && to !== "normal") {
      return NextResponse.json(
        { error: 'to must be "legislation" or "normal"' },
        { status: 400 },
      );
    }

    const task = await prisma.task.findFirst({
      where: { id },
      select: TASK_SELECT,
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const actor = actorFromAdmin(currentAdmin);

    if (to === "normal") {
      // retainershipId alone also counts: convert-tasks stamps both, and a task
      // left with only the retainership would still show in its views.
      if (!task.legislationId && !task.retainershipId) {
        return NextResponse.json(
          { error: "This task is already a normal task" },
          { status: 409 },
        );
      }

      const retainership = task.retainershipId
        ? await prisma.retainership.findFirst({
            where: { id: task.retainershipId },
            select: { id: true, name: true },
          })
        : null;

      // Written as explicit nulls, not unset: the task list finds normal tasks
      // with `legislationId: null`, which on MongoDB does not match a missing
      // field.
      await withActor(actor, async () =>
        prisma.task.update({
          where: { id: task.id, OR: [...NOT_DELETED.OR] },
          data: { legislationId: null, retainershipId: null },
        }),
      );

      await recordUpdateAudit({
        entityType: "Task",
        entityId: task.id,
        entityName: task.title,
        changedFields: [
          `legislationId: converted to a normal task${
            task.legislation
              ? ` (was legislation "${task.legislation.title}")`
              : ""
          }`,
          ...(retainership
            ? [`retainershipId: unlinked from retainership "${retainership.name}"`]
            : []),
        ],
        actor,
        req,
      });

      if (task.legislation) {
        await recordUpdateAudit({
          entityType: "Legislation",
          entityId: task.legislation.id,
          entityName: task.legislation.title,
          changedFields: [`tasks: "${task.title}" converted to a normal task`],
          actor,
          req,
        });
      }

      return NextResponse.json({
        success: true,
        message: `"${task.title}" is now a normal task.`,
      });
    }

    // to === "legislation"
    const legislationId: string | undefined = body.legislationId;
    if (!legislationId) {
      return NextResponse.json(
        { error: "legislationId is required" },
        { status: 400 },
      );
    }

    if (task.legislationId) {
      return NextResponse.json(
        {
          error:
            "This task is already a legislation task. Use Transfer Tasks to move it to another legislation.",
        },
        { status: 409 },
      );
    }

    // A soft-deleted legislation is invisible to the extended client, so this
    // also rejects converting into one that was deleted.
    const legislation = await prisma.legislation.findFirst({
      where: { id: legislationId },
      select: {
        id: true,
        title: true,
        assignedAgentId: true,
        retainership: {
          select: {
            id: true,
            name: true,
            status: true,
            clientId: true,
            deletedAt: true,
          },
        },
      },
    });

    // A to-one relation is not filtered by the soft-delete extension, so the
    // retainership's own deletedAt is checked here.
    if (
      !legislation ||
      !legislation.retainership ||
      legislation.retainership.deletedAt
    ) {
      return NextResponse.json(
        { error: "Legislation not found" },
        { status: 404 },
      );
    }

    const retainership = legislation.retainership;

    if (retainership.status === "rejected") {
      return NextResponse.json(
        { error: "Cannot convert into a legislation of a rejected retainership" },
        { status: 400 },
      );
    }

    if (
      task.clientId &&
      retainership.clientId &&
      task.clientId !== retainership.clientId
    ) {
      return NextResponse.json(
        {
          error:
            "This legislation belongs to another client's retainership. Pick one of this task's client's retainerships.",
        },
        { status: 400 },
      );
    }

    // A task with no client takes the retainership's, so it shows up under the
    // same client as the retainership it now belongs to.
    const adoptClientId =
      !task.clientId && retainership.clientId ? retainership.clientId : null;

    await withActor(actor, async () =>
      prisma.task.update({
        where: { id: task.id, OR: [...NOT_DELETED.OR] },
        data: {
          legislationId: legislation.id,
          retainershipId: retainership.id,
          ...(adoptClientId ? { clientId: adoptClientId } : {}),
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

    await recordUpdateAudit({
      entityType: "Task",
      entityId: task.id,
      entityName: task.title,
      changedFields: [
        `legislationId: converted to legislation "${legislation.title}"`,
        `retainershipId: linked to retainership "${retainership.name}"`,
        ...(adoptClientId
          ? ["clientId: set to the retainership's client"]
          : []),
        ...(legislation.assignedAgentId
          ? ["assignedToId: reassigned to the legislation's agent"]
          : []),
      ],
      actor,
      req,
    });

    await recordUpdateAudit({
      entityType: "Legislation",
      entityId: legislation.id,
      entityName: legislation.title,
      changedFields: [`tasks: "${task.title}" converted to a legislation task`],
      actor,
      req,
    });

    return NextResponse.json({
      success: true,
      message: `"${task.title}" is now a legislation task under "${legislation.title}".`,
    });
  } catch (error) {
    console.error("Error converting task:", error);
    return NextResponse.json(
      { error: "Failed to convert task" },
      { status: 500 },
    );
  }
}
