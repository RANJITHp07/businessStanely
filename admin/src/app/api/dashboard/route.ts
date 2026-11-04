import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const now = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(now.getMonth() - 1);

    const [
      totalAgents,
      agentsLastMonth,
      totalClients,
      individualClients,
      organizationClients,
      clientsLastMonth,
      totalTasks,
      pendingTasks,
      inProgressTasks,
      completedTasks,
      overdueTasks,
      tasksLastMonth,
    ] = await Promise.all([
      prisma.agent.count(),
      prisma.agent.count({
        where: {
          createdAt: {
            lt: lastMonth,
          },
        },
      }),
      prisma.client.count(),
      prisma.client.count({
        where: {
          clientType: {
            in: ["Individual", "individual"],
          },
        },
      }),
      prisma.client.count({
        where: {
          clientType: {
            in: ["Organization", "organization"],
          },
        },
      }),
      prisma.client.count({
        where: {
          createdAt: {
            lt: lastMonth,
          },
        },
      }),
      prisma.task.count(),
      prisma.task.count({
        where: {
          status: {
            in: ["To Do", "Pending"],
          },
        },
      }),
      prisma.task.count({
        where: {
          status: "In Progress",
        },
      }),
      prisma.task.count({
        where: {
          status: "Completed",
        },
      }),
      prisma.task.count({
        where: {
          dueDate: {
            lt: now,
          },
          status: {
            notIn: ["Completed"],
          },
        },
      }),
      prisma.task.count({
        where: {
          createdAt: {
            lt: lastMonth,
          },
        },
      }),
    ]);

    const activeAgents = totalAgents;
    const inactiveAgents = 0;

    const agentGrowth =
      agentsLastMonth > 0
        ? ((totalAgents - agentsLastMonth) / agentsLastMonth) * 100
        : totalAgents > 0
          ? 100
          : 0;

    const clientGrowth =
      clientsLastMonth > 0
        ? ((totalClients - clientsLastMonth) / clientsLastMonth) * 100
        : totalClients > 0
          ? 100
          : 0;

    const taskGrowth =
      tasksLastMonth > 0
        ? ((totalTasks - tasksLastMonth) / tasksLastMonth) * 100
        : totalTasks > 0
          ? 100
          : 0;

    const dashboardStats = {
      agents: {
        total: totalAgents,
        active: activeAgents,
        inactive: inactiveAgents,
        growth: Math.round(agentGrowth * 10) / 10,
      },
      clients: {
        total: totalClients,
        individual: individualClients,
        organization: organizationClients,
        growth: Math.round(clientGrowth * 10) / 10,
      },
      tasks: {
        total: totalTasks,
        pending: pendingTasks,
        inProgress: inProgressTasks,
        completed: completedTasks,
        overdue: overdueTasks,
        growth: Math.round(taskGrowth * 10) / 10,
      },
      taskStatusData: [
        { name: "Completed", value: completedTasks, color: "#22c55e" },
        { name: "In Progress", value: inProgressTasks, color: "#3b82f6" },
        { name: "Pending", value: pendingTasks, color: "#f59e0b" },
        { name: "Overdue", value: overdueTasks, color: "#ef4444" },
      ],
    };

    return NextResponse.json(dashboardStats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard statistics" },
      { status: 500 },
    );
  }
}
