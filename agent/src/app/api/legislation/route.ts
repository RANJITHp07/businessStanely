import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";

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

    const legislationsWithLastCompletedDate = legislations
      .map((legislation) => {
        const completedDates = (legislation.tasks || [])
          .map((task) => task.lastCompletedDate)
          .filter((date): date is Date => Boolean(date));

        const lastCompletedDate =
          completedDates.length > 0
            ? new Date(
                Math.max(...completedDates.map((date) => date.getTime())),
              )
            : null;

        return {
          ...legislation,
          lastCompletedDate,
        };
      })
      .sort((a, b) => {
        const aTime = a.lastCompletedDate
          ? new Date(a.lastCompletedDate).getTime()
          : 0;
        const bTime = b.lastCompletedDate
          ? new Date(b.lastCompletedDate).getTime()
          : 0;
        return bTime - aTime;
      });

    return NextResponse.json(legislationsWithLastCompletedDate);
  } catch (error) {
    console.error("Error fetching legislations:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
