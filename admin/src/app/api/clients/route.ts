import { NextRequest, NextResponse } from "next/server";
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientType, email, ...clientData } = body;

    if (!clientType) {
      return NextResponse.json({ error: "Client type is required" }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const existingClient = await prisma.client.findUnique({
      where: { email },
    });

    if (existingClient) {
      return NextResponse.json({ error: "A client with this email already exists" }, { status: 409 });
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
      if (error.code === 'P2002') {
        return NextResponse.json({ error: "A client with this email already exists." }, { status: 409 });
      }
    }
    return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        tasks: {
          select: {
            status: true,
          },
        },
      },
    });

    // Add a `name` field prioritizing `organizationName` for organizations
    const clientsWithStatusCounts = clients.map(client => {
      // Count tasks by status
      const statusCounts = {};
      for (const task of client.tasks) {
        statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
      }
      return {
        ...client,
        name: client.organizationName || `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Unknown Name',
        statusCounts,
      };
    });

    return NextResponse.json(clientsWithStatusCounts);
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 });
  }
}