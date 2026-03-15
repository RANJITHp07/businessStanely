import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";

type AgentSummary = {
  id: string;
  name: string;
  email: string;
  agentType: string;
  agentRole?: string;
};

type QuoteRequestResponse = {
  id: string;
  title: string;
  description: string;
  status: string;
  createdBy: string;
  creatorType: "admin" | "agent" | "unknown";
  createdAt: string;
  assignedTo: AgentSummary | null;
  acceptedBy: AgentSummary | null;
  acceptedAt: string | null;
};

const mapQuoteRequest = (quote: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: Date;
  acceptedAt: Date | null;
  assignedAgent: AgentSummary | null;
  acceptedByAgent: AgentSummary | null;
  createdByUser: { username: string } | null;
  createdByAgent: { name: string } | null;
}): QuoteRequestResponse => {
  const createdByUserName = quote.createdByUser?.username || "";
  const createdByAgentName = quote.createdByAgent?.name || "";

  let creatorType: "admin" | "agent" | "unknown" = "unknown";
  if (createdByUserName) {
    creatorType = "admin";
  } else if (createdByAgentName) {
    creatorType = "agent";
  }

  return {
    id: quote.id,
    title: quote.title,
    description: quote.description || "",
    status: quote.status,
    createdBy: createdByUserName || createdByAgentName || "Unknown",
    creatorType,
    createdAt: quote.createdAt.toISOString(),
    assignedTo: quote.assignedAgent,
    acceptedBy: quote.acceptedByAgent,
    acceptedAt: quote.acceptedAt ? quote.acceptedAt.toISOString() : null,
  };
};

export async function GET(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quoteRequests = await prisma.quoteRequest.findMany({
      where:
        agent.agentRole === "Advisor Agent"
          ? { assignedAgentId: agent.id }
          : { createdByAgentId: agent.id },
      include: {
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
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      quoteRequests: quoteRequests.map(mapQuoteRequest),
    });
  } catch (error) {
    console.error("Error fetching agent quote requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote requests" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (agent.agentRole !== "Execution Agent") {
      return NextResponse.json(
        { error: "Only execution agents can create quote requests" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const {
      title,
      description,
      assignedAgentId,
    }: {
      title?: string;
      description?: string;
      assignedAgentId?: string;
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!assignedAgentId?.trim()) {
      return NextResponse.json(
        { error: "Assigned agent is required" },
        { status: 400 },
      );
    }

    const assignedAgent = await prisma.agent.findUnique({
      where: { id: assignedAgentId },
      select: { id: true, agentRole: true },
    });

    if (!assignedAgent) {
      return NextResponse.json(
        { error: "Assigned agent not found" },
        { status: 404 },
      );
    }

    if (assignedAgent.agentRole !== "Advisor Agent") {
      return NextResponse.json(
        { error: "Quote requests can only be assigned to advisor agents" },
        { status: 400 },
      );
    }

    const created = await prisma.quoteRequest.create({
      data: {
        title: title.trim(),
        description: description?.trim() || "",
        status: "Requested",
        assignedAgentId,
        createdByAgentId: agent.id,
      },
      include: {
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
      },
    });

    return NextResponse.json(
      { quoteRequest: mapQuoteRequest(created) },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating quote request:", error);
    return NextResponse.json(
      { error: "Failed to create quote request" },
      { status: 500 },
    );
  }
}
