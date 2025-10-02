import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";
import { processRecurringTasks, processScheduledRecurringTasks } from "@/lib/recurringTasks";

export async function POST(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);
    
    if (!agent) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Process both types of recurring tasks
    await processScheduledRecurringTasks(); // Calendar-based
    await processRecurringTasks(); // Completion-based

    return NextResponse.json({ 
      message: "All recurring tasks processed successfully",
      types: ["scheduled", "completion-based"]
    });

  } catch (error) {
    console.error("Error processing recurring tasks:", error);
    return NextResponse.json(
      { error: "Failed to process recurring tasks" },
      { status: 500 }
    );
  }
}