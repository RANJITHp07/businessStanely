import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import {
  recordDeletionAudit,
  actorFromAdmin,
  softDeleteData,
} from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentAdmin = await getCurrentAdmin(req);

    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const leadSource = await prisma.leadSource.findUnique({
      where: { id: params.id },
    });

    if (!leadSource) {
      return NextResponse.json(
        { error: "Lead source not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(leadSource);
  } catch (error) {
    console.error("Error fetching lead source:", error);
    return NextResponse.json(
      { error: "Error fetching lead source" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentAdmin = await getCurrentAdmin(req);

    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, isActive } = body;

    const leadSource = await prisma.leadSource.update({
      where: { id: params.id },
      data: {
        name,
        description,
      },
    });

    return NextResponse.json(leadSource);
  } catch (error) {
    console.error("Error updating lead source:", error);
    return NextResponse.json(
      { error: "Error updating lead source" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentAdmin = await getCurrentAdmin(req);

    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await prisma.leadSource.findFirst({
      where: { id: params.id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Lead source not found" },
        { status: 404 }
      );
    }

    const actor = actorFromAdmin(currentAdmin);

    await prisma.leadSource.update({
      where: { id: params.id },
      data: softDeleteData(actor),
    });

    await recordDeletionAudit({
      entityType: "LeadSource",
      entityId: params.id,
      entityName: existing.name,
      actor,
      req,
    });

    return NextResponse.json({ message: "Lead source deleted successfully" });
  } catch (error) {
    console.error("Error deleting lead source:", error);
    return NextResponse.json(
      { error: "Error deleting lead source" },
      { status: 500 }
    );
  }
}
