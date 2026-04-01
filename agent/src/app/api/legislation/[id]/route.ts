import prisma from "@/lib/prisma";

export async function GET(req: Request, context: { params: { id: string } }) {
  const { params } = context; // Await params before destructuring
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

    const legislationWithLastCompletedDate = {
      ...legislation,
      lastCompletedDate,
    };

    return new Response(JSON.stringify(legislationWithLastCompletedDate), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching legislation:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
