import prisma from "@/lib/prisma";
import { createTransporter } from "./email";
import { format } from "date-fns";

// Calculate next due date based on recurring months
export function calculateNextDueDate(
  currentDate: Date,
  recurringMonths: number,
): Date {
  const nextDate = new Date(currentDate);
  nextDate.setMonth(nextDate.getMonth() + recurringMonths);
  return nextDate;
}

// Auto-update recurring tasks based on calendar schedule (not completion)
export async function updateRecurringTaskSchedule(taskId: string) {
  const task: any = await prisma.task.findUnique({
    where: { id: taskId },
    include: { category: true },
  });

  if (!task || !task.recurring) return null;

  let recurringType: "day" | "week" | "month" = "month";
  let recurringValue = typeof task.recurring === "number" ? task.recurring : 1;

  if (typeof task.recurring === "string" && task.recurring.includes("-")) {
    const [type, value] = task.recurring.split("-");
    recurringType = type as "day" | "week" | "month";
    recurringValue = parseInt(value, 10);
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const triggerDate = new Date(task.triggerDate || task.dueDate);
  if (triggerDate < startOfToday || triggerDate > endOfToday) return null;

  const nextTriggerDate = new Date(triggerDate);
  if (recurringType === "day")
    nextTriggerDate.setDate(nextTriggerDate.getDate() + recurringValue);
  else if (recurringType === "week")
    nextTriggerDate.setDate(nextTriggerDate.getDate() + recurringValue * 7);
  else nextTriggerDate.setMonth(nextTriggerDate.getMonth() + recurringValue);

  const nextDueDate = new Date(nextTriggerDate);
  if (task.category?.timePeriod) {
    nextDueDate.setDate(
      nextDueDate.getDate() + Number(task.category.timePeriod),
    );
  }

  const dueDate = new Date(task.triggerDate || task.dueDate);
  if (task.category?.timePeriod) {
    dueDate.setDate(dueDate.getDate() + Number(task.category.timePeriod));
  }

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      triggerDate: nextTriggerDate,
      dueDate: dueDate,
      nextDueDate: nextDueDate,
      currentPeriodStart: triggerDate,
      completed: false,
      progress: 0,
      status: "To Do",
      active: true,
    },
  });

  return updatedTask;
}

// Update due dates for tasks in "Hold" status
export async function updateHoldTasks() {
  const holdTasks = await prisma.task.findMany({
    where: {
      status: "Hold",
      dueDate: { not: null },
    },
  });

  const updatedTasks = [];

  for (const task of holdTasks) {
    try {
      if (!task.dueDate) continue; // Ensure dueDate is not null

      // Extend due date by 1 day if the task is still on "Hold"
      if (task.dueDate && task.createdAt) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const due = new Date(task.dueDate);
        due.setHours(0, 0, 0, 0);

        const created = new Date(task.createdAt);
        created.setHours(0, 0, 0, 0);

        let newDueDate: Date;

        if (due < today) {
          const diffDays = Math.ceil(
            (due.getTime() - task.createdAt.getTime()) / (1000 * 60 * 60 * 24),
          );
          newDueDate = new Date(today);
          newDueDate.setDate(newDueDate.getDate() + diffDays);
        } else {
          newDueDate = new Date(due);
          newDueDate.setDate(newDueDate.getDate() + 1);
        }

        const updatedTask = await prisma.task.update({
          where: { id: task.id },
          data: { dueDate: newDueDate },
        });

        updatedTasks.push(updatedTask);
      }
    } catch (error) {
      console.error(`Error updating hold task ${task.id}:`, error);
    }
  }

  console.log(`📅 Auto-updated ${updatedTasks.length} tasks in "Hold" status.`);
  return updatedTasks;
}

// Extend updateAllRecurringTasks to include "Hold" tasks
export async function updateAllRecurringTasks() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  // Find all active recurring tasks
  const recurringTasks = await prisma.task.findMany({
    where: {
      recurring: { not: null },
      recurringType: { not: null },
      triggerDate: {
        gte: startOfToday,
        lt: startOfTomorrow,
      },
    },
  });

  const updatedTasks = [];

  for (const task of recurringTasks) {
    try {
      const updatedTask = await updateRecurringTaskSchedule(task.id);
      if (updatedTask && updatedTask.id !== task.id) {
        updatedTasks.push(updatedTask);
      }
    } catch (error) {
      console.error(`Error updating recurring task ${task.id}:`, error);
    }
  }

  const holdTasks = await updateHoldTasks();
  updatedTasks.push(...holdTasks);

  console.log(
    `📅 Auto-updated ${updatedTasks.length} tasks (recurring + hold).`,
  );
  return updatedTasks;
}

// Initialize recurring task fields when task is created with recurring
export async function initializeRecurringTask(
  taskId: string,
  recurringMonths: number,
  dueDate: Date,
) {
  const currentPeriodStart = new Date();

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      currentPeriodStart: currentPeriodStart as Date,
      nextDueDate: dueDate as Date,
    },
  });

  console.log(
    `🔄 Initialized recurring task. First due: ${dueDate.toISOString()}`,
  );
  return updatedTask;
}

// Get recurring task status info
export function getRecurringTaskStatus(task: {
  recurring?: number | null;
  nextDueDate?: Date | null;
  completed?: boolean;
  currentPeriodStart?: Date | null;
  lastCompletedDate?: Date | null;
  completionHistory?: unknown;
}) {
  if (!task.recurring) {
    return {
      isRecurring: false,
      currentPeriod: null,
      nextDue: null,
      completionCount: 0,
      isOverdue: false,
    };
  }

  const now = new Date();
  const completionHistory = Array.isArray(task.completionHistory)
    ? task.completionHistory
    : [];
  const nextDue = task.nextDueDate ? new Date(task.nextDueDate) : null;
  const isOverdue = nextDue ? now > nextDue && !task.completed : false;

  return {
    isRecurring: true,
    currentPeriod: task.currentPeriodStart
      ? new Date(task.currentPeriodStart)
      : null,
    nextDue,
    completionCount: completionHistory.length,
    isOverdue,
    lastCompleted: task.lastCompletedDate
      ? new Date(task.lastCompletedDate)
      : null,
  };
}

export async function sendActivityEmailsToAgents() {
  // Calculate yesterday's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const endOfYesterday = new Date(today);
  // end of yesterday is start of today (midnight)
  try {
    // Get all agents with their email
    const agents = await prisma.agent.findMany({
      where: { status: "active" },
      select: { id: true, name: true, email: true },
    });

    if (!agents.length) {
      return;
    }

    // Get all owners for CC
    const owners = await prisma.user.findMany({
      where: { adminType: "owner", status: "active" },
      select: { email: true, username: true },
    });

    const ownerEmails = owners.map((o) => o.email);

    // Send activity email to each agent
    for (const agent of agents) {
      try {
        // Fetch login history for the agent on this date
        const loginHistory = await prisma.loginHistory.findMany({
          where: {
            agentId: agent.id,
            loginAt: {
              gte: yesterday,
              lt: endOfYesterday,
            },
          },
          orderBy: { loginAt: "asc" },
        });

        // Fetch comments added for tasks by this agent
        const comments = await prisma.comment.findMany({
          where: {
            authorId: agent.id,
            createdAt: {
              gte: yesterday,
              lt: endOfYesterday,
            },
          },
          include: { task: true },
          orderBy: { createdAt: "asc" },
        });

        // Fetch timesheet entries for this agent
        const timesheetEntries = await prisma.timesheetEntry.findMany({
          where: {
            agentId: agent.id,
            date: {
              gte: yesterday,
              lt: endOfYesterday,
            },
          },
          orderBy: { date: "asc" },
        });

        // Build HTML email content
        const activityHTML = buildActivityEmailHTML(
          agent.name,
          loginHistory,
          comments,
          timesheetEntries,
          yesterday,
        );

        // Send email to agent with owners CC'd
        const transporter = createTransporter();
        await transporter.sendMail({
          from: `"${process.env.COMPANY_NAME || "LegalStanley"}" <${process.env.EMAIL_USER}>`,
          to: agent.email,
          cc: "Riyas.LegalStanley@gmail.com",
          // cc: "ranjithp5841@gmail.com",
          subject: `Daily Activity Report - ${formatDate(yesterday)}`,
          html: activityHTML,
          text: `Activity report for ${agent.name} on ${formatDate(yesterday)}`,
        });
      } catch (error) {
        console.error(`Error sending activity email to ${agent.name}:`, error);
      }
    }
  } catch (error) {
    console.error("Error in sendActivityEmailsToAgents:", error);
  }
}

// Helper function to format date
function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  return date.toLocaleDateString("en-US", options);
}

// Helper function to format time
function formatTime(date: Date | null): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

// Build HTML email with agent activities
function buildActivityEmailHTML(
  agentName: string,
  loginHistory: any[],
  comments: any[],
  timesheetEntries: any[],
  date: Date,
): string {
  const dateStr = formatDate(date);

  let html = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2c3e50; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
          .section { margin-bottom: 20px; }
          .section-title { background-color: #34495e; color: white; padding: 10px; border-radius: 3px; font-weight: bold; margin-bottom: 10px; }
          .activity-item { background-color: #f5f5f5; padding: 10px; margin-bottom: 8px; border-left: 4px solid #3498db; border-radius: 3px; }
          .login-item { border-left-color: #27ae60; }
          .logout-item { border-left-color: #e74c3c; }
          .comment-item { border-left-color: #f39c12; }
          .timesheet-item { border-left-color: #9b59b6; }
          .time-badge { background-color: #ecf0f1; padding: 2px 6px; border-radius: 3px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #ecf0f1; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Daily Activity Report</h2>
            <p><strong>Professional:</strong> ${agentName}</p>
            <p><strong>Date:</strong> ${dateStr}</p>
          </div>

          ${
            loginHistory.length > 0
              ? `
          <div class="section">
            <div class="section-title">Login/Logout History</div>
            ${loginHistory
              .map((log) => {
                const loginTime = formatTime(log.loginAt);
                const logoutTime = log.logoutAt
                  ? formatTime(log.logoutAt)
                  : "Still Online";
                return `
              <div class="activity-item login-item">
                <strong>Login:</strong> <span class="time-badge">${loginTime}</span>
                <strong>Logout:</strong> <span class="time-badge">${logoutTime}</span>
                ${log.device ? `<br><small>Device: ${log.device}</small>` : ""}
                ${log.location ? `<br><small>Location: ${log.location}</small>` : ""}
              </div>
            `;
              })
              .join("")}
          </div>
          `
              : ""
          }

          ${
            timesheetEntries.length > 0
              ? `
          <div class="section">
            <div class="section-title">Timesheet Entries</div>
            ${timesheetEntries
              .map((entry) => {
                return `
              <div class="activity-item timesheet-item">
                <strong>${entry.title}</strong><br>
                <span class="time-badge">${entry.startTime} - ${entry.endTime}</span><br>
                ${entry.project ? `<small>Project: ${entry.project}</small><br>` : ""}
                ${entry.description ? `<small>${entry.description}</small><br>` : ""}
                <small>Status: ${entry.status}</small>
              </div>
            `;
              })
              .join("")}
          </div>
          `
              : ""
          }

          ${
            comments.length > 0
              ? `
          <div class="section">
            <div class="section-title">Comments Added</div>
            ${comments
              .map((comment) => {
                return `
              <div class="activity-item comment-item">
                <strong>${comment.task.title}</strong><br>
                <p>${comment.content}</p>
                <small>
                  ${
                    comment.startTime
                      ? `Start Time: ${formatTime(comment.startTime)}<br>`
                      : ""
                  }
                  ${
                    comment.endTime
                      ? `End Time: ${formatTime(comment.endTime)}`
                        : ""
                  }
                </small>
              </div>
            `;
              })
              .join("")}
          </div>
          `
              : ""
          }

          ${
            loginHistory.length === 0 &&
            comments.length === 0 &&
            timesheetEntries.length === 0
              ? `
          <div class="section">
            <p><em>No activities recorded for this date.</em></p>
          </div>
          `
              : ""
          }

          <div class="section" style="margin-top:30px;">
            <hr style="border:none; border-top:1px solid #ddd; margin-bottom:15px;" />
            <p style="font-size:12px; font-style:italic; color:#555; line-height:1.6;">
              Please note that the above records reflect the activities undertaken by you on the specified date. 
              You are requested to ensure that all your daily interactions and work activities are properly logged 
              in the system for accurate documentation. Daily reports are regularly reviewed and form the basis 
              for performance evaluation, promotions, bonuses, salary increments, and continuous assessment.
            </p>
          </div>

        </div>
      </body>
    </html>
  `;

  return html;
}
