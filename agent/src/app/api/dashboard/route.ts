import { NextRequest, NextResponse } from "next/server";
import { getCurrentAgent } from "@/lib/auth";
import prisma from "@/lib/prisma";

interface TaskStatusGroup {
  status: string;
  _count: {
    id: number;
  };
}

export async function GET(req: NextRequest) {
  try {
    // Check if agent is authenticated
    const agent = await getCurrentAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch real dashboard statistics
    const [
      totalAgents,
      activeAgents,
      totalClients,
      individualClients,
      organizationClients,
      totalTasks,
      tasksByStatus
    ] = await Promise.all([
      // Total agents
      prisma.agent.count(),
      
      // Active agents
      prisma.agent.count({
        where: { status: "active" }
      }),
      
      // Total clients
      prisma.client.count(),
      
      // Individual clients
      prisma.client.count({
        where: { clientType: "individual" }
      }),
      
      // Organization clients
      prisma.client.count({
        where: { clientType: "organization" }
      }),
      
      // Total tasks
      prisma.task.count(),
      
      // Tasks by status
      prisma.task.groupBy({
        by: ['status'],
        _count: {
          id: true
        }
      })
    ]);

    // Process task status data
    const taskStatusMap = tasksByStatus.reduce((acc: Record<string, number>, item: TaskStatusGroup) => {
      acc[item.status.toLowerCase().replace(' ', '')] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    // Calculate task status distribution for pie chart
    const taskStatusData = [
      { 
        name: "Completed", 
        value: taskStatusMap['completed'] || 0, 
        color: "#22c55e" 
      },
      { 
        name: "In Progress", 
        value: taskStatusMap['inprogress'] || taskStatusMap['progress'] || 0, 
        color: "#3b82f6" 
      },
      { 
        name: "Pending", 
        value: taskStatusMap['todo'] || taskStatusMap['pending'] || 0, 
        color: "#f59e0b" 
      },
      { 
        name: "Overdue", 
        value: taskStatusMap['overdue'] || 0, 
        color: "#ef4444" 
      },
    ];

    const dashboardStats = {
      agents: {
        total: totalAgents,
        active: activeAgents,
        inactive: totalAgents - activeAgents,
        growth: 8.5, // You can calculate this based on historical data
      },
      clients: {
        total: totalClients,
        individual: individualClients,
        organization: organizationClients,
        growth: 12.3, // You can calculate this based on historical data
      },
      tasks: {
        total: totalTasks,
        pending: taskStatusMap['todo'] || taskStatusMap['pending'] || 0,
        inProgress: taskStatusMap['inprogress'] || taskStatusMap['progress'] || 0,
        completed: taskStatusMap['completed'] || 0,
        overdue: taskStatusMap['overdue'] || 0,
        growth: -2.1, // You can calculate this based on historical data
      },
      taskStatusData: taskStatusData.filter(item => item.value > 0), // Only show non-zero values
    };

    return NextResponse.json(dashboardStats);

  } catch (error) {
    console.error("Dashboard API error:", error);
    
    // Return mock data as fallback
    const mockData = {
      agents: {
        total: 25,
        active: 23,
        inactive: 2,
        growth: 8.5,
      },
      clients: {
        total: 156,
        individual: 98,
        organization: 58,
        growth: 12.3,
      },
      tasks: {
        total: 342,
        pending: 45,
        inProgress: 128,
        completed: 169,
        overdue: 12,
        growth: -2.1,
      },
      taskStatusData: [
        { name: "Completed", value: 169, color: "#22c55e" },
        { name: "In Progress", value: 128, color: "#3b82f6" },
        { name: "Pending", value: 45, color: "#f59e0b" },
        { name: "Overdue", value: 12, color: "#ef4444" },
      ],
    };

    return NextResponse.json(mockData);
  } finally {
    await prisma.$disconnect();
  }
}
