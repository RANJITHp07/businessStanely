import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { uploadToS3, deleteFromS3 } from "@/lib/aws";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
  const { id } = await params;
    const agent = await prisma.agent.findUnique({
      where: { id },
    });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    // Fetch superiors
    const superiorsLinks = await prisma.agentSuperior.findMany({
      where: { subordinateId: id },
      include: { superior: true },
    });
    // Fetch subordinates
    const subordinatesLinks = await prisma.agentSuperior.findMany({
      where: { superiorId: id },
      include: { subordinate: true },
    });
    return NextResponse.json({
      ...agent,
      superiors: superiorsLinks.map(link => link.superior),
      subordinates: subordinatesLinks.map(link => link.subordinate),
    });
  } catch (error) {
    console.error(`Error fetching agent ${params.id}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch agent" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
  const body = await req.json();
  const { email, specializations, superiors, subordinates, photo, ...agentData } = body;


    // Always store and check emails in lowercase for case-insensitive uniqueness
  const emailToCheck = email ? email.toLowerCase() : undefined;
    const existingAgent = emailToCheck
      ? await prisma.agent.findFirst({
          where: { email: { equals: emailToCheck, mode: "insensitive" } },
        })
      : undefined;

  const { id } = await params;
  if (existingAgent && existingAgent.id !== id) {
      return NextResponse.json(
        { error: "Another user with the same email already exists." },
        { status: 400 }
      );
    }

    const currentAgent = await prisma.agent.findUnique({
      where: { id },
    });

    let photoS3Key = currentAgent?.photo;

    if (photo && photo.startsWith("data:image/")) {
      try {
        if (currentAgent?.photo) {
          try {
            await deleteFromS3(currentAgent.photo);
          } catch (error) {
            console.error("Error deleting old photo from S3:", error);
          }
        }

        const base64Data = photo.split(",")[1];
        const buffer = Buffer.from(base64Data, "base64");

        const mimeType = photo.split(";")[0].split(":")[1];
        const extension = mimeType.split("/")[1];
        const fileName = `agent_${params.id}_${Date.now()}.${extension}`;

        photoS3Key = await uploadToS3(buffer, fileName, mimeType);
      } catch (error) {
        console.error("Error uploading photo to S3:", error);
      }
    }


    // Remove subordinates if present in agentData (not a valid field)
    if ('subordinates' in agentData) {
      delete agentData.subordinates;
    }
    const updatedAgent = await prisma.agent.update({
      where: { id },
      data: {
        ...agentData,
        email: emailToCheck,
        photo: photoS3Key,
        specializations,
      },
    });

    // Only update subordinates (team members) for this agent
    if (typeof subordinates !== 'undefined') {
      // Remove all existing AgentSuperior links where this agent is the superior
      await prisma.agentSuperior.deleteMany({ where: { superiorId: id } });
      // Add new AgentSuperior links for subordinates
      if (subordinates.length) {
        await prisma.agentSuperior.createMany({
          data: subordinates.map((subordinateId: string) => ({
            superiorId: id,
            subordinateId,
          })),
        });
      }
    }
    // Only update superiors for this agent
    if (typeof superiors !== 'undefined') {
      // Remove all existing AgentSuperior links where this agent is the subordinate
      await prisma.agentSuperior.deleteMany({ where: { subordinateId: id } });
      // Add new AgentSuperior links for superiors
      if (superiors.length) {
        await prisma.agentSuperior.createMany({
          data: superiors.map((superiorId: string) => ({
            superiorId,
            subordinateId: id,
          })),
        });
      }
    }

    // Fetch updated superiors/subordinates
    const superiorsLinks = await prisma.agentSuperior.findMany({
      where: { subordinateId: id },
      include: { superior: true },
    });
    const subordinatesLinks = await prisma.agentSuperior.findMany({
      where: { superiorId: id },
      include: { subordinate: true },
    });

    const updatedSubordinates = subordinatesLinks.map(link => link.subordinate);
    console.log('Updated agent subordinates (team members):', updatedSubordinates);
    return NextResponse.json({
      ...updatedAgent,
      superiors: superiorsLinks.map(link => link.superior),
      subordinates: updatedSubordinates,
    });
  } catch (error) {
    console.error(`Error updating agent ${params.id}:`, error);
    return NextResponse.json(
      { error: "Failed to update agent" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: params.id },
    });

    if (agent?.photo) {
      try {
        await deleteFromS3(agent.photo);
      } catch (error) {
        console.error("Error deleting photo from S3:", error);
      }
    }

    await prisma.agent.delete({
      where: { id: params.id },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(`Error deleting agent ${params.id}:`, error);
    return NextResponse.json(
      { error: "Failed to delete agent" },
      { status: 500 }
    );
  }
}