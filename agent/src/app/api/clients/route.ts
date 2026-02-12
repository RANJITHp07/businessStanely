import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";

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
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);
    const { searchParams } = new URL(req.url);
    const assignedAgentId = searchParams.get("assignedToId");
    const clients = await prisma.client.findMany({
      where: assignedAgentId
        ? {
            retainerships: {
              some: {
                legislation: {
                  some: {
                    assignedAgentId: agent?.id,
                  },
                },
              },
            },
          }
        : undefined,
      orderBy: {
        createdAt: "desc",
      },
    });

    // Add computed `name` field
    const clientsWithName = clients.map((client) => ({
      ...client,
      name:
        client.organizationName ||
        `${client.firstName || ""} ${client.lastName || ""}`.trim(),
    }));

    return NextResponse.json(clientsWithName);
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 },
    );
  }
}
