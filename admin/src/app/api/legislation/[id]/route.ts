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

    return new Response(JSON.stringify(legislation), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching legislation:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function POST(req: Request, context: { params: { id: string } }) {
  const { params } = context;
  const { id } = params;

  try {
    // Parse the request body as JSON
    const body = await req.json();
    const { title, description, assignedAgentId } = body;

    // Update legislation
    const updatedLegislation = await prisma.legislation.update({
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

    return new Response(JSON.stringify(updatedLegislation), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    // Prisma throws error if the record does not exist
    if (error.code === "P2025") {
      return new Response("Legislation not found", { status: 404 });
    }

    return new Response("Internal Server Error", { status: 500 });
  }
}
