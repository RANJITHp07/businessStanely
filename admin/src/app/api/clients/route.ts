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

const CLIENT_OPTION_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  organizationName: true,
} as const;

// Only what the clients table renders and searches.
const CLIENT_TABLE_SELECT = {
  ...CLIENT_OPTION_SELECT,
  clientType: true,
  phoneNumber: true,
  address: true,
  gender: true,
  preferredCommunication: true,
  entityType: true,
  authorizedPersonName: true,
} as const;

/** `name` prioritises `organizationName`, for organizations. */
function withDisplayName<
  T extends { organizationName: string | null; firstName: string | null; lastName: string | null },
>(client: T) {
  return {
    ...client,
    name:
      client.organizationName ||
      `${client.firstName || ""} ${client.lastName || ""}`.trim() ||
      "Unknown Name",
  };
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

    const where = clientIds ? { id: { in: clientIds } } : undefined;
    const view = searchParams.get("view");

    // Pickers only need a label for each client, so they skip the task counts.
    if (view === "options") {
      const clients = await prisma.client.findMany({
        where,
        select: CLIENT_OPTION_SELECT,
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(clients.map(withDisplayName));
    }

    const clients = await prisma.client.findMany({
      where,
      ...(view === "table" ? { select: CLIENT_TABLE_SELECT } : {}),
      orderBy: {
        createdAt: "desc",
      },
    });
    const ids = clients.map((client) => client.id);

    // The Client -> Task/Retainership relation includes are unreliable on
    // MongoDB, so count tasks and retainerships directly by clientId. The
    // soft-delete extension injects the not-deleted filter: an explicit
    // `deletedAt: null` would suppress that and, on MongoDB, match nothing for
    // rows written before soft delete shipped.
    const [taskGroups, retainershipGroups] = await Promise.all([
      prisma.task.groupBy({
        by: ["clientId", "status"],
        where: { clientId: { in: ids } },
        _count: { _all: true },
      }),
      prisma.retainership.groupBy({
        by: ["clientId"],
        where: { clientId: { in: ids } },
        _count: { _all: true },
      }),
    ]);

    const statusCountsByClientId = new Map<string, Record<string, number>>();
    for (const group of taskGroups) {
      if (!group.clientId) continue;
      const counts = statusCountsByClientId.get(group.clientId) ?? {};
      counts[group.status] = group._count._all;
      statusCountsByClientId.set(group.clientId, counts);
    }
    const retainershipCountByClientId = new Map(
      retainershipGroups.map((group) => [group.clientId, group._count._all]),
    );

    const clientsWithStatusCounts = clients.map((client) => ({
      ...withDisplayName(client),
      statusCounts: statusCountsByClientId.get(client.id) ?? {},
      retainershipCount: retainershipCountByClientId.get(client.id) ?? 0,
    }));

    return NextResponse.json(clientsWithStatusCounts);
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 },
    );
  }
}
