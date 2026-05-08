"use client";

import { fetchWithAuth } from "@/lib/fetchWithAuth";
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
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  Users,
  UserCheck,
  FileText,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Building2,
  User,
  Clock,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useRouter } from "next/navigation";

interface DashboardTaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  followUpDuration: string | null;
  statusCheckDuration: string | null;
  clientName: string;
  referenceAt: string;
  expectedDuration?: string;
}

interface DashboardStatusResponse {
  notTouchedTasks: DashboardTaskItem[];
  clientNotUpdatedTasks: DashboardTaskItem[];
  followUpStatusNotDoneTasks: DashboardTaskItem[];
  overdueTasks: DashboardTaskItem[];
}
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

// const agentPerformanceData = [
//     { name: "John Smith", tasks: 28, completed: 25 },
//     { name: "Sarah Johnson", tasks: 24, completed: 22 },
//     { name: "Michael Brown", tasks: 19, completed: 16 },
//     { name: "Emily Davis", tasks: 15, completed: 14 },
//     { name: "Robert Wilson", tasks: 12, completed: 10 },
// ];

// const clientGrowthData = [
//     { month: "Jan", individual: 85, organization: 45 },
//     { month: "Feb", individual: 88, organization: 47 },
//     { month: "Mar", individual: 92, organization: 50 },
//     { month: "Apr", individual: 95, organization: 53 },
//     { month: "May", individual: 96, organization: 56 },
//     { month: "Jun", individual: 98, organization: 58 },
// ];

export default function Dashboard() {
  const [dashboardStats, setDashboardStats] = useState(mockDashboardStats);
  const [loading, setLoading] = useState(true);
  const [slaData, setSlaData] = useState<DashboardStatusResponse>({
    notTouchedTasks: [],
    clientNotUpdatedTasks: [],
    followUpStatusNotDoneTasks: [],
    overdueTasks: [],
  });
  const [slaLoading, setSlaLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        const response = await fetchWithAuth("/api/dashboard");
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

    const fetchSlaStatus = async () => {
      try {
        const response = await fetchWithAuth("/api/agents/dashboard-status");
        if (response.ok) {
          const data = (await response.json()) as DashboardStatusResponse;
          setSlaData({
            notTouchedTasks: data.notTouchedTasks || [],
            clientNotUpdatedTasks: data.clientNotUpdatedTasks || [],
            followUpStatusNotDoneTasks: data.followUpStatusNotDoneTasks || [],
            overdueTasks: data.overdueTasks || [],
          });
        }
      } catch (error) {
        console.error("Error fetching SLA status:", error);
      } finally {
        setSlaLoading(false);
      }
    };

    fetchDashboardStats();
    fetchSlaStatus();
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

  const formatSlaDateTime = (value?: string) => {
    if (!value) return "-";
    const date = new Date(value);
    if (isNaN(date.getTime())) return "-";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `${day}/${month}/${year} ${time}`;
  };

  const renderSlaTable = (
    title: string,
    description: string,
    rows: DashboardTaskItem[],
    accentColor: string = "border-l-gray-300",
    referenceLabel: string = "Last Relevant Interaction",
    showFollowUp: boolean = true,
    showClientUpdate: boolean = false,
  ) => (
    <Card className={`border-l-4 h-[560px] ${accentColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <Badge
            variant={rows.length > 0 ? "destructive" : "secondary"}
            className="text-xs px-2 py-0.5"
          >
            {rows.length} {rows.length === 1 ? "task" : "tasks"}
          </Badge>
        </div>
        <CardDescription className="text-xs leading-snug">{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <CheckCircle className="h-8 w-8 mb-2 text-green-400" />
            <p className="text-sm font-medium">All clear</p>
            <p className="text-xs">No tasks require attention</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <div className="h-[420px] overflow-y-auto overflow-x-auto no-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-xs font-semibold w-8">#</TableHead>
                    <TableHead className="text-xs font-semibold">Task</TableHead>
                    <TableHead className="text-xs font-semibold">Client</TableHead>
                    <TableHead className="text-xs font-semibold">{referenceLabel}</TableHead>
                    {showFollowUp && <TableHead className="text-xs font-semibold">Follow-up</TableHead>}
                    {showClientUpdate && <TableHead className="text-xs font-semibold">Client Update</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((item, idx) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => router.push(`/task/${item.id}`)}
                    >
                      <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium text-sm max-w-32 truncate">{item.title}</TableCell>
                      <TableCell className="text-sm max-w-24 truncate">{item.clientName || "N/A"}</TableCell>
                      <TableCell className="text-sm">{formatSlaDateTime(item.referenceAt)}</TableCell>
                      {showFollowUp && (
                        <TableCell className="text-sm">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${item.followUpDuration === "24hr" ? "bg-blue-100 text-blue-700" :
                            item.followUpDuration === "48hr" ? "bg-amber-100 text-amber-700" :
                              item.followUpDuration === "1w" ? "bg-purple-100 text-purple-700" :
                                "bg-gray-100 text-gray-500"
                            }`}>{item.followUpDuration || "None"}</span>
                        </TableCell>
                      )}
                      {showClientUpdate && (
                        <TableCell className="text-sm">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${item.expectedDuration === "24hr" ? "bg-blue-100 text-blue-700" :
                            item.expectedDuration === "48hr" ? "bg-amber-100 text-amber-700" :
                              item.expectedDuration === "1w" ? "bg-purple-100 text-purple-700" :
                                "bg-gray-100 text-gray-500"
                            }`}>{item.expectedDuration || "None"}</span>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agents Card - Slate Blue */}
        <Card className="bg-[#1e293b] text-white border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[20px] font-medium text-white">Total Members</CardTitle>
            <Users className="h-[35px] w-[35px] lg:h-[50px] lg:w-[50px] text-blue-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-blue-700 rounded w-16 mb-3"></div>
                <div className="h-4 bg-blue-700 rounded w-full mb-2"></div>
                <div className="h-4 bg-blue-700 rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="text-[30px] font-bold text-white">
                  {dashboardStats.agents.total}
                </div>
                <div className="flex items-center space-x-2 text-xs mt-2">
                  <Badge className="bg-green-600/20 text-green-300 border-green-400/30">
                    {dashboardStats.agents.active} Active
                  </Badge>
                  <Badge className="bg-gray-600/20 text-gray-300 border-gray-400/30">
                    {dashboardStats.agents.inactive} Inactive
                  </Badge>
                </div>
                <div className="flex items-center mt-2">
                  {dashboardStats.agents.growth >= 0 ? (
                    <>
                      <TrendingUp className="h-3 w-3 text-green-300 mr-1" />
                      <span className="text-xs text-green-300">
                        +{dashboardStats.agents.growth}% from last month
                      </span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-3 w-3 text-red-300 mr-1" />
                      <span className="text-xs text-red-300">
                        {dashboardStats.agents.growth}% from last month
                      </span>
                    </>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Clients Card - Dark Indigo */}
        <Card className="bg-[#1e1b4b] text-white border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[20px] font-medium text-white">Total Clients</CardTitle>
            <UserCheck className="h-[35px] w-[35px] lg:h-[50px] lg:w-[50px] text-indigo-300" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-indigo-700 rounded w-16 mb-3"></div>
                <div className="h-4 bg-indigo-700 rounded w-full mb-2"></div>
                <div className="h-4 bg-indigo-700 rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="text-[30px] font-bold text-white">
                  {dashboardStats.clients.total}
                </div>
                <div className="flex items-center space-x-2 text-xs mt-2">
                  <Badge className="bg-blue-600/20 text-blue-300 border-blue-400/30">
                    <User className="h-3 w-3 mr-1" />
                    {dashboardStats.clients.individual} Individual
                  </Badge>
                  <Badge className="bg-pink-600/20 text-pink-300 border-pink-400/30">
                    <Building2 className="h-3 w-3 mr-1" />
                    {dashboardStats.clients.organization} Org
                  </Badge>
                </div>
                <div className="flex items-center mt-2">
                  {dashboardStats.clients.growth >= 0 ? (
                    <>
                      <TrendingUp className="h-3 w-3 text-green-300 mr-1" />
                      <span className="text-xs text-green-300">
                        +{dashboardStats.clients.growth}% from last month
                      </span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-3 w-3 text-red-300 mr-1" />
                      <span className="text-xs text-red-300">
                        {dashboardStats.clients.growth}% from last month
                      </span>
                    </>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Tasks Card - Deep Dark Teal */}
        <Card className="bg-[#0f3f3c] text-white border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[20px] font-medium text-white">Total Tasks</CardTitle>
            <FileText className="h-[35px] w-[35px] lg:h-[50px] lg:w-[50px] text-teal-300" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-teal-700 rounded w-16 mb-3"></div>
                <div className="h-4 bg-teal-700 rounded w-full mb-2"></div>
                <div className="h-4 bg-teal-700 rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="text-[30px] font-bold text-white">
                  {dashboardStats.tasks.total}
                </div>
                <div className="flex items-center space-x-2 text-xs mt-2">
                  <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-400/30">
                    {dashboardStats.tasks.completed} Completed
                  </Badge>
                  <Badge className="bg-blue-600/20 text-blue-300 border-blue-400/30">
                    {dashboardStats.tasks.inProgress} Active
                  </Badge>
                  <Badge className="bg-red-600/20 text-red-300 border-red-400/30">
                    {dashboardStats.tasks.overdue} Overdue
                  </Badge>
                </div>
                <div className="flex items-center mt-2">
                  {dashboardStats.tasks.growth >= 0 ? (
                    <>
                      <TrendingUp className="h-3 w-3 text-green-300 mr-1" />
                      <span className="text-xs text-green-300">
                        +{dashboardStats.tasks.growth}% from last month
                      </span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-3 w-3 text-red-300 mr-1" />
                      <span className="text-xs text-red-300">
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
                <div className="h-[300px] flex items-center justify-center">
                  <ChartContainer config={chartConfig} className="w-full h-full">
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
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  {dashboardStats.taskStatusData.map((item) => (
                    <div key={item.name} className="flex items-center space-x-2">
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
          <CardContent className="overflow-x-auto">
            <div className="w-full h-[300px]">
              <ChartContainer config={chartConfig} className="w-full h-full">
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
                      dot={{
                        fill: "var(--color-created)",
                        strokeWidth: 2,
                        r: 4,
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Charts Row 2 */}


      {/* SLA Status */}
      {slaLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Clock className="h-8 w-8 animate-spin text-primary/60" />
          <p className="text-sm">Loading SLA data...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Not Touched</p>
                  <p className="text-2xl font-bold mt-0.5">{slaData.notTouchedTasks.length}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Client Not Updated</p>
                  <p className="text-2xl font-bold mt-0.5">{slaData.clientNotUpdatedTasks.length}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Follow-up Issues</p>
                  <p className="text-2xl font-bold mt-0.5">{slaData.followUpStatusNotDoneTasks.length}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                  <CheckCircle className="h-5 w-5 text-purple-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-rose-500">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Overdue</p>
                  <p className="text-2xl font-bold mt-0.5">{slaData.overdueTasks.length}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5 text-rose-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tables row 1 */}
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="flex-1 min-w-0">
              {renderSlaTable(
                "Touchbased Not Yet",
                "All Tasks other than StatusCheck&Followup has to be Touchbased once every day. ",
                slaData.notTouchedTasks,
                "border-l-amber-500",
              )}
            </div>
            <div className="flex-1 min-w-0">
              {renderSlaTable(
                "Tasks where Client not updated",
                "Every Client has to be updated at least once in 48 hours.",
                slaData.clientNotUpdatedTasks,
                "border-l-red-500",
                "Last Relevant Interaction",
                false,
                true,
              )}
            </div>
          </div>

          {/* Tables row 2 */}
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="flex-1 min-w-0">
              {renderSlaTable(
                "Follow-up & Status Not Done (24/48hrs /1-Week)",
                "All Task has to be updated based on the Periodicity of Followup&StatusCheck",
                slaData.followUpStatusNotDoneTasks,
                "border-l-purple-500",
              )}
            </div>
            <div className="flex-1 min-w-0">
              {renderSlaTable(
                "Overdue Tasks",
                "The following Task Due date has crossed and require immediate completion",
                slaData.overdueTasks,
                "border-l-rose-500",
                "Due Date",
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
