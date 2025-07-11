import { NextRequest, NextResponse } from "next/server";
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { specializations, ...agentData } = body;

    const newAgent = await prisma.agent.create({
      data: {
        ...agentData,
        specializations: {
          set: specializations,
        },
      },
    });

    return NextResponse.json(newAgent, { status: 201 });
  } catch (error) {
    console.error("Error creating agent:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json({ error: "An agent with this email already exists." }, { status: 409 });
      }
    }
    return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const agents = await prisma.agent.findMany({
      include: {
        subordinates: true,
      },
    });
    return NextResponse.json(agents);
  } catch (error) {
    console.error("Error fetching agents:", error);
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }
}