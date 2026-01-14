import prisma from "@/lib/prisma";

// Calculate next due date based on recurring months
export function calculateNextDueDate(
  currentDate: Date,
  recurringMonths: number
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

  if (!task || !task.recurring || !task.dueDate) {
    return null;
  }

  let recurringType: "day" | "week" | "month" = "month";
  let recurringValue = typeof task.recurring === "number" ? task.recurring : 1;

  if (typeof task.recurring === "string" && task.recurring.includes("-")) {
    const [type, value] = task.recurring.split("-");
    recurringType = type as "day" | "week" | "month";
    recurringValue = parseInt(value, 10);
  }

  const now = new Date();
  const taskDueDate = new Date(task.dueDate);

  if (now <= taskDueDate) return null;

  let periodsPassed = 0;

  if (recurringType === "day") {
    const daysDiff =
      (now.getTime() - taskDueDate.getTime()) / (1000 * 60 * 60 * 24);
    periodsPassed = Math.floor(daysDiff / recurringValue);
  } else if (recurringType === "week") {
    const weeksDiff =
      (now.getTime() - taskDueDate.getTime()) / (1000 * 60 * 60 * 24 * 7);
    periodsPassed = Math.floor(weeksDiff / recurringValue);
  } else {
    const monthsDiff =
      (now.getFullYear() - taskDueDate.getFullYear()) * 12 +
      (now.getMonth() - taskDueDate.getMonth());
    periodsPassed = Math.floor(monthsDiff / recurringValue);
  }

  if (periodsPassed <= 0) return null;

  const newDueDate = new Date(taskDueDate);

  if (recurringType === "day") {
    newDueDate.setDate(
      newDueDate.getDate() + (periodsPassed + 1) * recurringValue
    );
  } else if (recurringType === "week") {
    newDueDate.setDate(
      newDueDate.getDate() + (periodsPassed + 1) * recurringValue * 7
    );
  } else {
    newDueDate.setMonth(
      newDueDate.getMonth() + (periodsPassed + 1) * recurringValue
    );
  }

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      dueDate: newDueDate,
      nextDueDate: newDueDate,
      currentPeriodStart: now,
      completed: false,
      progress: 0,
      status: "To Do",
    },
  });

  console.log(
    `🔄 Recurring task updated → newDueDate: ${newDueDate.toISOString()}`
  );

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

      const currentDate = new Date();
      const dueDate = new Date(task.dueDate);

      // Extend due date by 1 day if the task is still on "Hold"
      if (currentDate >= dueDate) {
        const newDueDate = new Date(dueDate);
        newDueDate.setDate(newDueDate.getDate() + 1);

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
      dueDate: { not: null },
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
    `📅 Auto-updated ${updatedTasks.length} tasks (recurring + hold).`
  );
  return updatedTasks;
}

// Initialize recurring task fields when task is created with recurring
export async function initializeRecurringTask(
  taskId: string,
  recurringMonths: number,
  dueDate: Date
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
    `🔄 Initialized recurring task. First due: ${dueDate.toISOString()}`
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
