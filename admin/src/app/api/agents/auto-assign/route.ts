import { getCurrentAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const leadMakerId = req.nextUrl.searchParams.get("leadMakerId");
    if (!leadMakerId) {
      return NextResponse.json(
        { error: "leadMakerId is required" },
        { status: 400 },
      );
    }

    const leadMaker = await prisma.agent.findUnique({
      where: { id: leadMakerId },
      select: { clientAdvisorIds: true, name: true, id: true, agentType: true },
    });

    if (!leadMaker || leadMaker.agentType !== "Lead Maker") {
      return NextResponse.json(
        { error: "Lead Maker not found" },
        { status: 404 },
      );
    }

    if (!leadMaker.clientAdvisorIds?.length) {
      return NextResponse.json({ clientAdvisors: [] });
    }

    const clientAdvisors = await prisma.agent.findMany({
      where: {
        id: { in: leadMaker.clientAdvisorIds },
        agentType: "Client Advisor",
        status: "active",
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        specializations: true,
        photo: true,
      },
    });

    return NextResponse.json({ leadMaker, clientAdvisors });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch client advisors" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { leadMakerId, clientAdvisorIds } = body;

    console.log(clientAdvisorIds);
    if (!leadMakerId) {
      return NextResponse.json(
        { error: "leadMakerId is required" },
        { status: 400 },
      );
    }

    const leadMaker = await prisma.agent.findUnique({
      where: { id: leadMakerId },
    });

    if (!leadMaker || leadMaker.agentType !== "Lead Maker") {
      return NextResponse.json(
        { error: "Lead Maker not found" },
        { status: 404 },
      );
    }

    if (!Array.isArray(clientAdvisorIds)) {
      return NextResponse.json(
        { error: "clientAdvisorIds must be an array of agent IDs." },
        { status: 400 },
      );
    }

    // Validate all IDs exist and are active Client Advisors
    const validAdvisors = await prisma.agent.findMany({
      where: {
        id: { in: clientAdvisorIds },
        agentType: "Client Advisor",
        status: "active",
      },
      select: { id: true },
    });

    const validAdvisorIds = validAdvisors.map((a) => a.id);

    // Optional: warn if some IDs were invalid
    const invalidIds = clientAdvisorIds.filter(
      (id) => !validAdvisorIds.includes(id),
    );

    const updatedLeadMaker = await prisma.agent.update({
      where: { id: leadMaker.id },
      data: { clientAdvisorIds: clientAdvisorIds },
      select: { id: true, name: true, clientAdvisorIds: true },
    });

    return NextResponse.json({
      leadMaker: updatedLeadMaker,
      invalidIds: invalidIds.length ? invalidIds : undefined,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update client advisors." },
      { status: 500 },
    );
  }
}
