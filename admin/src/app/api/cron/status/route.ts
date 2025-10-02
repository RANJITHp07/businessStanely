import { NextResponse } from "next/server";
import InternalCronScheduler from "@/lib/cronScheduler";

export async function GET() {
  try {
    const cronScheduler = InternalCronScheduler.getInstance();
    const tasksStatus = cronScheduler.getTasksStatus();
    
    return NextResponse.json({
      success: true,
      scheduler: {
        running: tasksStatus.length > 0,
        tasks: tasksStatus,
      },
      message: "Cron scheduler status retrieved",
    });
  } catch (error) {
    console.error("Error getting cron status:", error);
    return NextResponse.json(
      { 
        error: "Failed to get cron status",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const cronScheduler = InternalCronScheduler.getInstance();
    cronScheduler.startRecurringTasksScheduler();
    
    return NextResponse.json({
      success: true,
      message: "Cron scheduler started/restarted",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error starting cron scheduler:", error);
    return NextResponse.json(
      { 
        error: "Failed to start cron scheduler",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const cronScheduler = InternalCronScheduler.getInstance();
    cronScheduler.stopAllTasks();
    
    return NextResponse.json({
      success: true,
      message: "All cron tasks stopped",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error stopping cron scheduler:", error);
    return NextResponse.json(
      { 
        error: "Failed to stop cron scheduler",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}