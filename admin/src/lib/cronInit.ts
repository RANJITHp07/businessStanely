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

// Auto-initialize only when a long-lived server process is actually running.
//
// On serverless (Amplify/Lambda) the container freezes between invocations, so
// a node-cron timer never fires -- but importing this module still started one
// per instance, and on any long-lived deployment that meant a second, unlocked
// path into updateAllRecurringTasks() racing the HTTP cron route, advancing
// every trigger date twice. The HTTP route at /api/cron/recurring-tasks is the
// single scheduled entry point; set ENABLE_INTERNAL_CRON=true to opt a
// self-hosted, single-instance deployment back into the in-process timer.
if (
  typeof window === 'undefined' &&
  process.env.NODE_ENV !== 'test' &&
  process.env.ENABLE_INTERNAL_CRON === 'true'
) {
  initializeCronScheduler();
}