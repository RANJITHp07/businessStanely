"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import {
  Users,
  UserCheck,
  FileText,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Calendar,
  Building2,
  User,
} from "lucide-react";

// Mock data for dashboard - will be replaced with real data for charts
const mockDashboardStats = {
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

// Chart data

const monthlyTasksData = [
  { month: "Jan", completed: 45, created: 52 },
  { month: "Feb", completed: 52, created: 48 },
  { month: "Mar", completed: 48, created: 61 },
  { month: "Apr", completed: 61, created: 55 },
  { month: "May", completed: 55, created: 67 },
  { month: "Jun", completed: 67, created: 59 },
];

const agentPerformanceData = [
  { name: "John Smith", tasks: 28, completed: 25 },
  { name: "Sarah Johnson", tasks: 24, completed: 22 },
  { name: "Michael Brown", tasks: 19, completed: 16 },
  { name: "Emily Davis", tasks: 15, completed: 14 },
  { name: "Robert Wilson", tasks: 12, completed: 10 },
];

const clientGrowthData = [
  { month: "Jan", individual: 85, organization: 45 },
  { month: "Feb", individual: 88, organization: 47 },
  { month: "Mar", individual: 92, organization: 50 },
  { month: "Apr", individual: 95, organization: 53 },
  { month: "May", individual: 96, organization: 56 },
  { month: "Jun", individual: 98, organization: 58 },
];

const recentActivities = [
  {
    id: 1,
    type: "task_completed",
    description: "Contract Review completed by John Smith",
    time: "2 hours ago",
    icon: CheckCircle,
    color: "text-green-600",
  },
  {
    id: 2,
    type: "client_added",
    description: "New client 'TechCorp Inc.' added to system",
    time: "4 hours ago",
    icon: UserCheck,
    color: "text-blue-600",
  },
  {
    id: 3,
    type: "task_overdue",
    description: "Legal Research task is now overdue",
    time: "6 hours ago",
    icon: AlertTriangle,
    color: "text-red-600",
  },
  {
    id: 4,
    type: "agent_assigned",
    description: "Emily Davis assigned to new case",
    time: "8 hours ago",
    icon: Users,
    color: "text-purple-600",
  },
];

export default function Dashboard() {
  const [dashboardStats, setDashboardStats] = useState(mockDashboardStats);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        const response = await fetch("/api/dashboard");
        if (response.ok) {
          const data = await response.json();
          setDashboardStats(data);
        } else {
          console.error("Failed to fetch dashboard stats");
        }
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  const chartConfig = {
    completed: {
      label: "Completed",
      color: "hsl(var(--chart-1))",
    },
    created: {
      label: "Created",
      color: "hsl(var(--chart-2))",
    },
    individual: {
      label: "Individual",
      color: "hsl(var(--chart-3))",
    },
    organization: {
      label: "Organization",
      color: "hsl(var(--chart-4))",
    },
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of your legal management system performance and key metrics
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Agents Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-16 mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {dashboardStats.agents.total}
                </div>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-2">
                  <Badge
                    variant="outline"
                    className="text-green-600 border-green-200"
                  >
                    {dashboardStats.agents.active} Active
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-gray-600 border-gray-200"
                  >
                    {dashboardStats.agents.inactive} Inactive
                  </Badge>
                </div>
                <div className="flex items-center mt-2">
                  {dashboardStats.agents.growth >= 0 ? (
                    <>
                      <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
                      <span className="text-xs text-green-600">
                        +{dashboardStats.agents.growth}% from last month
                      </span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-3 w-3 text-red-600 mr-1" />
                      <span className="text-xs text-red-600">
                        {dashboardStats.agents.growth}% from last month
                      </span>
                    </>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Clients Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-16 mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {dashboardStats.clients.total}
                </div>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-2">
                  <Badge
                    variant="outline"
                    className="text-blue-600 border-blue-200"
                  >
                    <User className="h-3 w-3 mr-1" />
                    {dashboardStats.clients.individual} Individual
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-purple-600 border-purple-200"
                  >
                    <Building2 className="h-3 w-3 mr-1" />
                    {dashboardStats.clients.organization} Org
                  </Badge>
                </div>
                <div className="flex items-center mt-2">
                  {dashboardStats.clients.growth >= 0 ? (
                    <>
                      <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
                      <span className="text-xs text-green-600">
                        +{dashboardStats.clients.growth}% from last month
                      </span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-3 w-3 text-red-600 mr-1" />
                      <span className="text-xs text-red-600">
                        {dashboardStats.clients.growth}% from last month
                      </span>
                    </>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Tasks Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-16 mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {dashboardStats.tasks.total}
                </div>
                <div className="flex items-center space-x-1 text-xs text-muted-foreground mt-2">
                  <Badge
                    variant="outline"
                    className="text-green-600 border-green-200"
                  >
                    {dashboardStats.tasks.completed} Done
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-blue-600 border-blue-200"
                  >
                    {dashboardStats.tasks.inProgress} Active
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-red-600 border-red-200"
                  >
                    {dashboardStats.tasks.overdue} Overdue
                  </Badge>
                </div>
                <div className="flex items-center mt-2">
                  {dashboardStats.tasks.growth >= 0 ? (
                    <>
                      <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
                      <span className="text-xs text-green-600">
                        +{dashboardStats.tasks.growth}% from last month
                      </span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-3 w-3 text-red-600 mr-1" />
                      <span className="text-xs text-red-600">
                        {dashboardStats.tasks.growth}% from last month
                      </span>
                    </>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Task Status Distribution</CardTitle>
            <CardDescription>
              Current status breakdown of all tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse">
                <div className="h-[300px] bg-gray-200 rounded mb-4"></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                </div>
              </div>
            ) : (
              <>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dashboardStats.taskStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {dashboardStats.taskStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {dashboardStats.taskStatusData.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center space-x-2"
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm">
                        {item.name}: {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Monthly Tasks Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Tasks Trend</CardTitle>
            <CardDescription>
              Tasks created vs completed over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTasksData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke="var(--color-completed)"
                    strokeWidth={3}
                    dot={{
                      fill: "var(--color-completed)",
                      strokeWidth: 2,
                      r: 4,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="created"
                    stroke="var(--color-created)"
                    strokeWidth={3}
                    dot={{ fill: "var(--color-created)", strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Top Agent Performance</CardTitle>
            <CardDescription>Task completion rates by agent</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agentPerformanceData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="completed" fill="#22c55e" name="Completed" />
                  <Bar dataKey="tasks" fill="#e5e7eb" name="Total Tasks" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Client Growth */}
        <Card>
          <CardHeader>
            <CardTitle>Client Growth Trend</CardTitle>
            <CardDescription>
              Individual vs Organization client growth
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={clientGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="individual"
                    stackId="1"
                    stroke="var(--color-individual)"
                    fill="var(--color-individual)"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="organization"
                    stackId="1"
                    stroke="var(--color-organization)"
                    fill="var(--color-organization)"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>
            Latest updates and activities in your system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center space-x-4 p-3 rounded-lg bg-muted/50"
              >
                <div
                  className={`p-2 rounded-full bg-background ${activity.color}`}
                >
                  <activity.icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{activity.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {activity.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="flex items-center justify-center p-6">
            <div className="text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <h3 className="font-semibold">Create Agent</h3>
              <p className="text-sm text-muted-foreground">
                Add new team member
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="flex items-center justify-center p-6">
            <div className="text-center">
              <UserCheck className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <h3 className="font-semibold">Create Client</h3>
              <p className="text-sm text-muted-foreground">Add new client</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="flex items-center justify-center p-6">
            <div className="text-center">
              <FileText className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <h3 className="font-semibold">Create Task</h3>
              <p className="text-sm text-muted-foreground">Assign new task</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
