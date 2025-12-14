import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      clientId,
      createdById,
      assignedToId,
      categoryId,
      legislationId,
      recurring,
    } = body;

    if (!title || !createdById) {
      return NextResponse.json(
        { error: "Title and createdById are required" },
        { status: 400 }
      );
    }

    const recurringValue = recurring && recurring !== "0" ? parseInt(recurring) : null;
    
    const newTask = await prisma.task.create({
      data: {
        title,
        description,
        status,
        priority,
        dueDate,
        clientId,
        createdById,
        assignedToId,
        categoryId: categoryId || undefined,
        legislationId: legislationId || null, // Save legislationId
        recurring: recurringValue, // Save recurring field
      },
      include: {
        client: true,
        createdBy: true,
        assignedTo: true,
        category: true,
      },
    });

    // Initialize recurring fields if this is a recurring task
    if (recurringValue && dueDate) {
      try {
        const { initializeRecurringTask } = await import("@/lib/singleTaskRecurring");
        await initializeRecurringTask(newTask.id, recurringValue, new Date(dueDate));
      } catch (error) {
        console.error("Error initializing recurring task:", error);
      }
    }

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Handle known Prisma errors
    }
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Get the current admin user
    const currentAdmin = await getCurrentAdmin(req);
    console.log("currentAdmin:",currentAdmin)
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const assignedToId = searchParams.get("assignedToId");
    const clientId = searchParams.get("clientId");
    const categoryId = searchParams.get("categoryId");
    const status = searchParams.get("status");
    console.log('status:',status);
    
    // Build the where clause: if filtering by categoryId, allow any status; otherwise, only approved
    let whereClause: Prisma.TaskWhereInput;
    if (categoryId) {
      whereClause = { categoryId };
    } else {
      whereClause = { AND: [ { category: { status: "approved" } } ] };
    }
    if (assignedToId) {
      whereClause.assignedToId = assignedToId;
    }
    if (clientId) {
      whereClause.clientId = clientId;
    }
    if (status) {
      whereClause.status = status;
    }
    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        client: true,
        createdBy: true,
        assignedTo: true,
        category: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: "Failed to fetch tasks", details: errorMessage },
      { status: 500 }
    );
  }
}
