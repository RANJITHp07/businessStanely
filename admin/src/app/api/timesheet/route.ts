import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";

const IST_TIME_ZONE = "Asia/Kolkata";

export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json({ error: "Agent ID required" }, { status: 400 });
    }

    // Date range (default: last 7 days)
    const now = new Date();
    const defaultStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : defaultStartDate;

    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : now;

    // Fetch tasks, login history and timesheet entries in parallel
    const [tasks, loginHistory, timesheetEntries] = await Promise.all([
      prisma.task.findMany({
        where: {
          assignedToId: agentId,
          AND: [
            {
              OR: [{ category: null }, { category: { status: "approved" } }],
            },
          ],
        },
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              organizationName: true,
              clientType: true,
              email: true,
            },
          },
          assignedTo: true,
          comments: {
            include: {
              user: true,
              agent: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.loginHistory.findMany({
        where: {
          agentId,
          OR: [
            { loginAt: { gte: startDate, lte: endDate } },
            { logoutAt: { gte: startDate, lte: endDate } },
          ],
        },
        orderBy: { loginAt: "desc" },
      }),

      prisma.timesheetEntry.findMany({
        where: { agentId },
        include: {
          agent: { select: { id: true, name: true, email: true } },
        },
        orderBy: { date: "desc" },
      }),
    ]);

    const timeEntries: any[] = [];
    let entryId = 0;

    // TASK ENTRIES (from comments)
    tasks.forEach((task) => {
      const userId = agentId;
      const userName = task.assignedTo?.name || "Unknown";

      task.comments.forEach((comment) => {
        const commentDate = comment.startTime
          ? new Date(comment.startTime)
          : new Date(comment.createdAt);

        if (commentDate >= startDate && commentDate <= endDate) {
          const status = task.status?.toLowerCase();

          timeEntries.push({
            id: `task-${entryId++}`,
            taskId: task.id,
            title: task.title,
            description: comment.content || "",
            project:
              task.client?.firstName ||
              task.client?.organizationName ||
              "Project",
            date: new Date(commentDate),
            startTime: comment.startTime
              ? new Date(comment.startTime).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                  timeZone: IST_TIME_ZONE,
                })
              : new Date(comment.createdAt).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                  timeZone: IST_TIME_ZONE,
                }),
            endTime: comment.endTime
              ? new Date(comment.endTime).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                  timeZone: IST_TIME_ZONE,
                })
              : new Date(
                  new Date(commentDate).getTime() + 60 * 60 * 1000,
                ).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                  timeZone: IST_TIME_ZONE,
                }),
            status,
            type: "task",
            userId,
            userName,
            commentAuthor:
              comment.agent?.name || comment.user?.username || "Unknown",
            commentId: comment.id,
          });
        }
      });
    });

    // LOGIN / LOGOUT ENTRIES
    loginHistory.forEach((log) => {
      const loginDate = new Date(log.loginAt);
      const logoutDate = log.logoutAt ? new Date(log.logoutAt) : null;
      const logoutReason = log.logoutReason ?? "manual";
      const syntheticSameTimeLogout =
        logoutDate &&
        logoutReason === "manual" &&
        logoutDate.getTime() - loginDate.getTime() <= 5000;

      if (loginDate >= startDate && loginDate <= endDate) {
        timeEntries.push({
          id: `login-${log.id}`,
          title: "Login",
          project: "System",
          date: new Date(loginDate),
          userId: log.agentId,
          startTime: loginDate.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: IST_TIME_ZONE,
          }),
          endTime: loginDate.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: IST_TIME_ZONE,
          }),
          status: "login",
          type: "login",
        });
      }

      if (logoutDate && !syntheticSameTimeLogout) {
        if (logoutDate >= startDate && logoutDate <= endDate) {
          timeEntries.push({
            id: `logout-${log.id}`,
            title:
              logoutReason === "session"
                ? "Session Logout"
                : logoutReason === "force"
                  ? "Force Logout"
                  : "Logout",
            project: "System",
            userId: log.agentId,
            date: logoutDate,
            startTime: logoutDate.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              timeZone: IST_TIME_ZONE,
            }),
            endTime: logoutDate.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              timeZone: IST_TIME_ZONE,
            }),
            status: "logout",
            type: "logout",
            logoutReason,
          });
        }
      }
    });

    // TIMESHEET ENTRIES (stored entries)
    timesheetEntries.forEach((entry) => {
      const entryDate = new Date(entry.date);

      if (entryDate >= startDate && entryDate <= endDate) {
        timeEntries.push({
          id: entry.id,
          title: entry.title,
          description: entry.description || "",
          project: entry.project || "Project",
          projectCode: entry.projectCode || "",
          date: entryDate,
          startTime: entry.startTime,
          endTime: entry.endTime,
          status: entry.status,
          type: entry.type,
          color: entry.color,
          userId: entry.agentId,
        });
      }
    });

    // Sort and return
    timeEntries.sort((a, b) => b.date.getTime() - a.date.getTime());

    return NextResponse.json({
      timeEntries,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching admin timesheet:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
