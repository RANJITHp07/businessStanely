import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const IST_TIME_ZONE = "Asia/Kolkata";

/**
 * TIMESHEET API DOCUMENTATION
 * ============================
 *
 * GET /api/timesheet
 *
 * Fetches timesheet entries combining task comments and login/logout history.
 *
 * QUERY PARAMETERS:
 * -----------------
 * @param {string} assignedToIds - Optional: Comma-separated agent IDs to fetch data for (default: current agent)
 * @param {string} startDate - Optional: ISO date string for start date (default: 7 days ago)
 * @param {string} endDate - Optional: ISO date string for end date (default: today)
 *
 * EXAMPLE REQUESTS:
 * -----------------
 * GET /api/timesheet
 *   Returns timesheet for current agent, last 7 days
 *
 * GET /api/timesheet?assignedToIds=id1,id2&startDate=2026-02-01&endDate=2026-02-15
 *   Returns timesheet for multiple agents with custom date range
 *
 * RESPONSE SCHEMA:
 * ----------------
 * {
 *   "timeEntries": [
 *     {
 *       "id": "task-0",
 *       "taskId": "task-123",
 *       "title": "Task Title",
 *       "description": "Comment content",
 *       "project": "Client Name",
 *       "date": "2026-02-15T10:30:00Z",
 *       "startTime": "10:30 AM",
 *       "endTime": "11:30 AM",
 *       "status": "pending|in-progress|completed",
 *       "type": "task|login|logout",
 *       "userId": "agent-id",
 *       "userName": "Agent Name",
 *       "commentAuthor": "Author Name",
 *       "commentId": "comment-id"
 *     }
 *   ],
 *   "dateRange": {
 *     "startDate": "2026-02-08T00:00:00Z",
 *     "endDate": "2026-02-15T00:00:00Z"
 *   }
 * }
 *
 * ENTRY TYPES:
 * -------------
 * - task: Regular task work entry with start/end time and description
 * - login: Agent login record with agent ID
 * - logout: Agent logout record with logout time
 *
 * DATA SOURCES:
 * -------------
 * - Task Entries: Extracted from Comment records on tasks
 *   - Uses comment.startTime as the work time
 *   - Uses comment.content as the description
 *   - Links to task.title and client information
 *
 * - Login/Logout: From LoginHistory records
 *   - login type: loginAt timestamp
 *   - logout type: logoutAt timestamp (only if exists)
 *
 * FILTERING:
 * ----------
 * All entries are filtered by:
 * 1. Agent(s) - via assignedToId or assignedToIds parameter
 * 2. Date Range - between startDate and endDate
 * 3. Task Status - includes only approved categories or uncategorized tasks
 */

export async function GET(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const assignedToIdsParam = searchParams.get("assignedToIds");

    // Date range (default: last 7 days)
    const now = new Date();
    const defaultStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : defaultStartDate;

    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : now;

    let where: Prisma.TaskWhereInput;

    if (assignedToIdsParam) {
      const assignedToIds = assignedToIdsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      where = {
        assignedToId: { in: assignedToIds },
        AND: [
          {
            OR: [{ category: null }, { category: { status: "approved" } }],
          },
          {
            comments: {
              some: {
                startTime: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            },
          },
        ],
      };
    } else {
      where = {
        assignedToId: agent.id,
        AND: [
          {
            OR: [{ category: null }, { category: { status: "approved" } }],
          },
          {
            comments: {
              some: {
                startTime: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            },
          },
        ],
      };
    }
    // ✅ FETCH BOTH TOGETHER
    const [tasks, loginHistory, timesheetEntries] = await Promise.all([
      prisma.task.findMany({
        where,
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
          agentId: {
            in: assignedToIdsParam
              ? assignedToIdsParam.split(",").map((id) => id.trim())
              : [agent.id],
          },
          OR: [
            {
              loginAt: {
                gte: startDate,
                lte: endDate,
              },
            },
            {
              logoutAt: {
                gte: startDate,
                lte: endDate,
              },
            },
          ],
        },
        orderBy: {
          loginAt: "desc",
        },
      }),

      prisma.timesheetEntry.findMany({
        where: {
          agentId: {
            in: assignedToIdsParam
              ? assignedToIdsParam.split(",").map((id) => id.trim())
              : [agent.id],
          },
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          agent: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          date: "desc",
        },
      }),
    ]);

    const timeEntries: any[] = [];
    let entryId = 0;

    // --------------------------
    // TASK ENTRIES
    // --------------------------
    tasks.forEach((task) => {
      const userId = agent.id;
      const userName = agent.name || agent.email;

      task.comments.forEach((comment) => {
        const commentDate = new Date(comment.startTime!);
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
          startTime: commentDate.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: IST_TIME_ZONE,
          }),
          endTime: new Date(
            commentDate.getTime() + 60 * 60 * 1000,
          ).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
            timeZone: IST_TIME_ZONE,
          }),
          status, // ✅ only pending | completed
          type: "task",
          userId,
          userName,
          commentAuthor: comment.agent?.name || "Unknown",
          commentId: comment.id,
        });
      });
    });

    // --------------------------
    // LOGIN / LOGOUT ENTRIES
    // --------------------------
    loginHistory.forEach((log) => {
      const loginDate = new Date(log.loginAt);

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
        status: "login", // ✅ login
        type: "login",
      });

      if (log.logoutAt) {
        const logoutDate = new Date(log.logoutAt);
        const logoutReason = log.logoutReason ?? "manual";

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
    });

    // --------------------------
    // TIMESHEET ENTRIES
    // --------------------------
    timesheetEntries.forEach((entry) => {
      const entryDate = new Date(entry.date);

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
        userName: entry.agent?.name || "Unknown",
      });
    });

    // --------------------------
    // SORT EVERYTHING TOGETHER
    // --------------------------
    timeEntries.sort((a, b) => b.date.getTime() - a.date.getTime());

    return NextResponse.json({
      timeEntries,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching timesheet tasks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
