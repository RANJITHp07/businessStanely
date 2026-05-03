import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";

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
  if (!value || value === "None") return null;
  return DURATION_MS[value] ?? null;
};

const hasExceededDuration = (
  referenceDate: Date,
  durationMs: number,
  pointInTime: Date,
): boolean => {
  return pointInTime.getTime() - referenceDate.getTime() > durationMs;
};

const durationLabelFromMs = (value: number): "24hr" | "48hr" | "1w" => {
  if (value === DURATION_MS["48hr"]) return "48hr";
  if (value === DURATION_MS["1w"]) return "1w";
  return "24hr";
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

const getClientName = (task: {
  client: {
    clientType: string;
    firstName: string | null;
    lastName: string | null;
    organizationName: string | null;
  } | null;
}) => {
  if (!task.client) return "N/A";
  if (task.client.clientType === "organization") {
    return task.client.organizationName || "N/A";
  }
  return (
    `${task.client.firstName || ""} ${task.client.lastName || ""}`.trim() ||
    "N/A"
  );
};

export async function GET(req: NextRequest) {
  try {
    const currentAgent = await getCurrentAgent(req);
    if (!currentAgent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const assignedToId = currentAgent.agentId;
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");

    let snapshotDate = new Date();
    if (dateParam) {
      const parsed = new Date(dateParam);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: "Invalid date format. Use YYYY-MM-DD" },
          { status: 400 },
        );
      }
      parsed.setHours(23, 59, 59, 999);
      snapshotDate = parsed;
    }

    const snapshotDateKey = snapshotDate.toISOString().slice(0, 10);

    const clientSelect = {
      select: {
        clientType: true,
        firstName: true,
        lastName: true,
        organizationName: true,
      },
    };

    const tasks = await prisma.task.findMany({
      where: {
        assignedToId,
        active: true,
        status: { notIn: ["Completed", "completed"] },
        createdAt: { lte: snapshotDate },
      },
      include: {
        client: clientSelect,
        comments: {
          where: { createdAt: { lte: snapshotDate } },
          select: { createdAt: true, content: true },
          orderBy: { createdAt: "desc" as const },
        },
        durationAudits: {
          where: { auditDate: { lte: snapshotDateKey } },
          select: { field: true, newValue: true, auditDate: true, changedAt: true },
          orderBy: [
            { auditDate: "desc" as const },
            { changedAt: "desc" as const },
          ],
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const notTouchedTasks = [] as Array<{
      id: string; title: string; status: string; priority: string;
      followUpDuration: string | null; statusCheckDuration: string | null;
      clientName: string; referenceAt: string;
    }>;

    const clientNotUpdatedTasks = [] as Array<{
      id: string; title: string; status: string; priority: string;
      followUpDuration: string | null; statusCheckDuration: string | null;
      clientName: string; referenceAt: string; expectedDuration: string;
    }>;

    const followUpStatusNotDoneTasks = [] as Array<{
      id: string; title: string; status: string; priority: string;
      followUpDuration: string | null; statusCheckDuration: string | null;
      clientName: string; referenceAt: string;
    }>;

    for (const task of tasks) {
      const latestAuditValue = (field: "followUpDuration" | "statusCheckDuration") => {
        const latestAudit = task.durationAudits.find((a) => a.field === field);
        return latestAudit?.newValue || null;
      };

      const effectiveFollowUpDuration =
        latestAuditValue("followUpDuration") || task.followUpDuration || "None";
      const effectiveStatusCheckDuration =
        latestAuditValue("statusCheckDuration") || task.statusCheckDuration || "None";

      const latestNormal = getLatestDate(task.comments, "NORMAL");
      const latestClientUpdate = getLatestDate(task.comments, "CLIENT_UPDATE");
      const latestAny = getLatestDate(task.comments, "ANY");
      const clientName = getClientName(task);

      if (effectiveFollowUpDuration === "None") {
        const reference = latestNormal || task.createdAt;
        if (hasExceededDuration(reference, DURATION_MS["24hr"], snapshotDate)) {
          notTouchedTasks.push({
            id: task.id, title: task.title, status: task.status,
            priority: task.priority, followUpDuration: effectiveFollowUpDuration,
            statusCheckDuration: effectiveStatusCheckDuration, clientName,
            referenceAt: reference.toISOString(),
          });
        }
      }

      const expectedMs =
        parseDurationMs(effectiveStatusCheckDuration) ||
        parseDurationMs(effectiveFollowUpDuration) ||
        DURATION_MS["24hr"];
      const clientReference = latestClientUpdate || task.createdAt;

      if (hasExceededDuration(clientReference, expectedMs, snapshotDate)) {
        clientNotUpdatedTasks.push({
          id: task.id, title: task.title, status: task.status,
          priority: task.priority, followUpDuration: effectiveFollowUpDuration,
          statusCheckDuration: effectiveStatusCheckDuration, clientName,
          referenceAt: clientReference.toISOString(),
          expectedDuration: durationLabelFromMs(expectedMs),
        });
      }

      const followUpDurationMs = parseDurationMs(effectiveFollowUpDuration);
      const isEligibleFollowUp = ["48hr", "1w"].includes(effectiveFollowUpDuration);

      if (isEligibleFollowUp && followUpDurationMs && !task.followUpRequired && !task.completed) {
        const reference = latestAny || task.createdAt;
        if (hasExceededDuration(reference, followUpDurationMs, snapshotDate)) {
          followUpStatusNotDoneTasks.push({
            id: task.id, title: task.title, status: task.status,
            priority: task.priority, followUpDuration: effectiveFollowUpDuration,
            statusCheckDuration: effectiveStatusCheckDuration, clientName,
            referenceAt: reference.toISOString(),
          });
        }
      }
    }

    const overdueRaw = await prisma.task.findMany({
      where: {
        assignedToId,
        active: true,
        status: { notIn: ["Completed", "completed"] },
        dueDate: { lte: snapshotDate, not: null },
      },
      select: {
        id: true, title: true, status: true, priority: true,
        followUpDuration: true, statusCheckDuration: true, dueDate: true,
        client: clientSelect,
      },
      orderBy: { dueDate: "asc" },
    });

    const overdueTasks = overdueRaw.map((task) => ({
      id: task.id, title: task.title, status: task.status, priority: task.priority,
      followUpDuration: task.followUpDuration, statusCheckDuration: task.statusCheckDuration,
      clientName: getClientName(task),
      referenceAt: task.dueDate?.toISOString() ?? "",
    }));

    return NextResponse.json({
      notTouchedTasks,
      clientNotUpdatedTasks,
      followUpStatusNotDoneTasks,
      overdueTasks,
    });
  } catch (error) {
    console.error("Error in agent dashboard-status route:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard status" },
      { status: 500 },
    );
  }
}
