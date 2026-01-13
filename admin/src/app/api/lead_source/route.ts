import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const currentAdmin = await getCurrentAdmin(req);

    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const leadSources = await prisma.leadSource.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(leadSources);
  } catch (error) {
    console.error("Error fetching lead sources:", error);
    return NextResponse.json(
      { error: "Error fetching lead sources" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentAdmin = await getCurrentAdmin(req);

    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const leadSource = await prisma.leadSource.create({
      data: {
        name,
        description,
      },
    });

    return NextResponse.json(leadSource, { status: 201 });
  } catch (error: any) {
    console.error("Error creating lead source:", error);

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Lead source already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Error creating lead source" },
      { status: 500 }
    );
  }
}
