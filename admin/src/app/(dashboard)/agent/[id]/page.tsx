"use client";

import { useState, useEffect, Fragment } from "react";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { SectionTable } from "@/components/SectionTable";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  User,
  Mail,
  Phone,
  Users,
  FileText,
  LayoutDashboard,
  MoreHorizontal,
  Edit,
  Eye,
  Clock,
  TrendingUp,
  CheckCircle,
  Building2,
  PlusCircle,
  AlertTriangle,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Agent, Client, Task } from "@/types";
import Link from "next/link";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { hasAdvisorRole, hasExecutionRole } from "@/lib/agentRole";
import { cn } from "@/lib/utils";
import { ProspectTable } from "@/app/(sales)/dashboard/prospects/tables/page";
import { ProspectsTable } from "@/app/(sales)/dashboard/opportunities/tables/page";


interface AgentActivity {
  taskId: string;
  taskTitle: string;
  content: string;
  createdAt: string;
}

interface ServiceRecord {
  id: string;
  note: string;
  createdAt: string;
  createdBy: {
    id: string;
    username: string;
    adminType: string;
  };
}

interface TransferAuditSummary {
  completedTaskCount?: number;
  taskStatusBreakdown?: Record<string, number>;
  assignedLeadsTransferredCount?: number;
  createdLeadsTransferredCount?: number;
  convertedLeadsCount?: number;
  opportunitiesClosedWonCount?: number;
  opportunitiesClosedLossCount?: number;
}

interface CurrentUser {
  id: string;
  username: string;
  email: string;
  adminType: "owner" | "admin";
}

interface AgentLegislation {
  id: string;
  title: string;
  description?: string;
  assignedAgent?: {
    id: string;
    name: string;
    email: string;
  };
  retainership?: {
    client?: Client | null;
    clientId?: string;
  };
  tasks?: Task[];
}

interface AgentClient extends Client {
  retainershipCount?: number;
  statusCounts?: Record<string, number>;
}

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

function parseTaskResponse(data: Task[] | { tasks?: Task[] }) {
  return Array.isArray(data) ? data : data.tasks || [];
}

function getClientDisplayName(client?: Client | null) {
  if (!client) return "N/A";
  if (client.clientType === "organization") {
    return client.organizationName || client.name || "N/A";
  }
  const fullName = `${client.firstName || ""} ${client.lastName || ""}`.trim();
  return fullName || client.name || "N/A";
}

function getClientInitials(client?: Client | null) {
  if (!client) return "NA";
  if (client.clientType === "organization") {
    return (client.organizationName || client.name || "NA")
      .toUpperCase()
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2);
  }
  return `${client.firstName?.[0] || ""}${client.lastName?.[0] || ""}`.toUpperCase() || "NA";
}

function getClientTypeBadge(type?: string) {
  if (type === "organization") {
    return <Badge className="bg-violet-100 text-violet-800 border-violet-200 border">Organization</Badge>;
  }

  return <Badge className="bg-blue-100 text-blue-800 border-blue-200 border">Individual</Badge>;
}

// Helper to normalize status string
function statusKey(s?: string) {
  const k = (s || "").toLowerCase().replace(/\s+/g, "");
  if (["todo", "pending"].includes(k)) return "todo";
  if (["inprogress", "progress"].includes(k)) return "inprogress";
  if (["completed"].includes(k)) return "completed";
  if (["hold"].includes(k)) return "hold";
  return k || "todo";
}

function normalizeStatus(value?: string) {
  return (value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function groupActivitiesByDate(activities: AgentActivity[]) {
  return activities.reduce((acc, activity) => {
    // Store the ISO date string instead of localized string
    const date = new Date(activity.createdAt).toISOString().split('T')[0]; // "2024-01-15"
    if (!acc[date]) acc[date] = [];
    acc[date].push(activity);
    return acc;
  }, {} as Record<string, AgentActivity[]>);
}
function formatDateDMY(dateString: string) {
  if (!dateString) return "-";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function toISODate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateDDMMYY(value: Date) {
  const day = String(value.getDate()).padStart(2, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const year = String(value.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function mergeTeamMembers(agentData: Agent) {
  const combinedMembers = [
    ...(agentData.subordinates || []),
    ...(agentData.advisorSubordinates || []),
  ];

  return combinedMembers.filter(
    (member, index, members) =>
      member.status?.trim().toLowerCase() !== "inactive" &&
      members.findIndex((candidate) => candidate.id === member.id) === index,
  );
}


export default function AgentDetails() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const [agent, setAgent] = useState<Agent | null>(null);
  const [agentTasks, setAgentTasks] = useState<Task[]>([]);
  const [agentRetainershipTasks, setAgentRetainershipTasks] = useState<Task[]>([]);
  const [agentTriggerTasks, setAgentTriggerTasks] = useState<Task[]>([]);
  const [agentLegislations, setAgentLegislations] = useState<AgentLegislation[]>([]);
  const [agentClients, setAgentClients] = useState<AgentClient[]>([]);
  const [agentLeads, setAgentLeads] = useState<Task[]>([]);
  const [agentOpportunities, setAgentOpportunities] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>(searchParams.get("tab") || "details");
  const [taskOverviewTab, setTaskOverviewTab] = useState("standard-tasks");
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardStatusResponse>({
    notTouchedTasks: [],
    clientNotUpdatedTasks: [],
    followUpStatusNotDoneTasks: [],
    overdueTasks: [],
  });
  const [dashboardDate, setDashboardDate] = useState<Date | undefined>(
    () => new Date(),
  );

  // Keep activeTab in sync with the tab query param
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams, activeTab]);
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);
  const [serviceRecordsLoading, setServiceRecordsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const parseLatestTransferAudit = (
    records: ServiceRecord[],
  ): TransferAuditSummary | null => {
    for (const record of records) {
      if (!record.note?.startsWith("AUTO_TRANSFER_AUDIT ")) continue;

      const jsonPayload = record.note.replace("AUTO_TRANSFER_AUDIT ", "").trim();
      try {
        const parsed = JSON.parse(jsonPayload) as TransferAuditSummary;
        return parsed;
      } catch (error) {
        console.error("Failed to parse transfer audit summary:", error);
      }
    }

    return null;
  };

  useEffect(() => {
    // Load current user from localStorage
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        setCurrentUser(userData);
      } catch (err) {
        console.error("Error parsing user data:", err);
      }
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    const fetchAgent = async () => {
      try {
        const response = await fetch(`/api/agents/${id}`);
        if (response.ok) {
          const data = await response.json();
          setAgent(data);

          const tabParam = searchParams.get("tab");
          const hasExecutionAccess = hasExecutionRole(data?.agentRole);
          const hasAdvisorAccess = hasAdvisorRole(data?.agentRole);

          if (!tabParam) {
            setActiveTab(
              hasExecutionAccess ? "dashboard" : "leads",
            );
          }

          const dataRequests: Promise<void>[] = [];

          if (hasExecutionAccess) {
            const today = new Date();
            dataRequests.push(
              fetchDashboardStatus(today),
              fetchAgentTasks(),
              fetchAgentRetainershipTasks(),
              fetchAgentTriggerTasks(),
              fetchAgentLegislations(),
              fetchAgentClients(),
            );
          }

          if (hasAdvisorAccess) {
            dataRequests.push(fetchAgentLeads(), fetchAgentOpportunity());
          }

          if (dataRequests.length > 0) {
            await Promise.all(dataRequests);
          }

          setTeamMembers(mergeTeamMembers(data));
        } else {
          notFound();
        }
      } catch (error) {
        console.error("Error fetching agent:", error);
        notFound();
      } finally {
        setTasksLoading(false);
        setLoading(false);
      }
    };

    const fetchAgentTasks = async () => {
      try {
        const response = await fetch(`/api/tasks?assignedToId=${id}`);
        if (response.ok) {
          const data = await response.json();
          setAgentTasks(parseTaskResponse(data));
        } else {
          setAgentTasks([]);
        }
      } catch (error) {
        console.error("Error fetching agent tasks:", error);
        setAgentTasks([]);
      }
    };

    const fetchDashboardStatus = async (date?: Date) => {
      try {
        setDashboardLoading(true);
        const params = new URLSearchParams({ assignedToId: id });
        if (date) params.set("date", toISODate(date));
        const response = await fetchWithAuth(`/api/agents/dashboard-status?${params.toString()}`);
        if (response.ok) {
          const data = (await response.json()) as DashboardStatusResponse;
          setDashboardData({
            notTouchedTasks: data.notTouchedTasks || [],
            clientNotUpdatedTasks: data.clientNotUpdatedTasks || [],
            followUpStatusNotDoneTasks: data.followUpStatusNotDoneTasks || [],
            overdueTasks: data.overdueTasks || [],
          });
        } else {
          setDashboardData({
            notTouchedTasks: [],
            clientNotUpdatedTasks: [],
            followUpStatusNotDoneTasks: [],
            overdueTasks: [],
          });
        }
      } catch (error) {
        console.error("Error fetching dashboard status:", error);
        setDashboardData({
          notTouchedTasks: [],
          clientNotUpdatedTasks: [],
          followUpStatusNotDoneTasks: [],
          overdueTasks: [],
        });
      } finally {
        setDashboardLoading(false);
      }
    };

    const fetchAgentRetainershipTasks = async () => {
      try {
        const response = await fetchWithAuth(
          `/api/tasks?assignedToId=${id}&retainershipTasks=true`,
        );
        if (response.ok) {
          const data = await response.json();
          const retainershipTasks = parseTaskResponse(data).filter(
            (task) => statusKey(task.status) !== "completed",
          );
          setAgentRetainershipTasks(retainershipTasks);
        } else {
          setAgentRetainershipTasks([]);
        }
      } catch (error) {
        console.error("Error fetching agent retainership tasks:", error);
        setAgentRetainershipTasks([]);
      }
    };

    const fetchAgentTriggerTasks = async () => {
      try {
        const [triggerResponse, completedResponse] = await Promise.all([
          fetchWithAuth(`/api/tasks?assignedToId=${id}&trigger=true`),
          fetchWithAuth(
            `/api/tasks?assignedToId=${id}&retainershipTasks=true&status=Completed`,
          ),
        ]);

        const pendingTriggerTasks = triggerResponse.ok
          ? parseTaskResponse(await triggerResponse.json())
          : [];
        const completedTriggerTasks = completedResponse.ok
          ? parseTaskResponse(await completedResponse.json()).filter(
            (task) => !!task.triggerDate,
          )
          : [];

        const mergedTriggerTasks = [
          ...pendingTriggerTasks,
          ...completedTriggerTasks,
        ];
        const uniqueTriggerTasks = Array.from(
          new Map(mergedTriggerTasks.map((task) => [task.id, task])).values(),
        );
        setAgentTriggerTasks(uniqueTriggerTasks);
      } catch (error) {
        console.error("Error fetching agent trigger tasks:", error);
        setAgentTriggerTasks([]);
      }
    };

    const fetchAgentLegislations = async () => {
      try {
        const response = await fetchWithAuth(`/api/legislation?assignedAgent=${id}`);
        if (response.ok) {
          const data = await response.json();
          setAgentLegislations(data || []);
        } else {
          setAgentLegislations([]);
        }
      } catch (error) {
        console.error("Error fetching agent legislations:", error);
        setAgentLegislations([]);
      }
    };

    const fetchAgentClients = async () => {
      try {
        const response = await fetchWithAuth(`/api/clients?assignedToId=${id}`);
        if (response.ok) {
          const data = await response.json();
          setAgentClients(data || []);
        } else {
          setAgentClients([]);
        }
      } catch (error) {
        console.error("Error fetching agent clients:", error);
        setAgentClients([]);
      }
    };

    const fetchAgentLeads = async () => {
      try {
        const response = await fetch(`/api/prospects?assignedAgentId=${id}`);
        if (response.ok) {
          const data = await response.json();
          setAgentLeads(data.prospects);
        }
      } catch (error) {
        console.error("Error fetching agent leads:", error);
      }
    };

    const fetchAgentOpportunity = async () => {
      try {
        const response = await fetch(`/api/opportunities?assignedAgentId=${id}`);
        if (response.ok) {
          const data = await response.json();
          setAgentOpportunities(data.opportunities);
        }
      } catch (error) {
        console.error("Error fetching agent opportunities:", error);
      }
    };

    const fetchAgentActivities = async () => {
      try {
        const response = await fetch(
          `/api/comments/agent-activities?agentId=${id}`
        );
        if (response.ok) {
          const data = await response.json();
          setActivities(data);
        }
      } catch (error) {
        console.error("Error fetching agent activities:", error);
      } finally {
        setActivitiesLoading(false);
      }
    };

    const fetchServiceRecords = async () => {
      try {
        setServiceRecordsLoading(true);
        const response = await fetchWithAuth(`/api/agents/${id}/service-records`);

        if (response.ok) {
          const data = await response.json();
          setServiceRecords(data.serviceRecords || []);
        } else if (response.status === 401) {
          console.error('Unauthorized access to service records');
          setServiceRecords([]);
        } else {
          console.error('Failed to fetch service records');
          setServiceRecords([]);
        }
      } catch (error) {
        console.error("Error fetching service records:", error);
        setServiceRecords([]);
      } finally {
        setServiceRecordsLoading(false);
      }
    };

    fetchAgent();
    fetchAgentActivities();
    fetchServiceRecords();
  }, [id]);

  // const getPriorityBadge = (priority: string) => {
  //   const colors = {
  //     Low: "bg-green-100 text-green-800 border-green-200",
  //     Medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  //     High: "bg-red-100 text-red-800 border-red-200",
  //     low: "bg-green-100 text-green-800 border-green-200",
  //     medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  //     high: "bg-red-100 text-red-800 border-red-200",
  //   };

  //   return (
  //     <Badge
  //       className={`${
  //         colors[priority as keyof typeof colors] ||
  //         "bg-gray-100 text-gray-800 border-gray-200"
  //       } border`}
  //     >
  //       {priority.charAt(0).toUpperCase() + priority.slice(1)}
  //     </Badge>
  //   );
  // };

  // const getStatusBadge = (status: string) => {
  //   const colors = {
  //     "To Do": "bg-gray-100 text-gray-800 border-gray-200",
  //     "In Progress": "bg-blue-100 text-blue-800 border-blue-200",
  //     Completed: "bg-green-100 text-green-800 border-green-200",
  //     Done: "bg-green-100 text-green-800 border-green-200",
  //     Pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  //     Overdue: "bg-red-100 text-red-800 border-red-200",
  //   };

  //   const icons = {
  //     "To Do": <Clock className="w-3 h-3 mr-1" />,
  //     "In Progress": <AlertTriangle className="w-3 h-3 mr-1" />,
  //     Completed: <CheckCircle className="w-3 h-3 mr-1" />,
  //     Done: <CheckCircle className="w-3 h-3 mr-1" />,
  //     Pending: <Clock className="w-3 h-3 mr-1" />,
  //     Overdue: <AlertTriangle className="w-3 h-3 mr-1" />,
  //   };

  //   return (
  //     <Badge
  //       className={`${
  //         colors[status as keyof typeof colors] ||
  //         "bg-gray-100 text-gray-800 border-gray-200"
  //       } border`}
  //     >
  //       {icons[status as keyof typeof icons] || (
  //         <Clock className="w-3 h-3 mr-1" />
  //       )}
  //       {status}
  //     </Badge>
  //   );
  // };

  const getAgentTypeBadge = (type: string) => {
    const colors = {
      "Senior Partner": "bg-purple-100 text-purple-800",
      Partner: "bg-blue-100 text-blue-800",
      Associate: "bg-green-100 text-green-800",
      "Junior Associate": "bg-yellow-100 text-yellow-800",
      Paralegal: "bg-orange-100 text-orange-800",
    };

    return (
      <Badge
        className={
          colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800"
        }
      >
        {type}
      </Badge>
    );
  };

  // const formatDate = (dateString: string) => {
  //   return new Date(dateString).toLocaleDateString("en-US", {
  //     year: "numeric",
  //     month: "long",
  //     day: "numeric",
  //   });
  // };

  const handleAddNote = async () => {
    if (!newNote.trim() || !currentUser) return;

    setAddingNote(true);
    try {
      const response = await fetchWithAuth(`/api/agents/${id}/service-records`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          note: newNote
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setServiceRecords([data.serviceRecord, ...serviceRecords]);
        setNewNote("");
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Failed to add service record:", errorData.error);
        alert(errorData.error || "Failed to add service record");
      }
    } catch (error) {
      console.error("Error adding service record:", error);
      if (error instanceof Error && error.message !== "Unauthorized") {
        alert("Error adding service record. Please try again.");
      }
      // Don't show alert for Unauthorized as fetchWithAuth handles the redirect
    } finally {
      setAddingNote(false);
    }
  };

  if (loading) {
    return (
      <>
        <div className="container mx-auto p-6 max-w-7xl">
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
              <div>
                <Skeleton className="h-8 w-40 mb-2" />
                <Skeleton className="h-5 w-80" />
              </div>
              <Skeleton className="h-10 w-32 mt-[20px] md:mt-0" />
            </div>
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <Skeleton className="h-6 w-1/2 mb-2" />
                  <Skeleton className="h-4 w-full mb-4" />
                  <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 p-0 md:p-4 bg-muted/30 rounded-lg">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-40 md:ml-auto" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          {/* Tabs Skeleton */}
          <Skeleton className="h-10 w-full mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-40" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-40" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            </div>
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-40" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-3 w-full" />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!agent) {
    return notFound();
  }

  const showExecutionTabs = hasExecutionRole(agent.agentRole);
  const showAdvisorTabs = hasAdvisorRole(agent.agentRole);
  const tabCount = 4 + (showExecutionTabs ? 2 : 0) + (showAdvisorTabs ? 2 : 0);
  const standardAgentTasks = agentTasks.filter((task) => !task.legislationId);

  const transferAuditSummary =
    agent.status === "inactive" ? parseLatestTransferAudit(serviceRecords) : null;

  const isAdvisorOnly = showAdvisorTabs && !showExecutionTabs;
  const isDualRole = showAdvisorTabs && showExecutionTabs;

  const statusCounts = ["Completed", "To Do", "In Progress", "Hold"].reduce(
    (acc, status) => {
      acc[status] = agentTasks.filter((task) => task.status === status).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  const taskStatusBreakdown = transferAuditSummary?.taskStatusBreakdown || {};
  const staticTotalTasks = Object.values(taskStatusBreakdown).reduce(
    (total, count) => total + Number(count || 0),
    0,
  );
  const staticCompletedTasks = Number(transferAuditSummary?.completedTaskCount || 0);

  const totalTasksForStats =
    agent.status === "inactive" ? staticTotalTasks : agentTasks.length;
  const completedForStats =
    agent.status === "inactive"
      ? staticCompletedTasks
      : statusCounts["Completed"] || 0;
  const completionRateForStats =
    totalTasksForStats > 0
      ? Math.round((completedForStats / totalTasksForStats) * 100)
      : 0;

  const liveTotalLeads = agentLeads.length;
  const liveConvertedLeads = agentLeads.filter(
    (lead) => normalizeStatus((lead as unknown as { status?: string }).status) === "converted",
  ).length;
  const liveClosedWon = agentOpportunities.filter(
    (opportunity) =>
      normalizeStatus((opportunity as unknown as { status?: string }).status) ===
      "closed as won",
  ).length;
  const liveClosedLoss = agentOpportunities.filter(
    (opportunity) => {
      const status = normalizeStatus((opportunity as unknown as { status?: string }).status);
      return status === "closed as loss" || status === "closed as lost";
    },
  ).length;

  const staticTotalLeads = Number(
    transferAuditSummary?.assignedLeadsTransferredCount || 0,
  );
  const staticConvertedLeads = Number(
    transferAuditSummary?.convertedLeadsCount || 0,
  );
  const staticClosedWon = Number(
    transferAuditSummary?.opportunitiesClosedWonCount || 0,
  );
  const staticClosedLoss = Number(
    transferAuditSummary?.opportunitiesClosedLossCount || 0,
  );

  const totalLeadsForStats =
    agent.status === "inactive" ? staticTotalLeads : liveTotalLeads;
  const convertedLeadsForStats =
    agent.status === "inactive" ? staticConvertedLeads : liveConvertedLeads;
  const closedWonForStats =
    agent.status === "inactive" ? staticClosedWon : liveClosedWon;
  const closedLossForStats =
    agent.status === "inactive" ? staticClosedLoss : liveClosedLoss;
  const conversionRateForStats =
    totalLeadsForStats > 0
      ? Math.round((convertedLeadsForStats / totalLeadsForStats) * 100)
      : 0;
  const advisorSuccessCountForStats = convertedLeadsForStats + closedWonForStats;
  const advisorSuccessRateForStats =
    totalLeadsForStats > 0
      ? Math.round((advisorSuccessCountForStats / totalLeadsForStats) * 100)
      : 0;

  const formatDashboardDateTime = (value?: string) => {
    if (!value) return "-";
    const date = new Date(value);
    if (isNaN(date.getTime())) return "-";
    const formattedDate = formatDateDDMMYY(date);
    const formattedTime = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${formattedDate} ${formattedTime}`;
  };

  const renderDashboardTable = (
    title: string,
    description: string,
    rows: DashboardTaskItem[],
    compact: boolean = false,
    accentColor: string = "border-l-gray-300",
    referenceLabel: string = "Last Relevant Interaction",
  ) => {
    return (
      <Card className={`border-l-4 min-h-30 ${accentColor}`}>
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
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-xs font-semibold w-8">#</TableHead>
                    <TableHead className="text-xs font-semibold">Task</TableHead>
                    <TableHead className="text-xs font-semibold w-55 min-w-55">Client</TableHead>
                    <TableHead className="text-xs font-semibold">{referenceLabel}</TableHead>
                    {!compact && <TableHead className="text-xs font-semibold">Follow-up</TableHead>}
                    {!compact && <TableHead className="text-xs font-semibold">Status Check</TableHead>}
                    {!compact && <TableHead className="text-xs font-semibold">Status</TableHead>}
                    {!compact && <TableHead className="text-xs font-semibold text-right">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((item, idx) => (
                    <TableRow
                      key={item.id}
                      className={compact ? "cursor-pointer hover:bg-muted/50 transition-colors" : "hover:bg-muted/30 transition-colors"}
                      onClick={compact ? () => router.push(`/task/${item.id}`) : undefined}
                    >
                      <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium text-sm max-w-32 truncate">{item.title}</TableCell>
                      <TableCell className="text-sm max-w-24 truncate">{item.clientName || "N/A"}</TableCell>
                      <TableCell className="text-sm">{formatDashboardDateTime(item.referenceAt)}</TableCell>
                      {!compact && <TableCell className="text-sm">{item.followUpDuration || "None"}</TableCell>}
                      {!compact && <TableCell className="text-sm">{item.statusCheckDuration || "None"}</TableCell>}
                      {!compact && <TableCell className="text-sm">{item.status}</TableCell>}
                      {!compact && (
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => router.push(`/task/${item.id}`)}
                          >
                            <Eye className="h-3 w-3" /> View
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
          <div>
            <h1 className="text-[28px] md:text-3xl font-bold">Agent Details</h1>
            <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
              Comprehensive view of agent information and performance
            </p>
          </div>
          {
            agent.status == "active" &&
            <div className="flex justify-end">
              <Link href={`/agent/${agent?.id}/edit`}>
                <Button className="mt-[20px] md:mt-0 w-fit bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300">
                  <Edit className="h-4 w-4" />
                  Edit Agent
                </Button>
              </Link>
            </div>
          }
        </div>

        {/* Agent Summary Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start justify-between gap-6">
              <div className="flex items-center gap-5">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={agent.photo || ""} />
                  <AvatarFallback className="text-lg">
                    {agent.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold">{agent.name}</h2>
                    {getAgentTypeBadge(agent.agentType)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>{agent.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{agent.phoneNumber}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {showAdvisorTabs ? convertedLeadsForStats : completedForStats}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {showAdvisorTabs ? "Leads Converted" : "Completed"}
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {showAdvisorTabs ? advisorSuccessRateForStats : completionRateForStats}
                      %
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Success Rate
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          // Update URL to include the active tab
          const url = new URL(window.location.href);
          url.searchParams.set('tab', value);
          window.history.replaceState({}, '', url.toString());
        }}
        className="space-y-6"
      >
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${tabCount}, minmax(0, 1fr))` }}>
          {showExecutionTabs && (
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4 hidden md:block" />
              <p className="text-[10px] md:text-[12px]">Dashboard</p>
            </TabsTrigger>
          )}
          <TabsTrigger value="details" className="flex items-center gap-2">
            <User className="h-4 w-4 hidden md:block" />
            <p className="text-[10px] md:text-[12px]">Agent Details</p>
          </TabsTrigger>
          {showExecutionTabs && (
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <FileText className="h-4 w-4 hidden md:block" />
              <p className="text-[10px] md:text-[12px]">
                Tasks ({agentTasks.length})
              </p>
            </TabsTrigger>
          )}
          {showAdvisorTabs && (
            <TabsTrigger value="leads" className="flex items-center gap-2">
              <FileText className="h-4 w-4 hidden md:block" />
              <p className="text-[10px] md:text-[12px]">
                Leads ({agentLeads.length})
              </p>
            </TabsTrigger>
          )}
          {showAdvisorTabs && (
            <TabsTrigger value="opportunity" className="flex items-center gap-2">
              <FileText className="h-4 w-4 hidden md:block" />
              <p className="text-[10px] md:text-[12px]">
                Opportunity ({agentOpportunities.length})
              </p>
            </TabsTrigger>
          )}

          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4 hidden md:block" />
            <p className="text-[10px] md:text-[12px]">
              Team ({teamMembers.length})
            </p>
          </TabsTrigger>
          <TabsTrigger value="activities" className="flex items-center gap-2">
            <Clock className="h-4 w-4 hidden md:block" />
            <p className="text-[10px] md:text-[12px]">Activities</p>
          </TabsTrigger>
          <TabsTrigger value="service-records" className="flex items-center gap-2">
            <FileText className="h-4 w-4 hidden md:block" />
            <p className="text-[10px] md:text-[12px]">Service Records</p>
          </TabsTrigger>
        </TabsList>

        {showExecutionTabs && (
          <TabsContent value="dashboard" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">SLA Dashboard</h2>
                <p className="text-muted-foreground text-sm">
                  Task attention overview for <span className="font-medium text-foreground">{agent.name}</span>
                </p>
              </div>
              {/* Date snapshot filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-8 w-56 justify-start text-left font-normal",
                        !dashboardDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dashboardDate
                        ? formatDateDDMMYY(dashboardDate)
                        : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={dashboardDate}
                      onSelect={setDashboardDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    const fetchDashboard = async () => {
                      try {
                        setDashboardLoading(true);
                        const params = new URLSearchParams({ assignedToId: id });
                        if (dashboardDate) params.set("date", toISODate(dashboardDate));
                        const response = await fetchWithAuth(`/api/agents/dashboard-status?${params.toString()}`);
                        if (response.ok) {
                          const data = (await response.json()) as DashboardStatusResponse;
                          setDashboardData({
                            notTouchedTasks: data.notTouchedTasks || [],
                            clientNotUpdatedTasks: data.clientNotUpdatedTasks || [],
                            followUpStatusNotDoneTasks: data.followUpStatusNotDoneTasks || [],
                            overdueTasks: data.overdueTasks || [],
                          });
                        }
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setDashboardLoading(false);
                      }
                    };
                    fetchDashboard();
                  }}
                >
                  Apply
                </Button>
                {dashboardDate && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8"
                    onClick={() => {
                      const today = new Date();
                      setDashboardDate(today);
                      const fetchDashboard = async () => {
                        try {
                          setDashboardLoading(true);
                          const params = new URLSearchParams({ assignedToId: id });
                          params.set("date", toISODate(today));
                          const response = await fetchWithAuth(`/api/agents/dashboard-status?${params.toString()}`);
                          if (response.ok) {
                            const data = (await response.json()) as DashboardStatusResponse;
                            setDashboardData({
                              notTouchedTasks: data.notTouchedTasks || [],
                              clientNotUpdatedTasks: data.clientNotUpdatedTasks || [],
                              followUpStatusNotDoneTasks: data.followUpStatusNotDoneTasks || [],
                              overdueTasks: data.overdueTasks || [],
                            });
                          }
                        } catch (err) {
                          console.error(err);
                        } finally {
                          setDashboardLoading(false);
                        }
                      };
                      fetchDashboard();
                    }}
                  >
                    Today
                  </Button>
                )}
              </div>
            </div>

            {dashboardLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                <Clock className="h-8 w-8 animate-spin text-primary/60" />
                <p className="text-sm">Loading dashboard data...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary stat cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="border-l-4 border-l-amber-500">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Not Touched</p>
                        <p className="text-2xl font-bold mt-0.5">{dashboardData.notTouchedTasks.length}</p>
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
                        <p className="text-2xl font-bold mt-0.5">{dashboardData.clientNotUpdatedTasks.length}</p>
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
                        <p className="text-2xl font-bold mt-0.5">{dashboardData.followUpStatusNotDoneTasks.length}</p>
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
                        <p className="text-2xl font-bold mt-0.5">{dashboardData.overdueTasks.length}</p>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                        <AlertTriangle className="h-5 w-5 text-rose-600" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Side-by-side compact tables */}
                <div className="flex flex-col lg:flex-row gap-6 items-start">
                  <div className="flex-1 min-w-0">
                    {renderDashboardTable(
                      "Not Touched Tasks",
                      "No normal interaction in the last 24 hours (follow-up: None).",
                      dashboardData.notTouchedTasks,
                      true,
                      "border-l-amber-500",
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {renderDashboardTable(
                      "Client Not Updated Tasks",
                      "No client update received within the expected duration.",
                      dashboardData.clientNotUpdatedTasks,
                      true,
                      "border-l-red-500",
                    )}
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 items-start">
                  <div className="flex-1 min-w-0">
                    {renderDashboardTable(
                      "Follow-up & Status Not Done (48hrs / 1 Week)",
                      "48hr/1w follow-up tasks with no interaction, follow-up pending, and status unchanged.",
                      dashboardData.followUpStatusNotDoneTasks,
                      true,
                      "border-l-purple-500",
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {renderDashboardTable(
                      "Overdue Tasks",
                      "Active tasks whose due date has already passed.",,
                      dashboardData.overdueTasks,
                      true,
                      "border-l-rose-500",
                      "Due Date",
                    )}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        )}

        {/* Agent Details Tab */}
        <TabsContent value="details" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Personal Information */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Full Name
                      </label>
                      <p className="font-medium">{agent.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Agent Type
                      </label>
                      <div className="mt-1">
                        {getAgentTypeBadge(agent.agentType)}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Email
                      </label>
                      <p className="font-medium">{agent.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Phone
                      </label>
                      <p className="font-medium">{agent.phoneNumber}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Jurisdiction
                      </label>
                      <p className="font-medium">{agent.jurisdiction}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Employee ID
                      </label>
                      <p className="font-medium">{agent.barAssociationId}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Specializations */}
              <Card>
                <CardHeader>
                  <CardTitle>Specializations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {agent.specializations.map((spec) => (
                      <Badge key={spec} variant="outline" className="text-sm">
                        {spec}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance Stats */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 justify-between">
                    <span className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Performance Stats
                    </span>
                    {agent.status === "inactive" && (
                      <Badge variant="outline">Static Snapshot</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {showExecutionTabs && (
                    <>
                      {isDualRole && (
                        <div className="text-sm font-semibold text-muted-foreground">Task Metrics</div>
                      )}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Total Tasks</span>
                          <span className="text-lg font-bold">
                            {totalTasksForStats}
                          </span>
                        </div>
                        {[
                          "Completed",
                          "To Do",
                          "In Progress",
                          "Hold"
                        ].map((status) => (
                          <div className="flex justify-between items-center" key={status}>
                            <span className="text-sm font-medium">{status}</span>
                            <span className={
                              `text-lg font-bold ` +
                              (status === "Completed"
                                ? "text-green-600"
                                : status === "To Do"
                                  ? "text-orange-600"
                                  : status === "In Progress"
                                    ? "text-blue-600"
                                    : status === "Hold"
                                      ? "text-gray-500"
                                      : "text-gray-800")
                            }>
                              {agent.status === "inactive"
                                ? Number(taskStatusBreakdown[status] || 0)
                                : Number(statusCounts[status] || 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">
                            Completion Rate
                          </span>
                          <span className="text-sm font-bold">
                            {completionRateForStats}
                            %
                          </span>
                        </div>
                        <Progress
                          value={completionRateForStats}
                          className="h-2"
                        />
                      </div>
                    </>
                  )}

                  {showAdvisorTabs && (
                    <>
                      {isDualRole && <div className="border-t my-2" />}
                      {isDualRole && (
                        <div className="text-sm font-semibold text-muted-foreground">Lead & Opportunity Metrics</div>
                      )}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Total Leads</span>
                          <span className="text-lg font-bold">{totalLeadsForStats}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Leads Converted to Opportunity</span>
                          <span className="text-lg font-bold text-blue-600">{convertedLeadsForStats}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Opportunities Closed as Won</span>
                          <span className="text-lg font-bold text-green-600">{closedWonForStats}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Opportunities Closed as Loss</span>
                          <span className="text-lg font-bold text-red-600">{closedLossForStats}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Success Count (Converted + Won)</span>
                          <span className="text-lg font-bold text-emerald-600">{advisorSuccessCountForStats}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Success Rate</span>
                          <span className="text-sm font-bold">{advisorSuccessRateForStats}%</span>
                        </div>
                        <Progress value={advisorSuccessRateForStats} className="h-2" />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tasks Tab */}
        {showExecutionTabs && (
          <TabsContent value="tasks" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Task Management</h2>
                <p className="text-muted-foreground text-sm">
                  Manage and track tasks, legislation, retainership work, future triggers, and retainership clients assigned to {agent.name}
                </p>
              </div>
            </div>

            {tasksLoading ? (
              <div className="flex justify-center items-center py-16 text-muted-foreground">
                <Clock className="h-6 w-6 animate-spin mr-2" /> Loading tasks...
              </div>
            ) : (
              <Tabs value={taskOverviewTab} onValueChange={setTaskOverviewTab} className="space-y-6">
                <TabsList className="grid h-auto w-full grid-cols-5">
                  <TabsTrigger value="standard-tasks" className="flex items-center gap-2 px-2 py-3 text-[11px] md:text-sm">
                    <FileText className="h-4 w-4 hidden md:block" />
                    Standard Tasks ({standardAgentTasks.length})
                  </TabsTrigger>
                  <TabsTrigger value="legislation" className="flex items-center gap-2 px-2 py-3 text-[11px] md:text-sm">
                    <CheckCircle className="h-4 w-4 hidden md:block" />
                    Assigned Legislation ({agentLegislations.length})
                  </TabsTrigger>
                  <TabsTrigger value="retainership-tasks" className="flex items-center gap-2 px-2 py-3 text-[11px] md:text-sm">
                    <CheckCircle className="h-4 w-4 hidden md:block" />
                    Retainership Tasks ({agentRetainershipTasks.length})
                  </TabsTrigger>
                  <TabsTrigger value="future-triggers" className="flex items-center gap-2 px-2 py-3 text-[11px] md:text-sm">
                    <Clock className="h-4 w-4 hidden md:block" />
                    Future Triggers ({agentTriggerTasks.length})
                  </TabsTrigger>
                  <TabsTrigger value="clients" className="flex items-center gap-2 px-2 py-3 text-[11px] md:text-sm">
                    <Users className="h-4 w-4 hidden md:block" />
                    Clients ({agentClients.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="standard-tasks" className="space-y-6">
                  {standardAgentTasks.length === 0 ? (
                    <Card>
                      <CardContent className="text-center py-8 text-muted-foreground">
                        No standard tasks assigned to this agent.
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-[40px]">
                      <SectionTable
                        label="New Task"
                        tasks={standardAgentTasks.filter((task) => statusKey(task.status) === "todo").slice(0, 3)}
                        agentId={id}
                      />
                      <SectionTable
                        label="In Progress"
                        tasks={standardAgentTasks.filter((task) => statusKey(task.status) === "inprogress").slice(0, 3)}
                        agentId={id}
                      />
                      <SectionTable
                        label="Completed"
                        tasks={standardAgentTasks.filter((task) => statusKey(task.status) === "completed").slice(0, 3)}
                        agentId={id}
                      />
                      <SectionTable
                        label="Hold"
                        tasks={standardAgentTasks.filter((task) => statusKey(task.status) === "hold").slice(0, 3)}
                        agentId={id}
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="legislation" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        Assigned Legislation ({agentLegislations.length})
                      </CardTitle>
                      <CardDescription>
                        Legislation assigned to {agent.name}, including task health and quick actions.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Client</TableHead>
                              <TableHead>Legislation</TableHead>
                              <TableHead>Tasks</TableHead>
                              <TableHead>Assigned Agent</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {agentLegislations.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                                  No legislation assigned to this agent.
                                </TableCell>
                              </TableRow>
                            ) : (
                              agentLegislations.map((legislation) => {
                                const client = legislation.retainership?.client;
                                const activeTasks = legislation.tasks?.filter((task) => task.active && statusKey(task.status) !== "completed" && statusKey(task.status) !== "hold") || [];
                                const overdueTasks = activeTasks.filter((task) => task.dueDate && new Date(task.dueDate) < new Date());
                                const pendingTriggers = legislation.tasks?.filter((task) => !task.active && statusKey(task.status) !== "completed" && statusKey(task.status) !== "hold") || [];

                                return (
                                  <TableRow
                                    key={legislation.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => router.push(`/legislation/${legislation.id}`)}
                                  >
                                    <TableCell
                                      onClick={(event) => {
                                        if (!client?.id) return;
                                        event.stopPropagation();
                                        router.push(`/client/${client.id}`);
                                      }}
                                      className={client?.id ? "cursor-pointer" : undefined}
                                    >
                                      <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10 flex-shrink-0">
                                          <AvatarFallback>{getClientInitials(client)}</AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                          <div className="truncate font-medium">{getClientDisplayName(client)}</div>
                                          <div className="truncate text-xs text-muted-foreground">{client?.email || "No email"}</div>
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="font-medium">{legislation.title}</div>
                                      <div className="line-clamp-2 text-xs text-muted-foreground">{legislation.description || "No description"}</div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-col gap-2">
                                        <Badge variant="outline">Total: {legislation.tasks?.length || 0}</Badge>
                                        <Badge variant="outline">Running: {activeTasks.length}</Badge>
                                        <Badge variant="outline">Overdue: {overdueTasks.length}</Badge>
                                        <Badge variant="outline">Pending Triggers: {pendingTriggers.length}</Badge>
                                      </div>
                                    </TableCell>
                                    <TableCell>{legislation.assignedAgent?.name || agent.name}</TableCell>
                                    <TableCell className="text-right">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" className="h-8 w-8 p-0" onClick={(event) => event.stopPropagation()}>
                                            <span className="sr-only">Open menu</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                          <DropdownMenuItem asChild>
                                            <Link href={`/legislation/${legislation.id}`} onClick={(event) => event.stopPropagation()}>
                                              <Eye className="mr-2 h-4 w-4" />
                                              View Details
                                            </Link>
                                          </DropdownMenuItem>
                                          <DropdownMenuItem asChild>
                                            <Link
                                              href={`/task/create?legislationId=${legislation.id}&assignedAgent=${legislation.assignedAgent?.id || id}&client=${legislation.retainership?.clientId || ""}`}
                                              onClick={(event) => event.stopPropagation()}
                                            >
                                              <PlusCircle className="mr-2 h-4 w-4" />
                                              Create Task
                                            </Link>
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="retainership-tasks" className="space-y-6">
                  {agentRetainershipTasks.length === 0 ? (
                    <Card>
                      <CardContent className="text-center py-8 text-muted-foreground">
                        No retainership tasks assigned to this agent.
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-[40px]">
                      <SectionTable
                        label="New Task"
                        tasks={agentRetainershipTasks.filter((task) => statusKey(task.status) === "todo").slice(0, 3)}
                        agentId={id}
                        retainershipTasks={true}
                      />
                      <SectionTable
                        label="In Progress"
                        tasks={agentRetainershipTasks.filter((task) => statusKey(task.status) === "inprogress").slice(0, 3)}
                        agentId={id}
                        retainershipTasks={true}
                      />
                      <SectionTable
                        label="Completed"
                        tasks={agentRetainershipTasks.filter((task) => statusKey(task.status) === "completed").slice(0, 3)}
                        agentId={id}
                        retainershipTasks={true}
                      />
                      <SectionTable
                        label="Hold"
                        tasks={agentRetainershipTasks.filter((task) => statusKey(task.status) === "hold").slice(0, 3)}
                        agentId={id}
                        retainershipTasks={true}
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="future-triggers" className="space-y-6">
                  {agentTriggerTasks.length === 0 ? (
                    <Card>
                      <CardContent className="text-center py-8 text-muted-foreground">
                        No future-trigger tasks assigned to this agent.
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-[40px]">
                      <SectionTable
                        label="New Task"
                        tasks={agentTriggerTasks.filter((task) => statusKey(task.status) === "todo").slice(0, 3)}
                        agentId={id}
                        trigger={true}
                      />
                      <SectionTable
                        label="In Progress"
                        tasks={agentTriggerTasks.filter((task) => statusKey(task.status) === "inprogress").slice(0, 3)}
                        agentId={id}
                        trigger={true}
                      />
                      <SectionTable
                        label="Completed"
                        tasks={agentTriggerTasks.filter((task) => statusKey(task.status) === "completed").slice(0, 3)}
                        agentId={id}
                        trigger={true}
                      />
                      <SectionTable
                        label="Hold"
                        tasks={agentTriggerTasks.filter((task) => statusKey(task.status) === "hold").slice(0, 3)}
                        agentId={id}
                        trigger={true}
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="clients" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Retainership Clients ({agentClients.length})
                      </CardTitle>
                      <CardDescription>
                        Clients linked to retainership legislation assigned to {agent.name}.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Client</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Contact</TableHead>
                              <TableHead>Retainerships</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {agentClients.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                                  No retainership clients assigned to this agent.
                                </TableCell>
                              </TableRow>
                            ) : (
                              agentClients.map((client) => (
                                <TableRow
                                  key={client.id}
                                  onClick={() => router.push(`/client/${client.id}`)}
                                  className="cursor-pointer hover:bg-muted/50"
                                >
                                  <TableCell>
                                    <div className="flex items-center gap-3">
                                      <Avatar className="h-10 w-10 flex-shrink-0">
                                        <AvatarFallback>
                                          {client.clientType === "organization" ? (
                                            <Building2 className="h-4 w-4" />
                                          ) : (
                                            getClientInitials(client)
                                          )}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="min-w-0">
                                        <div className="truncate font-medium">{getClientDisplayName(client)}</div>
                                        <div className="truncate text-xs text-muted-foreground">{client.authorizedPersonName || client.gender || "No secondary details"}</div>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>{getClientTypeBadge(client.clientType)}</TableCell>
                                  <TableCell>
                                    <div className="space-y-1 text-sm">
                                      <div className="truncate">{client.email || "No email"}</div>
                                      <div className="truncate text-muted-foreground">{client.phoneNumber || "No phone"}</div>
                                    </div>
                                  </TableCell>
                                  <TableCell>{client.retainershipCount || 0}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </TabsContent>
        )}
        {showAdvisorTabs && (
          <>
            <TabsContent value="leads" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Leads Management</h2>
                  <p className="text-muted-foreground text-sm">
                    Manage and track leads assigned to {agent.name}
                  </p>
                </div>
              </div>

              {tasksLoading ? (
                <div className="flex justify-center items-center py-16 text-muted-foreground">
                  <Clock className="h-6 w-6 animate-spin mr-2" /> Loading leads...
                </div>
              ) : agentLeads.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-muted-foreground">
                      No leads assigned to this agent.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-[40px]">
                  <ProspectTable
                    label="New Prospects"
                    prospects={agentLeads.filter((p) => p.status === "New").slice(0, 5)}
                    statusFilter="New"
                    assignedId={id}
                  />

                  <ProspectTable
                    label="In Progress Prospects"
                    prospects={agentLeads.filter((p) => p.status === "In Progress").slice(0, 5)}
                    statusFilter="In Progress"
                    assignedId={id}

                  />

                  <ProspectTable
                    label="Relevant but not Now Prospects"
                    prospects={agentLeads
                      .filter((p) => p.status === "Relevant but not Now")
                      .slice(0, 5)}
                    statusFilter="Relevant but not Now"
                    assignedId={id}

                  />

                  <ProspectTable
                    label="Career Prospects"
                    prospects={agentLeads.filter((p) => p.status === "Career").slice(0, 5)}
                    statusFilter="Career"
                    assignedId={id}

                  />

                  <ProspectTable
                    label="Not Relevant Prospects"
                    prospects={agentLeads.filter((p) => p.status === "Not Relevant").slice(0, 5)}
                    statusFilter="Not Relevant"
                    assignedId={id}

                  />
                </div>
              )}
            </TabsContent>
            <TabsContent value="opportunity" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Opportunity Management</h2>
                  <p className="text-muted-foreground text-sm">
                    Manage and track opportunity assigned to {agent.name}
                  </p>
                </div>
              </div>

              {tasksLoading ? (
                <div className="flex justify-center items-center py-16 text-muted-foreground">
                  <Clock className="h-6 w-6 animate-spin mr-2" /> Loading opportunities...
                </div>
              ) : agentOpportunities.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-muted-foreground">
                      No opportunities assigned to this agent.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-[40px]">
                  <ProspectsTable label="New Opportunity" prospects={agentOpportunities.filter((prospect) => prospect.status == "New Opportunity").slice(0, 5)} statusFilter="New Opportunity" assignedId={id} />

                  <ProspectsTable label="Proposal Issued" prospects={agentOpportunities.filter((prospect) => prospect.status == "Proposal Issued").slice(0, 5)} statusFilter="Proposal Issued" assignedId={id} />
                  <ProspectsTable
                    label="Closed as Won Prospects"
                    prospects={agentOpportunities.filter((prospect) => prospect.status == "Closed as Won").slice(0, 5)}
                    statusFilter="Closed as Won Prospects"
                    assignedId={id}
                  />
                  <ProspectsTable
                    label="Closed as Loss Prospects"
                    prospects={agentOpportunities.filter((prospect) => prospect.status == "Closed as Loss").slice(0, 5)}
                    statusFilter="Closed as Loss Prospects"
                    assignedId={id}
                  />
                </div>
              )}
            </TabsContent>
          </>
        )}


        {/* Team Tab */}
        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Team Members</span>
              </CardTitle>
              <CardDescription>
                Team members reporting to {agent.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {teamMembers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    No team members found for this agent.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Specializations</TableHead>
                        <TableHead>Jurisdiction</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamMembers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={member.photo || ""} />
                                <AvatarFallback>
                                  {member.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{member.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {member.email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getAgentTypeBadge(member.agentType)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {member.specializations
                                .slice(0, 2)
                                .map((spec) => (
                                  <Badge
                                    key={spec}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {spec}
                                  </Badge>
                                ))}
                              {member.specializations.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{member.specializations.length - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{member.jurisdiction}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="default">Active</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem asChild>
                                  <Link href={`/agent/${member.id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Profile
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/agent/${member.id}/edit`}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Member
                                  </Link>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent >

        {/* Activities Tab */}
        < TabsContent value="activities" className="space-y-6" >
          <Card>
            <CardHeader>
              <CardTitle>Agent Activities</CardTitle>
              <CardDescription>
                Comments made by this agent on their tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activitiesLoading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading activities...</p>
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    No activities found for this agent.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupActivitiesByDate(activities)).map(([date, acts]) => (
                    <Card key={date} className="border shadow-sm">
                      <CardHeader className="bg-muted/40 rounded-t-lg">
                        <CardTitle className="text-base text-center">{formatDateDMY(date)}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="rounded-md border overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Task</TableHead>
                                <TableHead>Interaction</TableHead>
                                <TableHead>Date & Time</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {acts.map((activity, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="break-words whitespace-pre-line align-top" style={{ wordBreak: 'break-word', whiteSpace: 'pre-line', width: '33%', minWidth: 120, maxWidth: 240 }}>
                                    {activity.taskTitle ? (
                                      <Link
                                        href={`/task/${activity.taskId}?agentId=${id}`}
                                        className="text-blue-600 hover:underline break-words whitespace-pre-line block"
                                        style={{ wordBreak: 'break-word', whiteSpace: 'pre-line' }}
                                      >
                                        {activity.taskTitle}
                                      </Link>
                                    ) : (
                                      <span className="text-muted-foreground">Unknown Task</span>
                                    )}
                                  </TableCell>
                                  <TableCell style={{ wordBreak: 'break-word', whiteSpace: 'pre-line', maxWidth: 200 }}>
                                    {activity.content}
                                  </TableCell>
                                  <TableCell>{new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent >

        {/* Service Records Tab */}
        < TabsContent value="service-records" className="space-y-6" >
          <Card>
            <CardHeader>
              <CardTitle>Service Records</CardTitle>
              <CardDescription>
                Administrative notes and remarks for {agent.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Add Note Section - Only for Admin/Owner */}
              {currentUser && (currentUser.adminType === "admin" || currentUser.adminType === "owner") && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="text-base">Add Note</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <textarea
                        id="note"
                        className="w-full min-h-[100px] p-3 border rounded-md resize-vertical"
                        placeholder="Enter your note or remark here..."
                        value={newNote}
                        disabled={agent.status !== "active"}
                        onChange={(e) => setNewNote(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleAddNote}
                      disabled={!newNote.trim() || addingNote}
                      className="bg-[#003459] hover:bg-[#003459] text-white"
                    >
                      {addingNote ? "Adding..." : "Add Note"}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Service Records List */}
              {serviceRecordsLoading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading service records...</p>
                </div>
              ) : serviceRecords.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    No service records found for this agent.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {serviceRecords.map((record) => (
                    <Card key={record.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {record.createdBy?.username?.charAt(0)?.toUpperCase() || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{record.createdBy?.username || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">
                                {record.createdBy?.adminType === "owner" ? "Owner" : "Admin"}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(record.createdAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })} at{" "}
                            {new Date(record.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className="mt-3">
                          <p className="text-sm whitespace-pre-wrap">{record.note}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent >
      </Tabs >

      {/* AlertDialog for Delete Confirmation */}
      {
        taskToDelete && (
          <AlertDialog open={!!taskToDelete} onOpenChange={() => setTaskToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the task &quot;{taskToDelete?.title}&quot;.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setTaskToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    if (!taskToDelete) return; // Ensure taskToDelete is not null
                    setIsDeleting(true);
                    try {
                      const response = await fetch(`/api/tasks/${taskToDelete.id}`, {
                        method: "DELETE",
                      });
                      if (response.ok) {
                        setAgentTasks((prevTasks) => prevTasks.filter((t) => t.id !== taskToDelete.id));
                        router.push(`/agent/${id}?tab=tasks`); // Redirect back to tasks tab
                      } else {
                        alert("Failed to delete the task. Please try again.");
                      }
                    } catch (error) {
                      console.error("Error deleting task:", error);
                      alert("An error occurred while deleting the task.");
                    } finally {
                      setIsDeleting(false);
                      setTaskToDelete(null);
                    }
                  }}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )
      }
    </div >
  );
}
