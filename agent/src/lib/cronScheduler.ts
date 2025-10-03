import * as cron from 'node-cron';

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
    const taskName = 'recurring-tasks';
    
    // Stop existing task if any
    this.stopTask(taskName);
    
    // Schedule to run daily at 9:00 AM UTC
    const task = cron.schedule('0 9 * * *', async () => {
      console.log('🔄 Running recurring tasks cron job at:', new Date().toISOString());
      
      try {
        const { updateAllRecurringTasks } = await import('./singleTaskRecurring');
        const updatedTasks = await updateAllRecurringTasks();
        console.log(`✅ Cron job completed. Auto-updated ${updatedTasks.length} recurring tasks.`);
        
        if (updatedTasks.length > 0) {
          console.log('📝 Updated tasks:');
          updatedTasks.forEach(task => {
            console.log(`  - ${task.title} (New due date: ${task.dueDate?.toISOString()?.split('T')[0]})`);
          });
        }
      } catch (error) {
        console.error('❌ Error in recurring tasks cron job:', error);
      }
    }, {
      timezone: 'UTC'
    });

    this.scheduledTasks.set(taskName, task);
    
    console.log(`🚀 Recurring tasks cron scheduler started (daily at 9:00 AM UTC)`);
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
    console.log('🛑 All cron tasks stopped');
  }

  // Get status of all tasks
  public getTasksStatus() {
    return Array.from(this.scheduledTasks.entries()).map(([name]) => ({
      name,
      scheduled: true // Task exists in map means it's scheduled
    }));
  }

  // Run the recurring tasks job manually (for testing)
  public async runRecurringTasksManually() {
    console.log('🧪 Running recurring tasks manually...');
    
    try {
      const { updateAllRecurringTasks } = await import('./singleTaskRecurring');
      const updatedTasks = await updateAllRecurringTasks();
      console.log(`✅ Manual run completed. Auto-updated ${updatedTasks.length} recurring tasks.`);
      return updatedTasks;
    } catch (error) {
      console.error('❌ Error in manual recurring tasks run:', error);
      throw error;
    }
  }
}

export default CronScheduler;