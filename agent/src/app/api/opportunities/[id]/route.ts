import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET: Get a single opportunity by ID
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
    });
    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }
    return NextResponse.json({ opportunity });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch opportunity" }, { status: 500 });
  }
}

// PUT: Update an opportunity by ID
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();
    const { name, phoneNumber, description, amount, nextFollowUp, status } = body;
    const opportunity = await prisma.opportunity.update({
      where: { id },
      data: {
        name,
        phoneNumber,
        description,
        amount,
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : undefined,
        status,
      },
    });
    return NextResponse.json({ opportunity });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update opportunity" }, { status: 500 });
  }
}

// DELETE: Delete an opportunity by ID
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    await prisma.opportunity.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete opportunity" }, { status: 500 });
  }
}
