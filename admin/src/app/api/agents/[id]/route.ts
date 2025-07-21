import { NextRequest, NextResponse } from "next/server";
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: params.id },
      include: {
        subordinates: true,
        superior: true,
      },
    });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    return NextResponse.json(agent);
  } catch (error) {
    console.error(`Error fetching agent ${params.id}:`, error);
    return NextResponse.json({ error: "Failed to fetch agent" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { email, specializations, subordinates, ...agentData } = body;

    // Check if another user already exists with the same email
    const existingAgent = await prisma.agent.findUnique({
      where: { email },
    });

    if (existingAgent && existingAgent.id !== params.id) {
      return NextResponse.json(
        { error: "Another user with the same email already exists." },
        { status: 400 }
      );
    }

    const updatedAgent = await prisma.agent.update({
      where: { id: params.id },
      data: {
        ...agentData,
        email,
        specializations,
        ...(subordinates && {
          subordinates: {
            set: subordinates.map((id: string) => ({ id })),
          },
        }),
      },
      include: {
        superior: true,
        subordinates: true,
      },
    });

    return NextResponse.json(updatedAgent);
  } catch (error) {
    console.error(`Error updating agent ${params.id}:`, error);
    return NextResponse.json({ error: "Failed to update agent" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.agent.delete({
      where: { id: params.id },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(`Error deleting agent ${params.id}:`, error);
    return NextResponse.json({ error: "Failed to delete agent" }, { status: 500 });
  }
}