import { NextResponse } from "next/server";
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const now = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(now.getMonth() - 1);

    const totalAgents = await prisma.agent.count();
    const activeAgents = totalAgents;
    const inactiveAgents = 0;
    
    const agentsLastMonth = await prisma.agent.count({
      where: {
        createdAt: {
          lt: lastMonth
        }
      }
    });
    
    const agentGrowth = agentsLastMonth > 0 
      ? ((totalAgents - agentsLastMonth) / agentsLastMonth) * 100 
      : totalAgents > 0 ? 100 : 0;

    const totalClients = await prisma.client.count();
    const individualClients = await prisma.client.count({
      where: {
        clientType: {
          in: ["Individual", "individual"]
        }
      }
    });
    const organizationClients = await prisma.client.count({
      where: {
        clientType: {
          in: ["Organization", "organization"]
        }
      }
    });

    const clientsLastMonth = await prisma.client.count({
      where: {
        createdAt: {
          lt: lastMonth
        }
      }
    });

    const clientGrowth = clientsLastMonth > 0 
      ? ((totalClients - clientsLastMonth) / clientsLastMonth) * 100 
      : totalClients > 0 ? 100 : 0;

    const totalTasks = await prisma.task.count();
    const pendingTasks = await prisma.task.count({
      where: {
        status: {
          in: ["To Do", "Pending"]
        }
      }
    });
    const inProgressTasks = await prisma.task.count({
      where: {
        status: "In Progress"
      }
    });
    const completedTasks = await prisma.task.count({
      where: {
        status: {
          in: ["Completed", "Done"]
        }
      }
    });

    const overdueTasks = await prisma.task.count({
      where: {
        dueDate: {
          lt: now
        },
        status: {
          notIn: ["Completed", "Done"]
        }
      }
    });

    const tasksLastMonth = await prisma.task.count({
      where: {
        createdAt: {
          lt: lastMonth
        }
      }
    });

    const taskGrowth = tasksLastMonth > 0 
      ? ((totalTasks - tasksLastMonth) / tasksLastMonth) * 100 
      : totalTasks > 0 ? 100 : 0;

    const dashboardStats = {
      agents: {
        total: totalAgents,
        active: activeAgents,
        inactive: inactiveAgents,
        growth: Math.round(agentGrowth * 10) / 10
      },
      clients: {
        total: totalClients,
        individual: individualClients,
        organization: organizationClients,
        growth: Math.round(clientGrowth * 10) / 10
      },
      tasks: {
        total: totalTasks,
        pending: pendingTasks,
        inProgress: inProgressTasks,
        completed: completedTasks,
        overdue: overdueTasks,
        growth: Math.round(taskGrowth * 10) / 10
      },
      taskStatusData: [
        { name: "Completed", value: completedTasks, color: "#22c55e" },
        { name: "In Progress", value: inProgressTasks, color: "#3b82f6" },
        { name: "Pending", value: pendingTasks, color: "#f59e0b" },
        { name: "Overdue", value: overdueTasks, color: "#ef4444" },
      ]
    };

    return NextResponse.json(dashboardStats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard statistics" }, { status: 500 });
  }
}
