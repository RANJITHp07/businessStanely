import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    
    console.log('[DEBUG] Admin timesheet API - agentId:', agentId);
    
    if (!agentId) {
      return NextResponse.json({ error: "Agent ID required" }, { status: 400 });
    }

    const tasks = await prisma.task.findMany({
      where: {
        assignedToId: agentId,
        AND: [
          {
            OR: [{ category: null }, { category: { status: "approved" } }],
          },
        ],
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            organizationName: true,
            clientType: true,
            email: true,
          },
        },
        assignedTo: true,
        comments: {
          include: {
            user: true,
            agent: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log('[DEBUG] Admin timesheet API - found', tasks.length, 'tasks for agent', agentId);
    console.log('[DEBUG] Admin timesheet API - tasks with comments:', tasks.filter(t => t.comments?.length > 0).length);

    // Only return fields needed for timesheet
    const formattedTasks = tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      client: task.client
        ? {
            id: task.client.id,
            name:
              task.client.clientType === "individual"
                ? `${task.client.firstName} ${task.client.lastName}`.trim()
                : task.client.organizationName,
          }
        : null,
      assignedTo: task.assignedTo,
      comments: task.comments,
    }));

    console.log('[DEBUG] Admin timesheet API - returning', formattedTasks.length, 'formatted tasks');
    return NextResponse.json({ tasks: formattedTasks });
  } catch (error) {
    console.error("Error fetching timesheet tasks:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}