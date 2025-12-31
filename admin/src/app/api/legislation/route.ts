import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const legislations = await prisma.legislation.findMany({
      include: {
        assignedAgent: true,
        retainership: {
          include: {
            client: true,
          },
        },
      },
    });

    return NextResponse.json(legislations);
  } catch (error) {
    console.error("Error fetching legislations:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { title, description, retainershipId, assignedAgentId } = body;

    if (!title || !retainershipId) {
      return new Response("title and retainershipId are required", {
        status: 400,
      });
    }

    const legislation = await prisma.legislation.create({
      data: {
        title,
        description,
        retainership: {
          connect: { id: retainershipId },
        },
        assignedAgent: assignedAgentId
          ? { connect: { id: assignedAgentId } }
          : undefined,
      },
    });

    return new Response(JSON.stringify(legislation), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error creating legislation:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
