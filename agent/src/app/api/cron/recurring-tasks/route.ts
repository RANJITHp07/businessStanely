import { NextRequest, NextResponse } from "next/server";
import { processRecurringTasks, processScheduledRecurringTasks } from "@/lib/recurringTasks";

// This endpoint can be called by a cron job or scheduler
export async function GET(req: NextRequest) {
  try {
    // Add simple API key authentication for cron jobs
    const authHeader = req.headers.get('authorization');
    const cronApiKey = process.env.CRON_API_KEY || 'your-secret-cron-key';
    
    if (authHeader !== `Bearer ${cronApiKey}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Process both types of recurring tasks
    await processScheduledRecurringTasks(); // Calendar-based automatic creation
    await processRecurringTasks(); // Completion-based creation

    return NextResponse.json({ 
      message: "All recurring tasks processed successfully",
      timestamp: new Date().toISOString(),
      types: ["scheduled", "completion-based"]
    });

  } catch (error) {
    console.error("Error in cron job:", error);
    return NextResponse.json(
      { error: "Failed to process recurring tasks" },
      { status: 500 }
    );
  }
}