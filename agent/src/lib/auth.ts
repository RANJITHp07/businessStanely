import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "./prisma";


export interface AgentJWTPayload {
  agentId: string;
  name: string;
  email: string;
  agentType: string;
  agentRole: 'Execution Agent' | 'Advisor Agent';
  sessionToken?: string;
}

export async function getCurrentAgent(req: NextRequest) {
  try {
    // Try to get token from Authorization header first
    let token = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "");
    } else {
      // Fallback to cookie
      token = req.cookies.get("agent-auth-token")?.value;
    }
    if (!token) {
      return null;
    }

    // Verify token
    let payload: AgentJWTPayload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET!) as AgentJWTPayload;
    } catch (err) {
      return null;
    }

    // Get agent from database (include currentSessionToken)
    const agent = await prisma.agent.findUnique({
      where: { id: payload.agentId },
      select: {
        id: true,
        name: true,
        email: true,
        agentType: true,
        agentRole: true,
        status: true,
        phoneNumber: true,
        jurisdiction: true,
        specializations: true,
        photo: true,
        currentSessionToken: true,
      },
    });

    // Single-session enforcement: check sessionToken in DB
    if (!agent || agent.status !== "active" || !payload.sessionToken || agent.currentSessionToken !== payload.sessionToken) {
      return null;
    }

  // Remove currentSessionToken from returned object (ignore unused var warning)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { currentSessionToken, ...agentData } = agent;
  return agentData;
  } catch (error) {
    console.error("Error getting current agent:", error);
    return null;
  }
}
