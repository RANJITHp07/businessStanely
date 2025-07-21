import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { uploadToS3 } from "@/lib/aws";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { specializations, subordinates, photo, ...agentData } = body;

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

    const data: Prisma.AgentCreateInput = {
      ...agentData,
      photo: photoS3Key,
      ...(specializations?.length && {
        specializations: {
          set: specializations,
        },
      }),
      ...(subordinates?.length && {
        subordinates: {
          connect: subordinates.map((id: string) => ({ id })),
        },
      }),
    };

    const newAgent = await prisma.agent.create({
      data,
      include: {
        superior: true,
        subordinates: true,
      },
    });

    return NextResponse.json(newAgent, { status: 201 });
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
        superior: true,
        subordinates: true,
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