"use client";

import { Fragment, useState, useEffect } from "react";
import { notFound, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  Calendar,
  Users,
  FileText,
  MoreHorizontal,
  Edit,
  Eye,
  CheckCircle,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Agent, Prospect, Task } from "@/types";
import Link from "next/link";
import { hasAdvisorRole, hasExecutionRole } from "@/lib/agentRole";

interface AgentActivity {
  taskId: string;
  taskTitle: string;
  content: string;
  createdAt: string;
}

interface OpportunityRecord {
  id: string;
  status: string;
  nextFollowUp?: string;
  createdAt: string;
  prospect?: Prospect;
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
function formatDateDMY(dateString?: string) {
  if (!dateString) return "-";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function statusKey(s?: string) {
  const k = (s || "").toLowerCase().replace(/\s+/g, "");
  if (["todo", "pending"].includes(k)) return "todo";
  if (["inprogress", "progress"].includes(k)) return "inprogress";
  if (["completed"].includes(k)) return "completed";
  if (["hold"].includes(k)) return "hold";
  return k || "todo";
}

function sectionLabelToStatus(label: string) {
  const l = label.toLowerCase();
  if (l.includes("progress")) return "In Progress";
  if (l.includes("completed")) return "Completed";
  if (l.includes("hold")) return "Hold";
  return "To Do";
}

function parseTaskResponse(data: unknown): Task[] {
  if (Array.isArray(data)) {
    return data as Task[];
  }

  if (
    data &&
    typeof data === "object" &&
    "tasks" in data &&
    Array.isArray((data as { tasks?: unknown }).tasks)
  ) {
    return (data as { tasks: Task[] }).tasks;
  }

  return [];
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

function getDefaultTabForAgent(agentData: Agent) {
  if (hasExecutionRole(agentData.agentRole)) {
    return "tasks";
  }

  if (hasAdvisorRole(agentData.agentRole)) {
    return "leads";
  }

  return "details";
}

interface SectionTableProps {
  label: string;
  tasks: Task[];
  agentId: string;
  retainershipTasks?: boolean;
  trigger?: boolean;
}

function SectionTable({
  label,
  tasks,
  agentId,
  retainershipTasks,
  trigger,
}: SectionTableProps) {
  const labelColor = (() => {
    const l = label.toLowerCase();
    if (l.includes("progress")) return "text-sky-600";
    if (l.includes("completed")) return "text-green-600";
    if (l.includes("hold")) return "text-gray-600";
    return "text-blue-600";
  })();

  return (
    <>
      <div className="flex items-center gap-4 min-w-0">
        {/* Rotated label column shown on md+ */}
        <div className="w-[96px] h-auto hidden md:flex items-center justify-center self-stretch flex-shrink-0 bg-white rounded-lg py-6 px-2">
          <span
            className={`block rotate-[-90deg] origin-center whitespace-nowrap tracking-widest font-semibold select-none text-[24px] ${labelColor}`}
          >
            {label}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <Card className="min-h-[250px] py-0 gap-0 rounded-md shadow-sm">
            <CardContent className="p-0">
              {/* Mobile heading */}
              <div
                className={`md:hidden flex items-center justify-center px-4 py-4 rounded-lg shadow-sm border border-gray-100 font-semibold ${labelColor} text-2xl tracking-widest`}
              >
                {label}
              </div>

              {/* Desktop table */}
              <div className="rounded-md overflow-hidden hidden md:block bg-white shadow-sm">
                <Table className="w-full table-fixed text-sm [&_th]:py-3 [&_th]:h-12 [&_td]:py-3">
                  <colgroup>
                    <col className="w-[180px]" />
                    <col className="w-[130px]" />
                    <col className="w-[90px]" />
                    <col className="w-[100px]" />
                    <col className="w-[110px]" />
                    <col className="w-[60px]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-white">Task</TableHead>
                      <TableHead className="text-white">Client</TableHead>
                      <TableHead className="text-white">Priority</TableHead>
                      <TableHead className="text-white">Due Date</TableHead>
                      <TableHead className="text-white">Last Completed</TableHead>
                      <TableHead className="text-white">Progress</TableHead>
                      <TableHead className="text-right text-white">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center py-4 text-muted-foreground"
                        >
                          No tasks found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      tasks.map((t) => {
                        const clientName = t.client
                          ? t.client.name ||
                          (t.client.clientType === "individual"
                            ? `${t.client.firstName ?? ""} ${t.client.lastName ?? ""
                              }`.trim()
                            : t.client.organizationName ?? "")
                          : "-";
                        const shortId = `T-${t.id.slice(0, 6).toUpperCase()}`;
                        const categoryName = t.category?.name;
                        const clientEmail = t.client?.email ?? "";
                        const priority = (t.priority || "").toLowerCase();
                        const isOverdue = t.dueDate
                          ? new Date(t.dueDate) < new Date() &&
                          statusKey(t.status) !== "completed"
                          : false;
                        const statusLabel = (() => {
                          const k = statusKey(t.status);
                          if (k === "completed") return "Completed";
                          if (k === "inprogress") return "In Progress";
                          if (k === "hold") return "Hold";
                          return "To Do";
                        })();

                        const priorityBadge = (p: string) => {
                          if (!p)
                            return (
                              <span className="text-muted-foreground">-</span>
                            );
                          if (p.includes("high"))
                            return (
                              <span className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm">
                                <span className="text-xs">❗</span> High
                              </span>
                            );
                          if (p.includes("medium"))
                            return (
                              <span className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm">
                                <span className="text-xs">⚠️</span> Medium
                              </span>
                            );
                          return (
                            <span className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                              Low
                            </span>
                          );
                        };

                        return (
                          <TableRow
                            key={t.id}
                            className="even:bg-muted/30"
                          >
                            <TableCell
                              className="truncate max-w-[260px] align-top"
                              title={t.title || shortId}
                            >
                              <div className="flex flex-col">
                                <Link
                                  href={`/task/${t.id}?agentId=${agentId}&tab=tasks`}
                                  className="text-foreground font-medium hover:underline truncate"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {t.title || shortId}
                                </Link>
                                {categoryName ? (
                                  <div className="mt-2">
                                    <span className="inline-block bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-xs">
                                      {categoryName}
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            </TableCell>

                            <TableCell
                              className="truncate max-w-[180px] align-top"
                              title={clientName || clientEmail}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium truncate">
                                  {clientName || "-"}
                                </span>
                                {clientEmail ? (
                                  <span className="text-muted-foreground text-sm truncate">
                                    {clientEmail}
                                  </span>
                                ) : null}
                              </div>
                            </TableCell>

                            <TableCell className="whitespace-nowrap align-top">
                              {priorityBadge(priority)}
                            </TableCell>

                            <TableCell
                              className="whitespace-nowrap align-top"
                              title={t.dueDate || ""}
                            >
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span
                                    className={`${isOverdue
                                      ? "text-red-600 font-semibold"
                                      : "text-foreground"
                                      }`}
                                  >
                                    {formatDateDMY(t.dueDate)}
                                  </span>
                                </div>
                                {isOverdue ? (
                                  <div className="mt-2">
                                    <span className="inline-block bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
                                      Overdue
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            </TableCell>

                            <TableCell className="whitespace-nowrap align-top">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="text-foreground">
                                  {t.lastCompletedDate ? formatDateDMY(t.lastCompletedDate) : "—"}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell
                              className="truncate max-w-[160px] align-top"
                              title={statusLabel}
                            >
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">
                                    {statusLabel}
                                  </span>
                                </div>
                                <Progress
                                  value={
                                    statusLabel === "Completed"
                                      ? 100
                                      : statusLabel === "In Progress"
                                        ? 50
                                        : 0
                                  }
                                  className="h-1"
                                />
                              </div>
                            </TableCell>

                            <TableCell className="text-right align-top">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                  >
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuItem asChild>
                                    <Link href={`/task/${t.id}`}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      View Details
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild>
                                    <Link href={`/task/${t.id}/edit`}>
                                      <Edit className="mr-2 h-4 w-4" />
                                      Edit Task
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

              {/* Mobile list */}
              <div className="md:hidden px-4 pb-4 space-y-3">
                {tasks.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    No tasks found.
                  </div>
                ) : (
                  tasks.map((t) => {
                    const clientName = t.client
                      ? t.client.name ||
                      (t.client.clientType === "individual"
                        ? `${t.client.firstName ?? ""} ${t.client.lastName ?? ""
                          }`.trim()
                        : t.client.organizationName ?? "")
                      : "-";
                    const shortId = `T-${t.id.slice(0, 6).toUpperCase()}`;
                    return (
                      <div
                        key={t.id}
                        className="rounded-md border bg-white p-3 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/task/${t.id}`}
                              className="text-foreground font-medium hover:underline truncate block"
                            >
                              {t.title || shortId}
                            </Link>
                            <div className="text-sm text-muted-foreground mt-1">
                              {clientName}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                className="h-8 w-8 p-0 flex-shrink-0"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem asChild>
                                <Link href={`/task/${t.id}`}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/task/${t.id}/edit`}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Task
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDateDMY(t.dueDate)}
                          </div>
                          <div className="text-right">
                            {statusKey(t.status) === "completed"
                              ? "Completed"
                              : statusKey(t.status) === "inprogress"
                                ? "In Progress"
                                : "To Do"}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end">
        <Link
          href={(() => {
            const p = new URLSearchParams();
            p.set("assignedToId", agentId);
            if (!trigger) p.set("status", sectionLabelToStatus(label));
            if (retainershipTasks) p.set("retainershipTasks", "true");
            if (trigger) p.set("trigger", "true");
            return `/task?${p.toString()}`;
          })()}
          className="bg-[#002fff] cursor-pointer text-white text-[14px] py-[10px] mt-[10px] px-[10px] rounded-[5px] inline-block"
        >
          View more
        </Link>
      </div>
    </>
  );
}

export default function AgentDetails() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = String(params.id ?? "");
  const [agent, setAgent] = useState<Agent | null>(null);
  const [agentTasks, setAgentTasks] = useState<Task[]>([]);
  const [agentRetainershipTasks, setAgentRetainershipTasks] = useState<Task[]>([]);
  const [agentTriggerTasks, setAgentTriggerTasks] = useState<Task[]>([]);
  const [agentLeads, setAgentLeads] = useState<Prospect[]>([]);
  const [agentOpportunities, setAgentOpportunities] = useState<OpportunityRecord[]>([]);
  const [teamMembers, setTeamMembers] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<string>(searchParams.get("tab") || "details");
  const [taskOverviewTab, setTaskOverviewTab] = useState("standard-tasks");

  // Keep activeTab in sync with the tab query param
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams, activeTab]);

  useEffect(() => {
    if (!id) return;
    const fetchTeamMemberDetails = async () => {
      try {
        const response = await fetch(`/api/team/${id}`);
        if (response.ok) {
          const data = await response.json();
          setAgent(data);

          const tabParam = searchParams.get("tab");
          if (!tabParam) {
            setActiveTab(getDefaultTabForAgent(data));
          }

          setTeamMembers(mergeTeamMembers(data));

          const requests: Promise<void>[] = [];

          if (hasExecutionRole(data.agentRole)) {
            requests.push(
              (async () => {
                try {
                  const tasksResponse = await fetch(`/api/tasks?assignedToId=${id}`);
                  if (tasksResponse.ok) {
                    const tasksData = await tasksResponse.json();
                    setAgentTasks(parseTaskResponse(tasksData));
                  } else {
                    setAgentTasks([]);
                  }
                } catch (error) {
                  console.error("Error fetching team member tasks:", error);
                  setAgentTasks([]);
                }
              })(),
            );

            requests.push(
              (async () => {
                try {
                  const retainershipTasksResponse = await fetch(
                    `/api/tasks?assignedToId=${id}&retainershipTasks=true`,
                  );
                  if (retainershipTasksResponse.ok) {
                    const retainershipTasksData =
                      await retainershipTasksResponse.json();
                    setAgentRetainershipTasks(
                      parseTaskResponse(retainershipTasksData),
                    );
                  } else {
                    setAgentRetainershipTasks([]);
                  }
                } catch (error) {
                  console.error(
                    "Error fetching team member retainership tasks:",
                    error,
                  );
                  setAgentRetainershipTasks([]);
                }
              })(),
            );

            requests.push(
              (async () => {
                try {
                  const [triggerResponse, completedResponse] = await Promise.all([
                    fetch(`/api/tasks?assignedToId=${id}&trigger=true`),
                    fetch(
                      `/api/tasks?assignedToId=${id}&retainershipTasks=true&status=Completed`,
                    ),
                  ]);

                  const pendingTriggerTasks = triggerResponse.ok
                    ? parseTaskResponse(await triggerResponse.json())
                    : [];
                  const completedTriggerTasks = completedResponse.ok
                    ? parseTaskResponse(await completedResponse.json()).filter(
                      (task) => Boolean(task.triggerDate),
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
                  console.error("Error fetching team member trigger tasks:", error);
                  setAgentTriggerTasks([]);
                }
              })(),
            );
          }

          if (hasAdvisorRole(data.agentRole)) {
            requests.push(
              (async () => {
                try {
                  const leadsResponse = await fetch(`/api/prospects?assignedAgentId=${id}`);
                  if (leadsResponse.ok) {
                    const leadsData = await leadsResponse.json();
                    setAgentLeads(leadsData.prospects || []);
                  }
                } catch (error) {
                  console.error("Error fetching team member leads:", error);
                }
              })(),
            );

            requests.push(
              (async () => {
                try {
                  const opportunitiesResponse = await fetch(`/api/opportunities?assignedAgentId=${id}`);
                  if (opportunitiesResponse.ok) {
                    const opportunitiesData = await opportunitiesResponse.json();
                    setAgentOpportunities(opportunitiesData.opportunities || []);
                  }
                } catch (error) {
                  console.error("Error fetching team member opportunities:", error);
                }
              })(),
            );
          }

          if (requests.length > 0) {
            await Promise.all(requests);
          }

          setTasksLoading(false);
        } else {
          notFound();
        }
      } catch (error) {
        console.error("Error fetching team member:", error);
        notFound();
      } finally {
        setLoading(false);
      }
    };

    fetchTeamMemberDetails();
    // Fetch activities
    const fetchAgentActivities = async () => {
      try {
        const response = await fetch(`/api/comments/agent-activities?agentId=${id}`);
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
    fetchAgentActivities();
  }, [id, searchParams]);

  const getAgentTypeBadge = (type: string) => {
    const colors = {
      "Senior Partner": "bg-purple-100 text-purple-800",
      Partner: "bg-blue-100 text-blue-800",
      Associate: "bg-green-100 text-green-800",
      "Junior Associate": "bg-yellow-100 text-yellow-800",
      Paralegal: "bg-orange-100 text-orange-800",
      "Lead Maker": "bg-orange-100 text-orange-800",
      "Client Advisor": "bg-sky-100 text-sky-800",
      "Client Manager": "bg-indigo-100 text-indigo-800",
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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
  const tabCount = 3 + (showExecutionTabs ? 1 : 0) + (showAdvisorTabs ? 2 : 0);

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
          {/* <div className="flex justify-end">
            <Link href={`/agent/${agent?.id}/edit`}>
              <Button className="mt-[20px] md:mt-0 w-fit bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300">
                <Edit className="h-4 w-4" />
                Edit Agent
              </Button>
            </Link>
          </div> */}
        </div>

        {/* Agent Summary Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-6">
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
                              task.status === "Completed" ||
                              task.status === "Done"
                          ).length /
                            agentTasks.length) *
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
            <p className="text-[12px] md:text-[14px]">Agent Details</p>
          </TabsTrigger>
          {showExecutionTabs && (
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <FileText className="h-4 w-4 hidden md:block" />
              <p className="text-[12px] md:text-[14px]">
                Tasks ({agentTasks.length + agentRetainershipTasks.length + agentTriggerTasks.length})
              </p>
            </TabsTrigger>
          )}
          {showAdvisorTabs && (
            <TabsTrigger value="leads" className="flex items-center gap-2">
              <FileText className="h-4 w-4 hidden md:block" />
              <p className="text-[12px] md:text-[14px]">
                Leads ({agentLeads.length})
              </p>
            </TabsTrigger>
          )}
          {showAdvisorTabs && (
            <TabsTrigger value="opportunity" className="flex items-center gap-2">
              <FileText className="h-4 w-4 hidden md:block" />
              <p className="text-[12px] md:text-[14px]">
                Opportunity ({agentOpportunities.length})
              </p>
            </TabsTrigger>
          )}
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4 hidden md:block" />
            <p className="text-[12px] md:text-[14px]">
              Team ({teamMembers.length})
            </p>
          </TabsTrigger>
          <TabsTrigger value="activities" className="flex items-center gap-2">
            <Clock className="h-4 w-4 hidden md:block" />
            <p className="text-[12px] md:text-[14px]">Activities</p>
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

        {showExecutionTabs && (
          <TabsContent value="tasks" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Task Management</h2>
                <p className="text-muted-foreground text-sm">
                  Manage and track standard, retainership, and future-trigger tasks assigned to {agent.name}
                </p>
              </div>
            </div>

            {tasksLoading ? (
              <div className="flex justify-center items-center py-16 text-muted-foreground">
                <Clock className="h-6 w-6 animate-spin mr-2" /> Loading tasks...
              </div>
            ) : (
              <Tabs
                value={taskOverviewTab}
                onValueChange={setTaskOverviewTab}
                className="space-y-6"
              >

                <TabsList className="grid h-auto w-full grid-cols-3">
                  <TabsTrigger value="standard-tasks" className="flex items-center gap-2 px-2 py-3 text-[11px] md:text-sm">
                    <FileText className="h-4 w-4 hidden md:block" />
                    Standard Tasks ({agentTasks.length})
                  </TabsTrigger>
                  <TabsTrigger value="retainership-tasks" className="flex items-center gap-2 px-2 py-3 text-[11px] md:text-sm">
                    <CheckCircle className="h-4 w-4 hidden md:block" />
                    Retainership Tasks ({agentRetainershipTasks.length})
                  </TabsTrigger>
                  <TabsTrigger value="future-triggers" className="flex items-center gap-2 px-2 py-3 text-[11px] md:text-sm">
                    <Clock className="h-4 w-4 hidden md:block" />
                    Future Triggers ({agentTriggerTasks.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="standard-tasks" className="space-y-6">
                  {agentTasks.length === 0 ? (
                    <Card>
                      <CardContent className="text-center py-8">
                        <p className="text-muted-foreground">
                          No standard tasks assigned to this agent.
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

                <TabsContent value="retainership-tasks" className="space-y-6">
                  {agentRetainershipTasks.length === 0 ? (
                    <Card>
                      <CardContent className="text-center py-8">
                        <p className="text-muted-foreground">
                          No retainership tasks assigned to this agent.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-[40px]">
                      <SectionTable
                        label="New Task"
                        tasks={agentRetainershipTasks.filter((t) => ["todo"].includes(statusKey(t.status))).slice(0, 3)}
                        agentId={id}
                        retainershipTasks={true}
                      />
                      <SectionTable
                        label="In Progress"
                        tasks={agentRetainershipTasks.filter((t) => ["inprogress"].includes(statusKey(t.status))).slice(0, 3)}
                        agentId={id}
                        retainershipTasks={true}
                      />
                      <SectionTable
                        label="Completed"
                        tasks={agentRetainershipTasks.filter((t) => ["completed"].includes(statusKey(t.status))).slice(0, 3)}
                        agentId={id}
                        retainershipTasks={true}
                      />
                      <SectionTable
                        label="Hold"
                        tasks={agentRetainershipTasks.filter((t) => ["hold"].includes(statusKey(t.status))).slice(0, 3)}
                        agentId={id}
                        retainershipTasks={true}
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="future-triggers" className="space-y-6">
                  {agentTriggerTasks.length === 0 ? (
                    <Card>
                      <CardContent className="text-center py-8">
                        <p className="text-muted-foreground">
                          No future-trigger tasks assigned to this agent.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-[40px]">
                      <SectionTable
                        label="Upcoming Tasks"
                        tasks={agentTriggerTasks.slice(0, 3)}
                        agentId={id}
                        trigger={true}
                      />
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </TabsContent>
        )}

        {showAdvisorTabs && (
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
              <Card>
                <CardContent className="p-0">
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Follow Up</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {agentLeads.map((lead) => (
                          <TableRow key={lead.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{lead.name}</div>
                                <div className="text-sm text-muted-foreground">{lead.email || lead.phoneNumber || "-"}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{lead.status}</Badge>
                            </TableCell>
                            <TableCell>{formatDateDMY(lead.nextFollowUp)}</TableCell>
                            <TableCell>{formatDate(lead.createdAt)}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/sales/prospects/${lead.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {showAdvisorTabs && (
          <TabsContent value="opportunity" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Opportunity Management</h2>
                <p className="text-muted-foreground text-sm">
                  Manage and track opportunities assigned to {agent.name}
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
              <Card>
                <CardContent className="p-0">
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Follow Up</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {agentOpportunities.map((opportunity) => (
                          <TableRow key={opportunity.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{opportunity.prospect?.name || "Unknown"}</div>
                                <div className="text-sm text-muted-foreground">{opportunity.prospect?.email || opportunity.prospect?.phoneNumber || "-"}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{opportunity.status}</Badge>
                            </TableCell>
                            <TableCell>{formatDateDMY(opportunity.nextFollowUp)}</TableCell>
                            <TableCell>{formatDate(opportunity.createdAt)}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/sales/opportunites/${opportunity.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                All team members under {agent.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading team members...</p>
                </div>
              ) : teamMembers.length === 0 ? (
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
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Agent Type</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamMembers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">
                                  {member.name
                                    ? member.name.toUpperCase().split(" ").map((n) => n[0]).join("")
                                    : "-"}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium text-sm">
                                  {member.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {member.barAssociationId}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {member.email}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {member.phoneNumber}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getAgentTypeBadge(member.agentType)}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem asChild>
                                  <Link href={`/team/${member.id}?tab=${getDefaultTabForAgent(member)}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
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
        </TabsContent>

        {/* Activities Tab */}
        <TabsContent value="activities" className="space-y-6">
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
                  <p className="text-muted-foreground">No activities found for this agent.</p>
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
                                      <Link href={`/task/${activity.taskId}`} className="text-blue-600 hover:underline break-words whitespace-pre-line block" style={{ wordBreak: 'break-word', whiteSpace: 'pre-line' }}>
                                        {activity.taskTitle}
                                      </Link>
                                    ) : (
                                      <span className="text-muted-foreground">Unknown Task</span>
                                    )}
                                  </TableCell>
                                  <TableCell style={{ wordBreak: 'break-word', whiteSpace: 'pre-line', maxWidth: 320 }}>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
