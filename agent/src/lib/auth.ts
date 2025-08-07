import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "./prisma";

export interface AgentPayload {
  agentId: string;
  name: string;
  email: string;
  agentType: string;
}

export async function getCurrentAgent(req: NextRequest) {
  try {
    // Get token from cookie
    const token = req.cookies.get("agent-auth-token")?.value;
    
    if (!token) {
      return null;
    }

    // Verify token
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AgentPayload;
    
    // Get agent from database
    const agent = await prisma.agent.findUnique({
      where: { id: payload.agentId },
      select: {
        id: true,
        name: true,
        email: true,
        agentType: true,
        status: true,
        phoneNumber: true,
        jurisdiction: true,
        specializations: true,
        photo: true,
      },
    });

    if (!agent || agent.status !== "active") {
      return null;
    }

    return agent;
  } catch (error) {
    console.error("Error getting current agent:", error);
    return null;
  }
}
