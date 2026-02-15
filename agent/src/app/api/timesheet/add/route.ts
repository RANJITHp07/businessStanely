import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * TIMESHEET ADD API DOCUMENTATION
 * ================================
 * 
 * POST /api/timesheet/add
 * 
 * Creates a new timesheet entry for the authenticated agent.
 * 
 * REQUEST SCHEMA:
 * ---------------
 * {
 *   "title": "string - REQUIRED - Entry title",
 *   "description": "string - OPTIONAL - Entry description",
 *   "project": "string - OPTIONAL - Project/client name",
 *   "projectCode": "string - OPTIONAL - Project code",
 *   "date": "string (ISO date) - REQUIRED - Entry date",
 *   "startTime": "string (HH:MM) - REQUIRED - Start time in 24-hour format",
 *   "endTime": "string (HH:MM) - REQUIRED - End time in 24-hour format",
 *   "status": "string - OPTIONAL - pending|in-progress|completed|break (default: pending)",
 *   "type": "string - OPTIONAL - task|login|logout (default: task)",
 *   "color": "string - OPTIONAL - blue|yellow|coral|green (default: blue)",
 *   "taskId": "string - OPTIONAL - Link to existing task"
 * }
 * 
 * EXAMPLE REQUEST:
 * ----------------
 * POST /api/timesheet/add
 * Content-Type: application/json
 * 
 * {
 *   "title": "Client Meeting",
 *   "description": "Discussed Q1 strategy with client",
 *   "project": "ABC Corporation",
 *   "date": "2026-02-15",
 *   "startTime": "10:30",
 *   "endTime": "11:30",
 *   "status": "completed",
 *   "type": "task",
 *   "color": "blue",
 *   "taskId": "task-123"
 * }
 * 
 * RESPONSE SUCCESS (201):
 * -----------------------
 * {
 *   "message": "Timesheet entry created successfully",
 *   "entry": {
 *     "id": "entry-id",
 *     "title": "Client Meeting",
 *     "description": "Discussed Q1 strategy with client",
 *     "project": "ABC Corporation",
 *     "projectCode": null,
 *     "date": "2026-02-15T00:00:00Z",
 *     "startTime": "10:30",
 *     "endTime": "11:30",
 *     "status": "completed",
 *     "type": "task",
 *     "color": "blue",
 *     "agentId": "agent-id",
 *     "taskId": "task-123",
 *     "createdAt": "2026-02-15T10:30:00Z",
 *     "updatedAt": "2026-02-15T10:30:00Z",
 *     "agent": {
 *       "id": "agent-id",
 *       "name": "Agent Name",
 *       "email": "agent@example.com"
 *     },
 *     "task": {
 *       "id": "task-123",
 *       "title": "Task Title"
 *     }
 *   }
 * }
 * 
 * RESPONSE ERROR (400):
 * --------------------
 * {
 *   "error": "Missing required fields: title, date, startTime, endTime"
 * }
 * 
 * RESPONSE ERROR (401):
 * --------------------
 * {
 *   "error": "Unauthorized"
 * }
 * 
 * TIMESHEET ENTRY SCHEMA:
 * -----------------------
 * Model: TimesheetEntry
 * 
 * Fields:
 *   id           - String @id (MongoDB ObjectId)
 *   title        - String (REQUIRED)
 *   description  - String? (optional)
 *   project      - String? (optional)
 *   projectCode  - String? (optional)
 *   date         - DateTime (REQUIRED)
 *   startTime    - String (HH:MM format, REQUIRED)
 *   endTime      - String (HH:MM format, REQUIRED)
 *   status       - String (pending|in-progress|completed|break, default: pending)
 *   type         - String (task|login|logout, default: task)
 *   color        - String (blue|yellow|coral|green, default: blue)
 *   agentId      - String @db.ObjectId (REQUIRED, FK to Agent)
 *   taskId       - String? @db.ObjectId (optional, FK to Task)
 *   createdAt    - DateTime (auto, default: now)
 *   updatedAt    - DateTime (auto)
 * 
 * Relations:
 *   agent        - Relation to Agent model
 *   task         - Relation to Task model (onDelete: SetNull)
 */

export async function POST(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      description,
      project,
      projectCode,
      date,
      startTime,
      endTime,
      status,
      type,
      color,
      taskId,
    } = body;

    // Validation
    if (!title || !date || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Missing required fields: title, date, startTime, endTime" },
        { status: 400 },
      );
    }

    // Create timesheet entry
    const timesheetEntry = await prisma.timesheetEntry.create({
      data: {
        title,
        description: description || null,
        project: project || null,
        projectCode: projectCode || null,
        date: new Date(date),
        startTime,
        endTime,
        status: status || "pending",
        type: type || "task",
        color: color || "blue",
        agentId: agent.id,
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
    });

    return NextResponse.json({
      message: "Timesheet entry created successfully",
      entry: timesheetEntry,
    });
  } catch (error) {
    console.error("Error creating timesheet entry:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
