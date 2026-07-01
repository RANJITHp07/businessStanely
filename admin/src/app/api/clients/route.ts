import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientType, email, ...clientData } = body;

    if (!clientType) {
      return NextResponse.json(
        { error: "Client type is required" },
        { status: 400 },
      );
    }

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const existingClient = await prisma.client.findUnique({
      where: { email },
    });

    if (existingClient) {
      return NextResponse.json(
        { error: "A client with this email already exists" },
        { status: 409 },
      );
    }

    const newClient = await prisma.client.create({
      data: {
        clientType,
        email,
        ...clientData,
      },
    });

    return NextResponse.json(newClient, { status: 201 });
  } catch (error) {
    console.error("Error creating client:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "A client with this email already exists." },
          { status: 409 },
        );
      }
    }
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const assignedToId = searchParams.get("assignedToId");

    let clientIds: string[] | undefined;
    if (assignedToId) {
      // The Client -> Retainership relation filter is unreliable on
      // MongoDB, so derive client ids from legislations assigned to the
      // agent instead, which filters correctly on assignedAgentId.
      const legislations = await prisma.legislation.findMany({
        where: { assignedAgentId: assignedToId },
        select: { retainership: { select: { clientId: true } } },
      });
      clientIds = Array.from(
        new Set(
          legislations
            .map((l) => l.retainership?.clientId)
            .filter((id): id is string => Boolean(id)),
        ),
      );
    }

    const clients = await prisma.client.findMany({
      where: clientIds ? { id: { in: clientIds } } : undefined,
      orderBy: {
        createdAt: "desc",
      },
    });

    // The Client -> Task/Retainership relation includes are unreliable on
    // MongoDB, so look up tasks and retainerships directly by clientId.
    const [tasksByClient, retainershipCountsByClient] = await Promise.all([
      prisma.task.findMany({
        where: { clientId: { in: clients.map((c) => c.id) } },
        select: { clientId: true, status: true },
      }),
      prisma.retainership.groupBy({
        by: ["clientId"],
        where: { clientId: { in: clients.map((c) => c.id) } },
        _count: { _all: true },
      }),
    ]);

    const retainershipCountByClientId = new Map(
      retainershipCountsByClient.map((r) => [r.clientId, r._count._all]),
    );

    // Add a `name` field prioritizing `organizationName` for organizations
    const clientsWithStatusCounts = clients.map((client) => {
      // Count tasks by status
      const statusCounts: Record<string, number> = {};
      for (const task of tasksByClient) {
        if (task.clientId !== client.id) continue;
        statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
      }
      const retainershipCount = retainershipCountByClientId.get(client.id) || 0;
      return {
        ...client,
        name:
          client.organizationName ||
          `${client.firstName || ""} ${client.lastName || ""}`.trim() ||
          "Unknown Name",
        statusCounts,
        retainershipCount,
      };
    });

    return NextResponse.json(clientsWithStatusCounts);
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 },
    );
  }
}
