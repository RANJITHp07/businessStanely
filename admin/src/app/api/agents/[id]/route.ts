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
    const { email, specializations, subordinates, photo, ...agentData } = body;

    const existingAgent = await prisma.agent.findUnique({
      where: { email },
    });

    if (existingAgent && existingAgent.id !== params.id) {
      return NextResponse.json(
        { error: "Another user with the same email already exists." },
        { status: 400 }
      );
    }

    const currentAgent = await prisma.agent.findUnique({
      where: { id: params.id },
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

    const updatedAgent = await prisma.agent.update({
      where: { id: params.id },
      data: {
        ...agentData,
        email,
        photo: photoS3Key,
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