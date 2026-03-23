import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";
import { hasAdvisorRole } from "@/lib/agentRole";

const includeConfig = {
  createdByUser: {
    select: {
      id: true,
      username: true,
      email: true,
    },
  },
  createdByAgent: {
    select: {
      id: true,
      name: true,
      email: true,
      agentType: true,
      agentRole: true,
    },
  },
  assignedAgent: {
    select: {
      id: true,
      name: true,
      email: true,
      agentType: true,
      agentRole: true,
    },
  },
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasAdvisorRole(agent.agentRole)) {
      return NextResponse.json(
        { error: "Only advisor agents can reject quote requests" },
        { status: 403 },
      );
    }

    const { id } = params;
    const quoteRequest = await prisma.quoteRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        assignedAgentId: true,
      },
    });

    if (!quoteRequest) {
      return NextResponse.json(
        { error: "Quote request not found" },
        { status: 404 },
      );
    }

    if (quoteRequest.assignedAgentId !== agent.id) {
      return NextResponse.json(
        { error: "Only assigned agent can reject this quote request" },
        { status: 403 },
      );
    }

    if (quoteRequest.status !== "Requested") {
      return NextResponse.json(
        { error: "Only requested quotes can be rejected" },
        { status: 400 },
      );
    }

    const updated = await prisma.quoteRequest.update({
      where: { id },
      data: {
        status: "Rejected",
        acceptedAt: null,
      },
      include: includeConfig,
    });

    return NextResponse.json({ quoteRequest: updated });
  } catch (error) {
    console.error("Error rejecting quote request:", error);
    return NextResponse.json(
      { error: "Failed to reject quote request" },
      { status: 500 },
    );
  }
}
