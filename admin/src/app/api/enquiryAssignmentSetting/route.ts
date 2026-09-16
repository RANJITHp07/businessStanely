import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { hasAdvisorRole } from "@/lib/agentRole";

/**
 * Who takes website (businessPlus) enquiries, and how many each takes before
 * the round-robin moves on.
 *
 * This is the enquiry twin of /api/prospectAssignmentSetting. The quota shares
 * the ProspectAssignmentSetting row (as enquiriesPerAgent) while the per-agent
 * opt-in is its own Agent column, enquiryAutoAssign, so ticking someone in for
 * enquiries does not silently add them to the leads rotation.
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const setting = await prisma.prospectAssignmentSetting.findFirst({
      select: { enquiriesPerAgent: true },
    });

    const agents = await prisma.agent.findMany({
      where: { status: "active" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        agentRole: true,
        agentType: true,
        advisorAgentType: true,
        enquiryAutoAssign: true,
      },
    });

    return NextResponse.json({
      enquiriesPerAgent: setting?.enquiriesPerAgent ?? 1,
      agents: agents.filter((agent) => hasAdvisorRole(agent.agentRole)),
    });
  } catch (error) {
    console.error("Failed to load enquiry assignment setting:", error);
    return NextResponse.json({ error: "Failed to load setting" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { enquiriesPerAgent, selectedAgentIds } = await req.json();

    if (
      typeof enquiriesPerAgent !== "number" ||
      !Number.isFinite(enquiriesPerAgent) ||
      enquiriesPerAgent < 1
    ) {
      return NextResponse.json(
        { message: "enquiriesPerAgent must be a number of at least 1" },
        { status: 400 },
      );
    }

    if (!Array.isArray(selectedAgentIds)) {
      return NextResponse.json(
        { message: "selectedAgentIds must be an array" },
        { status: 400 },
      );
    }

    /* Only Advisor Agents may be ticked in. Filtering here rather than trusting
       the body stops a hand-made request from routing enquiries to an execution
       agent who never sees the enquiries screen. */
    const eligible = await prisma.agent.findMany({
      where: { id: { in: selectedAgentIds }, status: "active" },
      select: { id: true, agentRole: true },
    });
    const validIds = eligible
      .filter((agent) => hasAdvisorRole(agent.agentRole))
      .map((agent) => agent.id);

    /* Clear then set, so unticking an agent actually removes them. Unlike the
       prospect route this runs even when the selection is empty — otherwise
       "untick everyone" would silently keep the previous rotation. */
    await prisma.agent.updateMany({
      where: { enquiryAutoAssign: true, id: { notIn: validIds } },
      data: { enquiryAutoAssign: false },
    });

    if (validIds.length) {
      await prisma.agent.updateMany({
        where: { id: { in: validIds } },
        data: { enquiryAutoAssign: true },
      });
    }

    const existing = await prisma.prospectAssignmentSetting.findFirst();
    const setting = existing
      ? await prisma.prospectAssignmentSetting.update({
          where: { id: existing.id },
          data: { enquiriesPerAgent },
        })
      : await prisma.prospectAssignmentSetting.create({
          data: { enquiriesPerAgent },
        });

    return NextResponse.json({
      enquiriesPerAgent: setting.enquiriesPerAgent,
      selectedAgentIds: validIds,
    });
  } catch (error) {
    console.error("Failed to save enquiry assignment setting:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
