import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);

    if (!agent) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        agentType: agent.agentType,
        agentRole: agent.agentRole,
        phoneNumber: agent.phoneNumber,
        jurisdiction: agent.jurisdiction,
        specializations: agent.specializations,
        photo: agent.photo,
        status: agent.status,
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);

    if (!agent) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      name,
      phoneNumber,
      secondaryPhoneNumber,
      jurisdiction,
      specializations,
      photo,
    } = body;

    // Validate required fields
    if (!name || !phoneNumber) {
      return NextResponse.json(
        { error: "Name and phone number are required" },
        { status: 400 }
      );
    }

    // Update agent profile
    const updatedAgent = await prisma.agent.update({
      where: { id: agent.id },
      data: {
        name,
        phoneNumber,
        secondaryPhoneNumber: secondaryPhoneNumber || null,
        jurisdiction,
        specializations: Array.isArray(specializations) ? specializations : [],
        photo: photo || null,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        agentType: true,
        phoneNumber: true,
        secondaryPhoneNumber: true,
        jurisdiction: true,
        specializations: true,
        photo: true,
        status: true,
      },
    });

    return NextResponse.json({
      message: "Profile updated successfully",
      agent: updatedAgent,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
