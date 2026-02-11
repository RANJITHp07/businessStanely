import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET – fetch current setting
export async function GET() {
  const setting = await prisma.prospectAssignmentSetting.findFirst();
  return NextResponse.json(setting);
}

export async function POST(req: Request) {
  try {
    const {
      prospectsPerAgent,
      selectedAgentIds = [],
      userId,
    } = await req.json();

    if (!prospectsPerAgent || prospectsPerAgent < 1) {
      return NextResponse.json(
        { message: "Invalid prospectsPerAgent value" },
        { status: 400 },
      );
    }

    // First, reset autoAssign to false for all agents
    if (Array.isArray(selectedAgentIds) && selectedAgentIds.length > 0) {
      await prisma.agent.updateMany({
        data: {
          autoAssign: false,
        },
      });

      // Then set autoAssign to true for selected agents
      await prisma.agent.updateMany({
        where: {
          id: {
            in: selectedAgentIds,
          },
        },
        data: {
          autoAssign: true,
        },
      });
    }

    const existing = await prisma.prospectAssignmentSetting.findFirst();

    const setting = existing
      ? await prisma.prospectAssignmentSetting.update({
          where: { id: existing.id },
          data: {
            prospectsPerAgent,
          },
        })
      : await prisma.prospectAssignmentSetting.create({
          data: {
            prospectsPerAgent,
          },
        });

    return NextResponse.json(setting);
  } catch (error) {
    console.error("Error in prospectAssignmentSetting:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 },
    );
  }
}
