"use client";

import { useState, useEffect, Fragment } from "react";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { SectionTable } from "@/components/SectionTable";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  MoreHorizontal,
  Edit,
  Eye,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Agent, Task } from "@/types";
import Link from "next/link";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { hasAdvisorRole, hasExecutionRole } from "@/lib/agentRole";
import { ProspectTable } from "@/app/(sales)/dashboard/prospects/page";
import { ProspectsTable } from "@/app/(sales)/dashboard/opportunities/page";


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

interface CurrentUser {
  id: string;
  username: string;
  email: string;
  adminType: "owner" | "admin";
}

// Helper to normalize status string
function statusKey(s?: string) {
  const k = (s || "").toLowerCase().replace(/\s+/g, "");
  if (["todo", "pending"].includes(k)) return "todo";
  if (["inprogress", "progress"].includes(k)) return "inprogress";
  if (["completed"].includes(k)) return "completed";
  return k || "todo";
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

function mergeTeamMembers(agentData: Agent) {
  const combinedMembers = [
    ...(agentData.subordinates || []),
    ...(agentData.advisorSubordinates || []),
  ];

  return combinedMembers.filter(
    (member, index, members) =>
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
  const [agentLeads, setAgentLeads] = useState<Task[]>([]);
  const [agentOpportunities, setAgentOpportunities] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>(searchParams.get("tab") || "details");

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
              hasExecutionAccess ? "tasks" : "leads",
            );
          }

          const dataRequests: Promise<void>[] = [];

          if (hasExecutionAccess) {
            dataRequests.push(fetchAgentTasks());
          }

          if (hasAdvisorAccess) {
            dataRequests.push(fetchAgentLeads(), fetchAgentOpportunity());
          }

          if (dataRequests.length > 0) {
            await Promise.all(dataRequests);
          }

          setTasksLoading(false);

          setTeamMembers(mergeTeamMembers(data));
        } else {
          notFound();
        }
      } catch (error) {
        console.error("Error fetching agent:", error);
        notFound();
      } finally {
        setLoading(false);
      }
    };

    const fetchAgentTasks = async () => {
      try {
        const response = await fetch(`/api/tasks?assignedToId=${id}`);
        if (response.ok) {
          const data = await response.json();
          setAgentTasks(data);
        }
      } catch (error) {
        console.error("Error fetching agent tasks:", error);
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
      } finally {
        setTasksLoading(false);
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
  const tabCount = 4 + (showExecutionTabs ? 1 : 0) + (showAdvisorTabs ? 2 : 0);

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
                      {
                        agentTasks.filter(
                          (task) =>
                            task.status === "Completed"
                        ).length
                      }
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Completed
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {agentTasks.length > 0
                        ? Math.round(
                          (agentTasks.filter(
                            (task) =>
                              task.status === "Completed"
                          ).length / agentTasks.length) *
                          100
                        )
                        : 0}
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
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Performance Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Total Tasks</span>
                      <span className="text-lg font-bold">
                        {agentTasks.length}
                      </span>
                    </div>
                    {/* Dynamically show all status counts */}
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
                          {agentTasks.filter((task) => task.status === status).length}
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
                        {agentTasks.length > 0
                          ? Math.round(
                            (agentTasks.filter(
                              (task) =>
                                task.status === "Completed" ||
                                task.status === "Done"
                            ).length /
                              agentTasks.length) *
                            100
                          )
                          : 0}
                        %
                      </span>
                    </div>
                    <Progress
                      value={
                        agentTasks.length > 0
                          ? Math.round(
                            (agentTasks.filter(
                              (task) =>
                                task.status === "Completed"
                            ).length /
                              agentTasks.length) *
                            100
                          )
                          : 0
                      }
                      className="h-2"
                    />
                  </div>
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
                  Manage and track tasks assigned to {agent.name}
                </p>
              </div>
            </div>

            {tasksLoading ? (
              <div className="flex justify-center items-center py-16 text-muted-foreground">
                <Clock className="h-6 w-6 animate-spin mr-2" /> Loading tasks...
              </div>
            ) : agentTasks.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">
                    No tasks assigned to this agent.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-[40px]">
                <SectionTable
                  label="New Task"
                  tasks={agentTasks.filter((t) => ["todo"].includes(statusKey(t.status))).slice(0, 3)}
                  agentId={id}
                />
                <SectionTable
                  label="In Progress"
                  tasks={agentTasks.filter((t) => ["inprogress"].includes(statusKey(t.status))).slice(0, 3)}
                  agentId={id}
                />
                <SectionTable
                  label="Completed"
                  tasks={agentTasks.filter((t) => ["completed"].includes(statusKey(t.status))).slice(0, 3)}
                  agentId={id}
                />
                <SectionTable
                  label="Hold"
                  tasks={agentTasks.filter((t) => ["hold"].includes(statusKey(t.status))).slice(0, 3)}
                  agentId={id}
                />
              </div>
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
