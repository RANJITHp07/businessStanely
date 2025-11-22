import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET - Fetch service records for an agent
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Ensure requester is an authenticated admin
    const currentAdmin = await getCurrentAdmin(request);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const agentId = id;
    
    // Verify agent exists
    const agent = await prisma.agent.findUnique({
      where: {
        id: agentId
      }
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    const serviceRecords = await prisma.serviceRecord.findMany({
      where: {
        agentId: agentId
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Map the response to match the expected format
    const formattedRecords = serviceRecords.map(record => ({
      ...record,
      createdBy: {
        id: record.createdByUser.id,
        username: record.createdByUser.username,
        email: record.createdByUser.email,
        adminType: "admin" // Default since this is from admin panel
      }
    }));

    return NextResponse.json({ serviceRecords: formattedRecords });

  } catch (error) {
    console.error("Error fetching service records:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new service record
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Ensure requester is an authenticated admin
    const currentAdmin = await getCurrentAdmin(request);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin or owner
    if (currentAdmin.adminType !== "admin" && currentAdmin.adminType !== "owner") {
      return NextResponse.json(
        { error: "Forbidden - Only admins and owners can add service records" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const agentId = id;

    const { note } = await request.json();

    if (!note || typeof note !== 'string' || note.trim().length === 0) {
      return NextResponse.json(
        { error: "Note is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // Verify agent exists
    const agent = await prisma.agent.findUnique({
      where: {
        id: agentId
      }
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    const serviceRecord = await prisma.serviceRecord.create({
      data: {
        agentId: agentId,
        note: note.trim(),
        createdBy: currentAdmin.id,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    // Map the response to match the expected format
    const formattedRecord = {
      ...serviceRecord,
      createdBy: {
        id: serviceRecord.createdByUser.id,
        username: serviceRecord.createdByUser.username,
        email: serviceRecord.createdByUser.email,
        adminType: currentAdmin.adminType
      }
    };

    return NextResponse.json({ serviceRecord: formattedRecord }, { status: 201 });

  } catch (error) {
    console.error("Error creating service record:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}