// Initialize cron scheduler for recurring tasks
import CronScheduler from "./cronScheduler";
let cronScheduler: CronScheduler | null = null;

export function initializeCronScheduler() {
  if (typeof window === 'undefined') { // Server-side only
    try {
      cronScheduler = CronScheduler.getInstance();
      cronScheduler.startRecurringTasksScheduler();
      console.log('✅ Cron scheduler initialized');
    } catch (error) {
      console.error('❌ Failed to initialize cron scheduler:', error);
    }
  }
}

export function getCronScheduler() {
  return cronScheduler;
}

// Auto-initialize if we're on the server
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  initializeCronScheduler();
}