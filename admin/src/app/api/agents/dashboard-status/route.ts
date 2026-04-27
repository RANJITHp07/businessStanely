import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

type InteractionKind = "NORMAL" | "CLIENT_UPDATE";

const DURATION_MS: Record<string, number> = {
  "24hr": 24 * 60 * 60 * 1000,
  "48hr": 48 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
};

const normalizeInteractionType = (content?: string): InteractionKind => {
  if (!content) return "NORMAL";
  if (content.startsWith("[CLIENT_UPDATE]")) return "CLIENT_UPDATE";
  if (content.startsWith("[NORMAL]")) return "NORMAL";
  return "NORMAL";
};

const parseDurationMs = (value?: string | null): number | null => {
  if (!value) return null;
  return DURATION_MS[value] ?? null;
};

const hasExceededDuration = (
  referenceDate: Date,
  durationMs: number,
): boolean => {
  return Date.now() - referenceDate.getTime() > durationMs;
};

const isCompletedStatus = (status?: string | null): boolean => {
  return (status || "").trim().toLowerCase() === "completed";
};

const getLatestDate = (
  comments: Array<{ createdAt: Date; content: string | null }>,
  type: InteractionKind | "ANY",
): Date | null => {
  const filtered =
    type === "ANY"
      ? comments
      : comments.filter(
          (comment) => normalizeInteractionType(comment.content || "") === type,
        );

  if (filtered.length === 0) return null;

  return filtered.reduce(
    (latest, current) =>
      current.createdAt > latest ? current.createdAt : latest,
    filtered[0].createdAt,
  );
};

export async function GET(req: NextRequest) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const assignedToId = searchParams.get("assignedToId");

    if (!assignedToId) {
      return NextResponse.json(
        { error: "assignedToId is required" },
        { status: 400 },
      );
    }

    const tasks = await prisma.task.findMany({
      where: {
        assignedToId,
        active: true,
        status: { notIn: ["Completed", "completed"] },
      },
      include: {
        client: {
          select: {
            id: true,
            clientType: true,
            firstName: true,
            lastName: true,
            organizationName: true,
          },
        },
        comments: {
          select: {
            createdAt: true,
            content: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const notTouchedTasks = [] as Array<{
      id: string;
      title: string;
      status: string;
      priority: string;
      followUpDuration: string | null;
      statusCheckDuration: string | null;
      clientName: string;
      referenceAt: string;
    }>;

    const clientNotUpdatedTasks = [] as Array<{
      id: string;
      title: string;
      status: string;
      priority: string;
      followUpDuration: string | null;
      statusCheckDuration: string | null;
      clientName: string;
      referenceAt: string;
      expectedDuration: string;
    }>;

    const followUpStatusNotDoneTasks = [] as Array<{
      id: string;
      title: string;
      status: string;
      priority: string;
      followUpDuration: string | null;
      statusCheckDuration: string | null;
      clientName: string;
      referenceAt: string;
    }>;

    for (const task of tasks) {
      if (isCompletedStatus(task.status)) continue;

      const clientName = task.client
        ? task.client.clientType === "organization"
          ? task.client.organizationName || "N/A"
          : `${task.client.firstName || ""} ${task.client.lastName || ""}`.trim() ||
            "N/A"
        : "N/A";

      const latestNormal = getLatestDate(task.comments, "NORMAL");
      const latestClientUpdate = getLatestDate(task.comments, "CLIENT_UPDATE");
      const latestAny = getLatestDate(task.comments, "ANY");

      // 1) Not Touched: follow-up None + no normal interaction in last 24h
      if ((task.followUpDuration || "None") === "None") {
        const reference = latestNormal || task.createdAt;
        if (hasExceededDuration(reference, DURATION_MS["24hr"])) {
          notTouchedTasks.push({
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            followUpDuration: task.followUpDuration || null,
            statusCheckDuration: task.statusCheckDuration || null,
            clientName,
            referenceAt: reference.toISOString(),
          });
        }
      }

      // 2) Client Not Updated: any follow-up + only client-update interactions + overdue by expected duration
      const expectedMs =
        parseDurationMs(task.statusCheckDuration) ||
        parseDurationMs(task.followUpDuration) ||
        DURATION_MS["24hr"];
      const clientUpdateReference = latestClientUpdate || task.createdAt;
      if (hasExceededDuration(clientUpdateReference, expectedMs)) {
        clientNotUpdatedTasks.push({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          followUpDuration: task.followUpDuration || null,
          statusCheckDuration: task.statusCheckDuration || null,
          clientName,
          referenceAt: clientUpdateReference.toISOString(),
          expectedDuration:
            Object.entries(DURATION_MS).find(
              ([, value]) => value === expectedMs,
            )?.[0] || "24hr",
        });
      }

      // 3) Follow-up & Status Not Done: 48hr/1w + no interaction in duration + follow-up not completed + status not updated
      const followUpDurationMs = parseDurationMs(task.followUpDuration);
      const isEligibleFollowUp = ["48hr", "1w"].includes(
        task.followUpDuration || "",
      );
      const followUpNotDone = !task.followUpRequired;
      const statusNotUpdated = !task.completed;

      if (
        isEligibleFollowUp &&
        followUpDurationMs &&
        followUpNotDone &&
        statusNotUpdated
      ) {
        const reference = latestAny || task.createdAt;
        if (hasExceededDuration(reference, followUpDurationMs)) {
          followUpStatusNotDoneTasks.push({
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            followUpDuration: task.followUpDuration || null,
            statusCheckDuration: task.statusCheckDuration || null,
            clientName,
            referenceAt: reference.toISOString(),
          });
        }
      }
    }

    return NextResponse.json({
      notTouchedTasks,
      clientNotUpdatedTasks,
      followUpStatusNotDoneTasks,
    });
  } catch (error) {
    console.error("Error in dashboard-status route:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard status" },
      { status: 500 },
    );
  }
}
