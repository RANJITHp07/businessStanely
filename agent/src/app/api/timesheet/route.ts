import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const assignedToIdsParam = searchParams.get("assignedToIds");
    let where: Prisma.TaskWhereInput;
    if (assignedToIdsParam) {
      const assignedToIds = assignedToIdsParam.split(",").map((id) => id.trim()).filter(Boolean);
      where = {
        assignedToId: { in: assignedToIds },
        AND: [
          {
            OR: [{ category: null }, { category: { status: "approved" } }],
          },
        ],
      };
    } else {
      where = {
        assignedToId: agent.id,
        AND: [
          {
            OR: [{ category: null }, { category: { status: "approved" } }],
          },
        ],
      };
    }

    const tasks = await prisma.task.findMany({
      where,
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

    return NextResponse.json({ tasks: formattedTasks });
  } catch (error) {
    console.error("Error fetching timesheet tasks:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
