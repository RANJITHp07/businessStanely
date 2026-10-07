import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { actorFromAdmin } from "@/lib/audit";
import {
  AgentRemovalError,
  getRemovalSummary,
  removeAgent,
  type RemovalMode,
  type RemovalScope,
} from "@/lib/agentRemoval";

const SCOPES: RemovalScope[] = ["agent", "execution", "advisor"];
const MODES: RemovalMode[] = ["transfer", "soft-delete"];

/** GET: the counts the delete dialog shows before the admin chooses. */
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
    return NextResponse.json(await getRemovalSummary(id));
  } catch (error) {
    if (error instanceof AgentRemovalError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error loading agent removal summary:", error);
    return NextResponse.json(
      { error: "Failed to load agent summary" },
      { status: 500 },
    );
  }
}

/**
 * POST: delete the agent, or remove one role from a dual-role agent.
 * Body: { scope: "agent" | "execution" | "advisor",
 *         mode: "transfer" | "soft-delete",
 *         transferAgentId?, transferLeadsAgentId? }
 * See lib/agentRemoval.ts for what each combination does.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const scope: RemovalScope = body.scope ?? "agent";
    const mode: RemovalMode = body.mode;

    if (!SCOPES.includes(scope) || !MODES.includes(mode)) {
      return NextResponse.json(
        { error: "scope must be agent/execution/advisor and mode transfer/soft-delete" },
        { status: 400 },
      );
    }

    const audit = await removeAgent({
      agentId: id,
      scope,
      mode,
      transferAgentId: body.transferAgentId || undefined,
      transferLeadsAgentId: body.transferLeadsAgentId || undefined,
      actor: actorFromAdmin(currentAdmin),
      adminId: currentAdmin.id,
    });

    return NextResponse.json({ success: true, summary: audit });
  } catch (error) {
    if (error instanceof AgentRemovalError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error removing agent:", error);
    return NextResponse.json({ error: "Failed to delete agent" }, { status: 500 });
  }
}
