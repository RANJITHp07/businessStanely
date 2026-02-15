import * as cron from "node-cron";

class CronScheduler {
  private static instance: CronScheduler;
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

  private constructor() {}

  public static getInstance(): CronScheduler {
    if (!CronScheduler.instance) {
      CronScheduler.instance = new CronScheduler();
    }
    return CronScheduler.instance;
  }

  // Start the recurring tasks scheduler
  public startRecurringTasksScheduler() {
    // Start only the daily activity email scheduler (runs once per day)
    this.startDailyActivityEmailScheduler();

    return null;
  }

  // Start the daily activity email scheduler (runs once at midnight)
  public startDailyActivityEmailScheduler() {
    const taskName = "daily-activity-email";

    // Stop existing task if any
    this.stopTask(taskName);

    // Schedule to run daily at 8:00 AM UTC (0 8 * * *)
    const task = cron.schedule(
      "0 2 * * *",
      async () => {
        console.log(
          "📧 Running daily activity email job at:",
          new Date().toISOString(),
        );

        try {
          const { sendActivityEmailsToAgents } =
            (await import("./singleTaskRecurring")) as any;
          await sendActivityEmailsToAgents();
          console.log(`✅ Daily activity emails sent successfully.`);
        } catch (error) {
          console.error("❌ Error in daily activity email cron job:", error);
        }
      },
      {
        timezone: "UTC",
      },
    );

    this.scheduledTasks.set(taskName, task);

    console.log(
      `🚀 Daily activity email scheduler started (daily at 8:00 AM UTC)`,
    );

    return task;
  }

  // Stop a specific task
  public stopTask(taskName: string) {
    const task = this.scheduledTasks.get(taskName);
    if (task) {
      task.stop();
      this.scheduledTasks.delete(taskName);
      console.log(`🛑 Stopped cron task: ${taskName}`);
    }
  }

  // Stop all scheduled tasks
  public stopAllTasks() {
    for (const [taskName, task] of this.scheduledTasks.entries()) {
      task.stop();
      console.log(`🛑 Stopped cron task: ${taskName}`);
    }
    this.scheduledTasks.clear();
    console.log("🛑 All cron tasks stopped");
  }

  // Get status of all tasks
  public getTasksStatus() {
    return Array.from(this.scheduledTasks.entries()).map(([name]) => ({
      name,
      scheduled: true, // Task exists in map means it's scheduled
    }));
  }

  // Run the recurring tasks job manually (for testing)
  public async runRecurringTasksManually() {
    console.log("🧪 Running recurring tasks manually...");

    try {
      const { sendActivityEmailsToAgents } =
        (await import("./singleTaskRecurring")) as any;
      await sendActivityEmailsToAgents();
      console.log(`✅ Manual run completed. Sent activity emails to agents.`);
    } catch (error) {
      console.error("❌ Error in manual recurring tasks run:", error);
      throw error;
    }
  }
}

export default CronScheduler;
