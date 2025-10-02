// Initialize internal cron scheduler for recurring tasks
import InternalCronScheduler from '@/lib/cronScheduler';

let cronScheduler: InternalCronScheduler | null = null;

export function initializeCronScheduler() {
  if (typeof window === 'undefined') { // Server-side only
    try {
      cronScheduler = InternalCronScheduler.getInstance();
      cronScheduler.startRecurringTasksScheduler();
      console.log('✅ Internal cron scheduler initialized');
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