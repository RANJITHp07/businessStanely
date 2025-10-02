import * as cron from 'node-cron';
import { createCalendarBasedRecurringTasks } from './recurringTasks';

class InternalCronScheduler {
  private static instance: InternalCronScheduler;
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

  private constructor() {}

  public static getInstance(): InternalCronScheduler {
    if (!InternalCronScheduler.instance) {
      InternalCronScheduler.instance = new InternalCronScheduler();
    }
    return InternalCronScheduler.instance;
  }

  // Start the recurring tasks scheduler
  public startRecurringTasksScheduler() {
    const taskName = 'recurring-tasks';
    
    // Stop existing task if any
    this.stopTask(taskName);
    
    // Schedule to run daily at 9:00 AM
    const scheduledTask = cron.schedule('0 9 * * *', async () => {
      console.log('🔄 Running recurring tasks cron job at:', new Date().toISOString());
      
      try {
        const createdTasks = await createCalendarBasedRecurringTasks();
        console.log(`✅ Cron job completed. Created ${createdTasks.length} recurring tasks.`);
        
        if (createdTasks.length > 0) {
          console.log('📝 Created tasks:');
          createdTasks.forEach(task => {
            console.log(`  - ${task.title} (Due: ${task.dueDate?.toISOString().split('T')[0]})`);
          });
        }
      } catch (error) {
        console.error('❌ Error in recurring tasks cron job:', error);
      }
    }, {
      timezone: 'UTC'   // Use UTC timezone for consistency
    });

    this.scheduledTasks.set(taskName, scheduledTask);
    
    console.log('🚀 Recurring tasks scheduler created (runs daily at 9:00 AM UTC)');
    return scheduledTask;
  }

  // Stop a specific task
  public stopTask(taskName: string) {
    const task = this.scheduledTasks.get(taskName);
    if (task) {
      task.stop();
      task.destroy();
      this.scheduledTasks.delete(taskName);
      console.log(`🛑 Stopped cron task: ${taskName}`);
    }
  }

  // Stop all scheduled tasks
  public stopAllTasks() {
    for (const [taskName, task] of this.scheduledTasks.entries()) {
      task.stop();
      task.destroy();
      console.log(`🛑 Stopped cron task: ${taskName}`);
    }
    this.scheduledTasks.clear();
    console.log('🛑 All cron tasks stopped');
  }

  // Get status of all tasks
  public getTasksStatus() {
    const status: Array<{name: string, scheduled: boolean}> = [];
    
    for (const [taskName, task] of this.scheduledTasks.entries()) {
      status.push({
        name: taskName,
        scheduled: !!task
      });
    }
    
    return status;
  }

  // Run the recurring tasks job manually (for testing)
  public async runRecurringTasksManually() {
    console.log('🧪 Running recurring tasks manually...');
    
    try {
      const createdTasks = await createCalendarBasedRecurringTasks();
      console.log(`✅ Manual run completed. Created ${createdTasks.length} recurring tasks.`);
      return createdTasks;
    } catch (error) {
      console.error('❌ Error in manual recurring tasks run:', error);
      throw error;
    }
  }
}

export default InternalCronScheduler;