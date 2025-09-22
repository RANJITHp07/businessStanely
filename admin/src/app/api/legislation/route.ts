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
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}