import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { uploadToS3 } from "@/lib/aws";
import { sendAgentInviteEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
  const { specializations, superiors, subordinates, photo, password: providedPassword, agentRole, agentType, ...agentData } = body;

    // Generate a random password if not provided
    const password = providedPassword || Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(password, 12);

    let photoS3Key = null;

    if (photo && photo.startsWith("data:image/")) {
      try {
        const base64Data = photo.split(",")[1];
        const buffer = Buffer.from(base64Data, "base64");

        const mimeType = photo.split(";")[0].split(":")[1];
        const extension = mimeType.split("/")[1];
        const fileName = `agent_${Date.now()}.${extension}`;

        photoS3Key = await uploadToS3(buffer, fileName, mimeType);
      } catch (error) {
        console.error("Error uploading photo to S3:", error);
      }
    }


    // Always store emails in lowercase for case-insensitive uniqueness
    if (agentData.email) {
      agentData.email = agentData.email.toLowerCase();
    }

    // Remove subordinates from agentData if present
    if ('subordinates' in agentData) {
      delete agentData.subordinates;
    }
    // Validate agentRole and agentType
    const finalAgentType = agentType;
    if (agentRole === "Advisor Agent") {
      // Only allow advisor agent types
      const advisorTypes = ["Lead Maker", "Client Advisor", "Client Manager"];
      if (!advisorTypes.includes(agentType)) {
        return NextResponse.json({ error: "Invalid agent type for Advisor Agent." }, { status: 400 });
      }
    }
    // For Execution Agent, keep previous logic (no restriction)

    const data: Prisma.AgentCreateInput = {
      ...agentData,
      agentRole: agentRole || "Execution Agent",
      agentType: finalAgentType,
      password: hashedPassword,
      photo: photoS3Key,
      status: "active",
      ...(specializations?.length && {
        specializations: {
          set: specializations,
        },
      }),
    };

    // Create the agent first
    const newAgent = await prisma.agent.create({
      data,
    });

    // If superiors are provided, create AgentSuperior links (agent is subordinate)
    if (superiors?.length) {
      await prisma.agentSuperior.createMany({
        data: superiors.map((superiorId: string) => ({
          superiorId,
          subordinateId: newAgent.id,
        })),
      });
    }
    // If subordinates are provided, create AgentSuperior links (agent is superior)
    if (subordinates?.length) {
      await prisma.agentSuperior.createMany({
        data: subordinates.map((subordinateId: string) => ({
          superiorId: newAgent.id,
          subordinateId,
        })),
      });
    }

    // Fetch agent with superiors/subordinates
    const superiorsLinks = await prisma.agentSuperior.findMany({
      where: { subordinateId: newAgent.id },
      include: { superior: true },
    });
    const subordinatesLinks = await prisma.agentSuperior.findMany({
      where: { superiorId: newAgent.id },
      include: { subordinate: true },
    });
    const agentWithLinks = {
      ...newAgent,
      superiors: superiorsLinks.map(link => link.superior),
      subordinates: subordinatesLinks.map(link => link.subordinate),
    };

    // Send email with credentials to the agent
    try {
      await sendAgentInviteEmail({
        to: agentData.email,
        userName: agentData.name,
        password: password, // Send the plain text password
      });
    } catch (emailError) {
      console.error("Failed to send agent invite email:", emailError);
      // Note: We don't fail the agent creation if email sending fails
    }

    // Return agent data (password is not included in the response by default)
  return NextResponse.json(agentWithLinks, { status: 201 });
  } catch (error) {
    console.error("Error creating agent:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "An agent with this email already exists." },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const agents = await prisma.agent.findMany({
      include: {
        superiorsLinks: { include: { superior: true } },
        subordinatesLinks: { include: { subordinate: true } },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return NextResponse.json(agents);
  } catch (error) {
    console.error("Error fetching agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 }
    );
  }
}