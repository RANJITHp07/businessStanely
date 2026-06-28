import prisma from "@/lib/prisma";

export async function GET(req: Request, context: { params: { id: string } }) {
  const params = await context.params; // Await params before destructuring
  const { id } = params;

  try {
    const legislation = await prisma.legislation.findUnique({
      where: { id },
      include: {
        assignedAgent: true,
        retainership: {
          include: {
            client: true,
          },
        },
        tasks: true,
      },
    });

    if (!legislation) {
      return new Response("Legislation not found", { status: 404 });
    }

    const completedDates = (legislation.tasks || [])
      .map((task) => task.lastCompletedDate)
      .filter((date): date is Date => Boolean(date));

    const lastCompletedDate =
      completedDates.length > 0
        ? new Date(Math.max(...completedDates.map((date) => date.getTime())))
        : null;

    const result = { ...legislation, lastCompletedDate };

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching legislation:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function POST(req: Request, context: { params: { id: string } }) {
  const { id } = context.params;

  try {
    const body = await req.json();
    const { title, description, assignedAgentId } = body;

    const existingLegislation = await prisma.legislation.findUnique({
      where: { id },
      select: {
        assignedAgentId: true,
      },
    });

    if (!existingLegislation) {
      return new Response("Legislation not found", { status: 404 });
    }

    const updatedLegislation = await prisma.$transaction(async (tx) => {
      if (
        assignedAgentId &&
        existingLegislation.assignedAgentId !== assignedAgentId
      ) {
        await tx.task.updateMany({
          where: {
            legislationId: id,
          },
          data: {
            assignedToId: assignedAgentId,
          },
        });
      }

      return tx.legislation.update({
        where: { id },
        data: {
          title,
          description,
          assignedAgentId,
        },
        include: {
          assignedAgent: true,
          retainership: {
            include: {
              client: true,
            },
          },
          tasks: true,
        },
      });
    });

    return new Response(JSON.stringify(updatedLegislation), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error.code === "P2025") {
      return new Response("Legislation not found", { status: 404 });
    }

    console.error("Error updating legislation:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  context: { params: { id: string } }
) {
  const { params } = context;
  const { id } = params;

  try {
    const deletedLegislation = await prisma.legislation.delete({
      where: { id },
      include: {
        assignedAgent: true,
        retainership: {
          include: {
            client: true,
          },
        },
        tasks: true,
      },
    });

    return new Response(JSON.stringify(deletedLegislation), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    // Record not found
    if (error.code === "P2025") {
      return new Response("Legislation not found", { status: 404 });
    }

    console.error("Error deleting legislation:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
