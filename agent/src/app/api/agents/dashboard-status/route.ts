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

/** Returns the more recent of two nullable dates. */
const maxDate = (a: Date | null, b: Date | null): Date | null => {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
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

const getLatestComment = (
  comments: Array<{ createdAt: Date; content: string | null }>,
  type: InteractionKind | "ANY",
): { createdAt: Date; content: string | null } | null => {
  const filtered =
    type === "ANY"
      ? comments
      : comments.filter(
          (comment) => normalizeInteractionType(comment.content || "") === type,
        );

  if (filtered.length === 0) return null;

  return filtered.reduce(
    (latest, current) =>
      current.createdAt > latest.createdAt ? current : latest,
    filtered[0],
  );
};

const cleanCommentContent = (content: string | null): string | null => {
  if (!content) return null;
  return (
    content
      .replace(/^\[CLIENT_UPDATE\]\s*/, "")
      .replace(/^\[NORMAL\]\s*/, "")
      .trim() || null
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

    const assignedToId = currentAgent.id;
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

    const [tasks, overdueRaw] = await Promise.all([
      prisma.task.findMany({
        where: {
          assignedToId,
          active: true,
          status: { in: ["In Progress", "in progress"] },
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
            select: {
              field: true,
              newValue: true,
              auditDate: true,
              changedAt: true,
            },
            orderBy: [
              { auditDate: "desc" as const },
              { changedAt: "desc" as const },
            ],
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.task.findMany({
        where: {
          assignedToId,
          active: true,
          status: { in: ["In Progress", "in progress"] },
          dueDate: { lte: snapshotDate, not: null },
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          followUpDuration: true,
          statusCheckDuration: true,
          dueDate: true,
          client: clientSelect,
        },
        orderBy: { dueDate: "asc" },
      }),
    ]);

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
      lastInteractionContent: string | null;
      lastInteractionAt: string | null;
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
      const latestAuditEntry = (
        field: "followUpDuration" | "statusCheckDuration",
      ) => task.durationAudits.find((a) => a.field === field) ?? null;

      const latestAuditValue = (
        field: "followUpDuration" | "statusCheckDuration",
      ) => latestAuditEntry(field)?.newValue || null;

      const effectiveFollowUpDuration =
        latestAuditValue("followUpDuration") || task.followUpDuration || "None";
      const effectiveStatusCheckDuration =
        latestAuditValue("statusCheckDuration") ||
        task.statusCheckDuration ||
        "None";

      const latestNormal = getLatestDate(task.comments, "NORMAL");
      const latestClientUpdate = getLatestDate(task.comments, "CLIENT_UPDATE");
      const latestAny = getLatestDate(task.comments, "ANY");
      const clientName = getClientName(task);

      // When a duration field is changed, the audit.changedAt acts as a clock
      // reset — the gap should be measured from max(lastRelevantComment, auditChangedAt)
      const followUpAuditAt =
        latestAuditEntry("followUpDuration")?.changedAt ?? null;
      const statusCheckAuditAt =
        latestAuditEntry("statusCheckDuration")?.changedAt ?? null;

      if (effectiveFollowUpDuration === "None") {
        const reference = maxDate(latestAny, followUpAuditAt) ?? task.createdAt;
        if (hasExceededDuration(reference, DURATION_MS["24hr"], snapshotDate)) {
          notTouchedTasks.push({
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            followUpDuration: effectiveFollowUpDuration,
            statusCheckDuration: effectiveStatusCheckDuration,
            clientName,
            referenceAt: reference.toISOString(),
          });
        }
      }

      const expectedMs =
        parseDurationMs(effectiveStatusCheckDuration) ||
        parseDurationMs(effectiveFollowUpDuration) ||
        DURATION_MS["24hr"];
      const clientAuditAt = statusCheckAuditAt ?? followUpAuditAt;
      const clientReference =
        maxDate(latestClientUpdate, clientAuditAt) ?? task.createdAt;

      if (hasExceededDuration(clientReference, expectedMs, snapshotDate)) {
        // Find the actual last CLIENT_UPDATE comment; fall back to last NORMAL comment
        const lastClientUpdateComment = getLatestComment(
          task.comments,
          "CLIENT_UPDATE",
        );
        const lastNormalComment = getLatestComment(task.comments, "NORMAL");
        const lastRelevantComment =
          lastClientUpdateComment ?? lastNormalComment;

        clientNotUpdatedTasks.push({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          followUpDuration: effectiveFollowUpDuration,
          statusCheckDuration: effectiveStatusCheckDuration,
          clientName,
          referenceAt: clientReference.toISOString(),
          expectedDuration: durationLabelFromMs(expectedMs),
          lastInteractionContent: cleanCommentContent(
            lastRelevantComment?.content ?? null,
          ),
          lastInteractionAt:
            lastRelevantComment?.createdAt.toISOString() ?? null,
        });
      }

      const followUpDurationMs = parseDurationMs(effectiveFollowUpDuration);
      const isEligibleFollowUp = ["24hr", "48hr", "1w"].includes(
        effectiveFollowUpDuration,
      );

      if (
        isEligibleFollowUp &&
        followUpDurationMs &&
        !task.followUpRequired &&
        !task.completed
      ) {
        const reference = maxDate(latestAny, followUpAuditAt) ?? task.createdAt;
        if (hasExceededDuration(reference, followUpDurationMs, snapshotDate)) {
          followUpStatusNotDoneTasks.push({
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            followUpDuration: effectiveFollowUpDuration,
            statusCheckDuration: effectiveStatusCheckDuration,
            clientName,
            referenceAt: reference.toISOString(),
          });
        }
      }
    }

    const overdueTasks = overdueRaw.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      followUpDuration: task.followUpDuration,
      statusCheckDuration: task.statusCheckDuration,
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
