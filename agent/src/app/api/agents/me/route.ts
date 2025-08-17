import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(agent);
  } catch (error) {
    console.error("Error fetching current agent:", error);
    return NextResponse.json({ error: "Failed to fetch current agent" }, { status: 500 });
  }
}
