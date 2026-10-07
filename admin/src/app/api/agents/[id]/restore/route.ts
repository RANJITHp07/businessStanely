import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import {
  AgentRemovalError,
  findRestorableRemoval,
  restoreAgent,
} from "@/lib/agentRemoval";

/** GET: the agent's latest removal that can still be restored, or null. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const removal = await findRestorableRemoval(id);
    return NextResponse.json({
      restorable: removal
        ? {
            kind: removal.kind,
            removedRole: removal.removedRole ?? null,
            mode: removal.mode ?? null,
            at: removal.at,
          }
        : null,
    });
  } catch (error) {
    console.error("Error checking agent restore:", error);
    return NextResponse.json(
      { error: "Failed to check restore" },
      { status: 500 },
    );
  }
}

/** POST: undo the latest removal (agent delete or role removal). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Restoring reverses another admin's decision, so it is owner-only, as
    // with every other restore.
    if (currentAdmin.adminType !== "owner") {
      return NextResponse.json(
        { error: "Only owners can restore deleted agents" },
        { status: 403 },
      );
    }

    const { id } = await params;
    const result = await restoreAgent(id, currentAdmin.id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof AgentRemovalError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error restoring agent:", error);
    return NextResponse.json({ error: "Failed to restore agent" }, { status: 500 });
  }
}
