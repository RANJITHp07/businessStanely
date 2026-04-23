import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { uploadToS3, deleteFromS3 } from "@/lib/aws";
import {
  ADVISOR_AGENT_ROLE,
  EXECUTION_AGENT_ROLE,
  hasAdvisorRole,
  hasExecutionRole,
} from "@/lib/agentRole";

const buildArchivedAgentEmail = (email: string, agentId: string) => {
  const normalized = email.toLowerCase();
  const [localPart, domainPart] = normalized.split("@");
  const suffix = `inactive-${agentId.slice(-6)}-${Date.now()}`;

  if (localPart && domainPart) {
    return `${localPart}+${suffix}@${domainPart}`;
  }

  return `${normalized}.${suffix}`;
};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = await params;
    const agent = await prisma.agent.findUnique({
      where: { id },
    });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    // Fetch superiors (only active)
    const superiorsLinks = await prisma.agentSuperior.findMany({
      where: { subordinateId: id, superior: { status: "active" } },
      include: { superior: true },
    });
    // Fetch subordinates (only active)
    const subordinatesLinks = await prisma.agentSuperior.findMany({
      where: { superiorId: id, subordinate: { status: "active" } },
      include: { subordinate: true },
    });

    const executionSubordinates = subordinatesLinks
      .filter((link) => link.teamType !== "advisor")
      .map((link) => link.subordinate);
    const advisorSubordinates = subordinatesLinks
      .filter((link) => link.teamType === "advisor")
      .map((link) => link.subordinate);

    return NextResponse.json({
      ...agent,
      superiors: superiorsLinks.map((link) => link.superior),
      subordinates: executionSubordinates,
      advisorSubordinates,
    });
  } catch (error) {
    console.error(`Error fetching agent ${params.id}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch agent" },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json();
    const {
      email,
      specializations,
      superiors,
      subordinates,
      advisorSubordinates,
      photo,
      ...agentData
    } = body;

    // Always store and check emails in lowercase for case-insensitive uniqueness
    const emailToCheck = email ? email.toLowerCase() : undefined;
    const existingAgent = emailToCheck
      ? await prisma.agent.findFirst({
          where: { email: { equals: emailToCheck, mode: "insensitive" } },
        })
      : undefined;

    const { id } = await params;
    if (existingAgent && existingAgent.id !== id) {
      if (existingAgent.status !== "inactive") {
        return NextResponse.json(
          { error: "Another user with the same email already exists." },
          { status: 400 },
        );
      }

      await prisma.agent.update({
        where: { id: existingAgent.id },
        data: {
          email: buildArchivedAgentEmail(existingAgent.email, existingAgent.id),
        },
      });
    }

    const currentAgent = await prisma.agent.findUnique({
      where: { id },
    });

    const finalAgentRole =
      agentData.agentRole || currentAgent?.agentRole || EXECUTION_AGENT_ROLE;
    const incomingExecutionType = agentData.executionAgentType;
    const incomingAdvisorType = agentData.advisorAgentType;

    const finalExecutionType =
      finalAgentRole === EXECUTION_AGENT_ROLE
        ? agentData.agentType ||
          incomingExecutionType ||
          currentAgent?.executionAgentType ||
          currentAgent?.agentType
        : finalAgentRole === ADVISOR_AGENT_ROLE
          ? null
          : incomingExecutionType || currentAgent?.executionAgentType;

    const finalAdvisorType =
      finalAgentRole === ADVISOR_AGENT_ROLE
        ? agentData.agentType ||
          incomingAdvisorType ||
          currentAgent?.advisorAgentType ||
          currentAgent?.agentType
        : finalAgentRole === EXECUTION_AGENT_ROLE
          ? null
          : incomingAdvisorType || currentAgent?.advisorAgentType;

    const finalAgentType =
      finalAgentRole === ADVISOR_AGENT_ROLE
        ? finalAdvisorType
        : finalExecutionType;
    const advisorTypes = ["Lead Maker", "Client Advisor", "Client Manager"];
    const executionTypes = [
      "Owner",
      "Partner",
      "CEO",
      "Senior Manager",
      "Manager",
      "Senior Executive",
      "Executive",
      "Junior Executive",
      "Trainee",
      "Intern",
    ];
    const isValidExecution =
      !hasExecutionRole(finalAgentRole) ||
      (!!finalExecutionType && executionTypes.includes(finalExecutionType));
    const isValidAdvisor =
      !hasAdvisorRole(finalAgentRole) ||
      (!!finalAdvisorType && advisorTypes.includes(finalAdvisorType));

    if (!finalAgentType || !isValidExecution || !isValidAdvisor) {
      const roleLabel =
        finalAgentRole === ADVISOR_AGENT_ROLE
          ? "Advisor Agent"
          : finalAgentRole === EXECUTION_AGENT_ROLE
            ? "Execution Agent"
            : "Execution & Advisor Agent";
      return NextResponse.json(
        {
          error:
            finalAgentRole === "Execution & Advisor Agent"
              ? "Please select both Execution Agent Type and Advisor Agent Type."
              : `Invalid agent type for ${roleLabel}.`,
        },
        { status: 400 },
      );
    }

    let photoS3Key = currentAgent?.photo;

    if (photo && photo.startsWith("data:image/")) {
      try {
        if (currentAgent?.photo) {
          try {
            await deleteFromS3(currentAgent.photo);
          } catch (error) {
            console.error("Error deleting old photo from S3:", error);
          }
        }

        const base64Data = photo.split(",")[1];
        const buffer = Buffer.from(base64Data, "base64");

        const mimeType = photo.split(";")[0].split(":")[1];
        const extension = mimeType.split("/")[1];
        const fileName = `agent_${params.id}_${Date.now()}.${extension}`;

        photoS3Key = await uploadToS3(buffer, fileName, mimeType);
      } catch (error) {
        console.error("Error uploading photo to S3:", error);
      }
    }

    // Remove subordinates if present in agentData (not a valid field)
    if ("subordinates" in agentData) {
      delete agentData.subordinates;
    }
    const updatedAgent = await prisma.agent.update({
      where: { id },
      data: {
        ...agentData,
        agentType: finalAgentType,
        executionAgentType: finalExecutionType,
        advisorAgentType: finalAdvisorType,
        email: emailToCheck,
        photo: photoS3Key,
        specializations,
      },
    });

    const shouldUpdateExecutionTeam = typeof subordinates !== "undefined";
    const shouldUpdateAdvisorTeam = typeof advisorSubordinates !== "undefined";

    if (shouldUpdateExecutionTeam || shouldUpdateAdvisorTeam) {
      await prisma.agentSuperior.deleteMany({ where: { superiorId: id } });

      const executionTeam = Array.isArray(subordinates) ? subordinates : [];
      const advisorTeam = Array.isArray(advisorSubordinates)
        ? advisorSubordinates
        : [];

      if (executionTeam.length) {
        await prisma.agentSuperior.createMany({
          data: executionTeam.map((subordinateId: string) => ({
            superiorId: id,
            subordinateId,
            teamType: hasAdvisorRole(finalAgentRole)
              ? hasExecutionRole(finalAgentRole)
                ? "execution"
                : "advisor"
              : "execution",
          })),
        });
      }

      if (advisorTeam.length) {
        await prisma.agentSuperior.createMany({
          data: advisorTeam.map((subordinateId: string) => ({
            superiorId: id,
            subordinateId,
            teamType: "advisor",
          })),
        });
      }
    }
    // Only update superiors for this agent
    if (typeof superiors !== "undefined") {
      // Remove all existing AgentSuperior links where this agent is the subordinate
      await prisma.agentSuperior.deleteMany({ where: { subordinateId: id } });
      // Add new AgentSuperior links for superiors
      if (superiors.length) {
        await prisma.agentSuperior.createMany({
          data: superiors.map((superiorId: string) => ({
            superiorId,
            subordinateId: id,
          })),
        });
      }
    }

    // Fetch updated superiors/subordinates (only active)
    const superiorsLinks = await prisma.agentSuperior.findMany({
      where: { subordinateId: id, superior: { status: "active" } },
      include: { superior: true },
    });
    const subordinatesLinks = await prisma.agentSuperior.findMany({
      where: { superiorId: id, subordinate: { status: "active" } },
      include: { subordinate: true },
    });

    const updatedSubordinates = subordinatesLinks
      .filter((link) => link.teamType !== "advisor")
      .map((link) => link.subordinate);
    const updatedAdvisorSubordinates = subordinatesLinks
      .filter((link) => link.teamType === "advisor")
      .map((link) => link.subordinate);

    return NextResponse.json({
      ...updatedAgent,
      superiors: superiorsLinks.map((link) => link.superior),
      subordinates: updatedSubordinates,
      advisorSubordinates: updatedAdvisorSubordinates,
    });
  } catch (error) {
    console.error(`Error updating agent ${params.id}:`, error);
    return NextResponse.json(
      { error: "Failed to update agent" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: params.id },
    });

    if (agent?.photo) {
      try {
        await deleteFromS3(agent.photo);
      } catch (error) {
        console.error("Error deleting photo from S3:", error);
      }
    }

    await prisma.agent.delete({
      where: { id: params.id },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(`Error deleting agent ${params.id}:`, error);
    return NextResponse.json(
      { error: "Failed to delete agent" },
      { status: 500 },
    );
  }
}
