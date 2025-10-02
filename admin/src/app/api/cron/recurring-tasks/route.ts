import { NextResponse } from "next/server";
import { createCalendarBasedRecurringTasks } from "@/lib/recurringTasks";

export async function POST() {
  try {
    // Optional: Add authentication or API key validation here
    // const authHeader = request.headers.get('authorization');
    // if (!authHeader || authHeader !== 'Bearer YOUR_CRON_SECRET') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const createdTasks = await createCalendarBasedRecurringTasks();
    
    return NextResponse.json({
      success: true,
      message: `Created ${createdTasks.length} recurring tasks`,
      tasks: createdTasks,
    });
  } catch (error) {
    console.error("Error in cron job:", error);
    return NextResponse.json(
      { 
        error: "Failed to create recurring tasks",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: "Cron endpoint for creating recurring tasks" });
}