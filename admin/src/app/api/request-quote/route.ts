import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

type AgentSummary = {
  id: string;
  name: string;
  email: string;
  agentType: string;
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
    acceptedAt: quote.acceptedAt ? quote.acceptedAt.toISOString() : null,
  };
};

export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quoteRequests = await prisma.quoteRequest.findMany({
      include: {
        assignedAgent: {
          select: {
            id: true,
            name: true,
            email: true,
            agentType: true,
          },
        },
        createdByUser: {
          select: {
            username: true,
          },
        },
        createdByAgent: {
          select: {
            name: true,
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
    console.error("Error fetching quote requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote requests" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      select: { id: true },
    });

    if (!assignedAgent) {
      return NextResponse.json(
        { error: "Assigned agent not found" },
        { status: 404 },
      );
    }

    const created = await prisma.quoteRequest.create({
      data: {
        title: title.trim(),
        description: description?.trim() || "",
        status: "Requested",
        assignedAgentId,
        createdByUserId: admin.id,
      },
      include: {
        assignedAgent: {
          select: {
            id: true,
            name: true,
            email: true,
            agentType: true,
          },
        },
        createdByUser: {
          select: {
            username: true,
          },
        },
        createdByAgent: {
          select: {
            name: true,
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

export async function PATCH(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      id,
      title,
      description,
      status,
      assignedAgentId,
    }: {
      id?: string;
      title?: string;
      description?: string;
      status?: "Requested" | "Accepted" | "Rejected";
      assignedAgentId?: string;
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Quote request id is required" },
        { status: 400 },
      );
    }

    const updateData: {
      title?: string;
      description?: string;
      status?: string;
      assignedAgent?: { connect: { id: string } };
      acceptedByAgent?: { disconnect: boolean };
      acceptedAt?: Date | null;
    } = {};

    if (typeof title !== "undefined") {
      if (!title.trim()) {
        return NextResponse.json(
          { error: "Title is required" },
          { status: 400 },
        );
      }
      updateData.title = title.trim();
    }

    if (typeof description !== "undefined") {
      updateData.description = description.trim();
    }

    if (status) {
      updateData.status = status;
      if (status !== "Accepted") {
        updateData.acceptedByAgent = { disconnect: true };
        updateData.acceptedAt = null;
      }
    }

    if (assignedAgentId) {
      updateData.assignedAgent = { connect: { id: assignedAgentId } };
    }

    const updated = await prisma.quoteRequest.update({
      where: { id },
      data: updateData,
      include: {
        assignedAgent: {
          select: {
            id: true,
            name: true,
            email: true,
            agentType: true,
          },
        },

        createdByUser: {
          select: {
            username: true,
          },
        },
        createdByAgent: {
          select: {
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ quoteRequest: mapQuoteRequest(updated) });
  } catch (error) {
    console.error("Error updating quote request:", error);
    return NextResponse.json(
      { error: "Failed to update quote request" },
      { status: 500 },
    );
  }
}
