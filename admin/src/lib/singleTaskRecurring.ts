import prisma from "@/lib/prisma";

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
