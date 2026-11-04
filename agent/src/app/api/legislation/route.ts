import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";

/** Adds each legislation's latest task completion and sorts newest first. */
function withLastCompletedDate<
  T extends { tasks: { lastCompletedDate: Date | null }[] },
>(legislations: T[]) {
  return legislations
    .map((legislation) => {
      const completedDates = legislation.tasks
        .map((task) => task.lastCompletedDate)
        .filter((date): date is Date => Boolean(date));

      return {
        ...legislation,
        lastCompletedDate:
          completedDates.length > 0
            ? new Date(Math.max(...completedDates.map((date) => date.getTime())))
            : null,
      };
    })
    .sort(
      (a, b) =>
        (b.lastCompletedDate?.getTime() ?? 0) -
        (a.lastCompletedDate?.getTime() ?? 0),
    );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const assignedAgent = searchParams.get("assignedAgent");

    const agent = await getCurrentAgent(req);

    let whereClause: any = {};

    if (assignedAgent === "me") {
      if (!agent?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      whereClause.assignedAgentId = agent.id;
    }

    // Only what the retainership page's legislation table renders and searches;
    // its tasks are just counted.
    if (searchParams.get("view") === "table") {
      const legislations = await prisma.legislation.findMany({
        where: whereClause,
        select: {
          id: true,
          title: true,
          description: true,
          createdAt: true,
          assignedAgent: { select: { id: true, name: true } },
          retainership: {
            select: {
              clientId: true,
              client: {
                select: {
                  clientType: true,
                  firstName: true,
                  lastName: true,
                  organizationName: true,
                  authorizedPersonName: true,
                  gender: true,
                },
              },
            },
          },
          tasks: {
            select: {
              active: true,
              status: true,
              dueDate: true,
              lastCompletedDate: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(
        withLastCompletedDate(legislations).map((legislation) => ({
          ...legislation,
          tasks: legislation.tasks.map(({ lastCompletedDate: _unused, ...task }) => task),
        })),
      );
    }

    const legislations = await prisma.legislation.findMany({
      where: whereClause,
      include: {
        assignedAgent: true,
        retainership: {
          include: {
            client: true,
          },
        },
        tasks: {
          select: {
            id: true,
            active: true,
            completed: true,
            status: true,
            dueDate: true,
            lastCompletedDate: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(withLastCompletedDate(legislations));
  } catch (error) {
    console.error("Error fetching legislations:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
