import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { uploadToS3 } from "@/lib/aws";
import { sendAgentInviteEmail } from "@/lib/email";
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      specializations,
      superiors,
      subordinates,
      advisorSubordinates,
      photo,
      password: providedPassword,
      agentRole,
      agentType,
      executionAgentType,
      advisorAgentType,
      autoAssign,
      ...agentData
    } = body;

    // Generate a random password if not provided
    const password = providedPassword || Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(password, 12);

    let photoS3Key = null;

    if (photo && photo.startsWith("data:image/")) {
      try {
        const base64Data = photo.split(",")[1];
        const buffer = Buffer.from(base64Data, "base64");

        const mimeType = photo.split(";")[0].split(":")[1];
        const extension = mimeType.split("/")[1];
        const fileName = `agent_${Date.now()}.${extension}`;

        photoS3Key = await uploadToS3(buffer, fileName, mimeType);
      } catch (error) {
        console.error("Error uploading photo to S3:", error);
      }
    }

    // Always store emails in lowercase for case-insensitive uniqueness
    if (agentData.email) {
      agentData.email = agentData.email.toLowerCase();

      const existingAgent = await prisma.agent.findFirst({
        where: {
          email: { equals: agentData.email, mode: "insensitive" },
        },
      });

      if (existingAgent) {
        if (existingAgent.status !== "inactive") {
          return NextResponse.json(
            { error: "An agent with this email already exists." },
            { status: 409 },
          );
        }

        await prisma.agent.update({
          where: { id: existingAgent.id },
          data: {
            email: buildArchivedAgentEmail(
              existingAgent.email,
              existingAgent.id,
            ),
          },
        });
      }
    }

    // Remove subordinates from agentData if present
    if ("subordinates" in agentData) {
      delete agentData.subordinates;
    }
    // Validate agentRole and agentType
    const finalAgentRole = agentRole || EXECUTION_AGENT_ROLE;
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
    const resolvedExecutionType =
      finalAgentRole === EXECUTION_AGENT_ROLE
        ? agentType || executionAgentType
        : finalAgentRole === ADVISOR_AGENT_ROLE
          ? null
          : executionAgentType;

    const resolvedAdvisorType =
      finalAgentRole === ADVISOR_AGENT_ROLE
        ? agentType || advisorAgentType
        : finalAgentRole === EXECUTION_AGENT_ROLE
          ? null
          : advisorAgentType;

    const isValidExecution =
      !hasExecutionRole(finalAgentRole) ||
      (!!resolvedExecutionType &&
        executionTypes.includes(resolvedExecutionType));
    const isValidAdvisor =
      !hasAdvisorRole(finalAgentRole) ||
      (!!resolvedAdvisorType && advisorTypes.includes(resolvedAdvisorType));

    if (!isValidExecution || !isValidAdvisor) {
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

    const finalAgentType =
      finalAgentRole === ADVISOR_AGENT_ROLE
        ? (resolvedAdvisorType as string)
        : (resolvedExecutionType as string);

    const data: Prisma.AgentCreateInput = {
      ...agentData,
      agentRole: finalAgentRole,
      agentType: finalAgentType,
      executionAgentType: resolvedExecutionType,
      advisorAgentType: resolvedAdvisorType,
      password: hashedPassword,
      photo: photoS3Key,
      status: "active",
      autoAssign,
      ...(specializations?.length && {
        specializations: {
          set: specializations,
        },
      }),
    };

    // Create the agent first
    const newAgent = await prisma.agent.create({
      data,
    });

    // If superiors are provided, create AgentSuperior links (agent is subordinate)
    if (superiors?.length) {
      await prisma.agentSuperior.createMany({
        data: superiors.map((superiorId: string) => ({
          superiorId,
          subordinateId: newAgent.id,
        })),
      });
    }
    const executionTeamSubordinates = Array.isArray(subordinates)
      ? subordinates
      : [];
    const advisorTeamSubordinates = Array.isArray(advisorSubordinates)
      ? advisorSubordinates
      : [];

    // If subordinates are provided, create AgentSuperior links (agent is superior)
    if (executionTeamSubordinates.length) {
      await prisma.agentSuperior.createMany({
        data: executionTeamSubordinates.map((subordinateId: string) => ({
          superiorId: newAgent.id,
          subordinateId,
          teamType: hasAdvisorRole(finalAgentRole)
            ? hasExecutionRole(finalAgentRole)
              ? "execution"
              : "advisor"
            : "execution",
        })),
      });
    }

    if (advisorTeamSubordinates.length) {
      await prisma.agentSuperior.createMany({
        data: advisorTeamSubordinates.map((subordinateId: string) => ({
          superiorId: newAgent.id,
          subordinateId,
          teamType: "advisor",
        })),
      });
    }

    // Fetch agent with superiors/subordinates
    const superiorsLinks = await prisma.agentSuperior.findMany({
      where: { subordinateId: newAgent.id },
      include: { superior: true },
    });
    const subordinatesLinks = await prisma.agentSuperior.findMany({
      where: { superiorId: newAgent.id },
      include: { subordinate: true },
    });
    const executionSubordinates = subordinatesLinks
      .filter((link) => link.teamType !== "advisor")
      .map((link) => link.subordinate);
    const advisorSubordinatesList = subordinatesLinks
      .filter((link) => link.teamType === "advisor")
      .map((link) => link.subordinate);

    const agentWithLinks = {
      ...newAgent,
      superiors: superiorsLinks.map((link) => link.superior),
      subordinates: executionSubordinates,
      advisorSubordinates: advisorSubordinatesList,
    };

    // Send email with credentials to the agent
    try {
      await sendAgentInviteEmail({
        to: agentData.email,
        userName: agentData.name,
        password: password, // Send the plain text password
      });
    } catch (emailError) {
      console.error("Failed to send agent invite email:", emailError);
      // Note: We don't fail the agent creation if email sending fails
    }

    // Return agent data (password is not included in the response by default)
    return NextResponse.json(agentWithLinks, { status: 201 });
  } catch (error) {
    console.error("Error creating agent:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "An agent with this email already exists." },
          { status: 409 },
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const statusParam = req.nextUrl.searchParams.get("status");

    const whereClause = statusParam
      ? { status: "inactive" } // if status is given, use it
      : { status: { not: "inactive" } }; // otherwise, active agents
    const agents = await prisma.agent.findMany({
      where: whereClause,
      include: {
        superiorsLinks: { include: { superior: true } },
        subordinatesLinks: { include: { subordinate: true } },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    const mappedAgents = agents.map((agent) => ({
      ...agent,
      superiors: agent.superiorsLinks.map((link) => link.superior),
      subordinates: agent.subordinatesLinks
        .filter((link) => link.teamType !== "advisor")
        .map((link) => link.subordinate),
      advisorSubordinates: agent.subordinatesLinks
        .filter((link) => link.teamType === "advisor")
        .map((link) => link.subordinate),
    }));

    return NextResponse.json(mappedAgents);
  } catch (error) {
    console.error("Error fetching agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 },
    );
  }
}
