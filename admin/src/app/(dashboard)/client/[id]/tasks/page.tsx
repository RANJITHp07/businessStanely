"use client"

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  User,
  FileText,
  Clock,
  CheckCircle,
  CheckCircle2,
  ClipboardList,
  AlertTriangle,
  Eye,
  Calendar,
  Gavel,
  Loader2,
} from "lucide-react";

import { Task, Client } from "@/types";

interface ClientLegislation {
  id: string;
  title: string;
  description?: string;
  assignedAgent?: {
    id: string;
    name: string;
    email: string;
  };
  tasks?: Task[];
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

function parseTaskResponse(data: Task[] | { tasks?: Task[] }) {
  return Array.isArray(data) ? data : data.tasks || [];
}

function getClientDisplayName(client: Client | null) {
  if (!client) return "Client";
  if (client.clientType === "individual") {
    return `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() || "Client";
  }
  return client.organizationName || "Client";
}

function getClientInitials(client: Client | null) {
  if (!client) return "NA";
  if (client.clientType === "organization") {
    return (client.organizationName || "NA")
      .toUpperCase()
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2);
  }
  return `${client.firstName?.[0] || ""}${client.lastName?.[0] || ""}`.toUpperCase() || "NA";
}

function formatDate(dateString?: string) {
  if (!dateString) return "-";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

type StatVariant = "total" | "completed" | "inprogress" | "pending" | "overdue";

const STAT_STYLES: Record<
  StatVariant,
  {
    bar: string;
    iconWrap: string;
    value: string;
    title: string;
    light: string;
    indicator: string;
  }
> = {
  total: {
    bar: "bg-blue-500",
    iconWrap: "text-blue-700 bg-blue-100",
    value: "text-blue-800",
    title: "text-blue-800",
    light: "bg-blue-50",
    indicator: "[&_[data-slot=progress-indicator]]:bg-blue-500",
  },
  completed: {
    bar: "bg-green-500",
    iconWrap: "text-green-700 bg-green-100",
    value: "text-green-800",
    title: "text-green-800",
    light: "bg-green-50",
    indicator: "[&_[data-slot=progress-indicator]]:bg-green-500",
  },
  inprogress: {
    bar: "bg-sky-500",
    iconWrap: "text-sky-700 bg-sky-100",
    value: "text-sky-800",
    title: "text-sky-800",
    light: "bg-sky-50",
    indicator: "[&_[data-slot=progress-indicator]]:bg-sky-500",
  },
  pending: {
    bar: "bg-amber-500",
    iconWrap: "text-amber-700 bg-amber-100",
    value: "text-amber-800",
    title: "text-amber-800",
    light: "bg-amber-50",
    indicator: "[&_[data-slot=progress-indicator]]:bg-amber-500",
  },
  overdue: {
    bar: "bg-rose-500",
    iconWrap: "text-rose-700 bg-rose-100",
    value: "text-rose-800",
    title: "text-rose-800",
    light: "bg-rose-50",
    indicator: "[&_[data-slot=progress-indicator]]:bg-rose-500",
  },
};

function StatCard({
  title,
  value,
  percent,
  Icon,
  variant,
}: {
  title: string;
  value: number;
  percent: number;
  Icon: typeof ClipboardList;
  variant: StatVariant;
}) {
  const s = STAT_STYLES[variant];
  return (
    <Card className="relative overflow-hidden border border-border">
      <span className={`absolute inset-x-0 top-0 h-1 ${s.bar}`} />
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className={`text-sm font-semibold ${s.title}`}>{title}</CardTitle>
          <div className={`rounded-full p-2 ${s.iconWrap}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline justify-between">
          <div className={`text-4xl leading-none font-bold ${s.value}`}>{value}</div>
          <div className="text-xs font-medium text-muted-foreground">{percent}%</div>
        </div>
        <Progress value={percent} className={`${s.light} ${s.indicator}`} />
      </CardContent>
    </Card>
  );
}

function SectionTable({
  label,
  tasks,
  viewMoreHref,
}: {
  label: string;
  tasks: Task[];
  viewMoreHref: string;
}) {
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
              <div
                className={`md:hidden flex items-center justify-center px-4 py-4 rounded-lg shadow-sm border border-gray-100 font-semibold ${labelColor} text-2xl tracking-widest`}
              >
                {label}
              </div>

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
                      <TableHead className="text-white">Assigned To</TableHead>
                      <TableHead className="text-white">Priority</TableHead>
                      <TableHead className="text-white">Due Date</TableHead>
                      <TableHead className="text-white">Progress</TableHead>
                      <TableHead className="text-right text-white">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                          No tasks found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      tasks.map((t) => {
                        const ownerName = t.assignedTo?.name ?? "-";
                        const shortId = `T-${t.id.slice(0, 6).toUpperCase()}`;
                        const categoryName = t.category?.name;
                        const assignedRole = t.assignedTo?.agentType ?? "";
                        const priority = (t.priority || "").toLowerCase();
                        const isOverdue = t.dueDate
                          ? new Date(t.dueDate) < new Date() && statusKey(t.status) !== "completed"
                          : false;

                        const priorityBadge = (p: string) => {
                          if (!p) return <span className="text-muted-foreground">-</span>;
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
                          <TableRow key={t.id} className="hover:bg-muted/50 even:bg-muted/30">
                            <TableCell className="truncate max-w-[260px] align-top" title={t.title || shortId}>
                              <div className="flex flex-col">
                                <Link
                                  href={`/task/${t.id}`}
                                  className="text-foreground font-medium hover:underline truncate"
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

                            <TableCell className="truncate max-w-[200px] align-top">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8 flex-shrink-0">
                                  <AvatarFallback className="text-[10px]">
                                    {(ownerName || "?")
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-medium truncate" title={ownerName}>
                                    {ownerName}
                                  </span>
                                  {assignedRole ? (
                                    <span className="text-xs text-muted-foreground truncate">{assignedRole}</span>
                                  ) : null}
                                </div>
                              </div>
                            </TableCell>

                            <TableCell className="whitespace-nowrap align-top">{priorityBadge(priority)}</TableCell>

                            <TableCell className="whitespace-nowrap align-top" title={t.dueDate || ""}>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span className={isOverdue ? "text-red-600 font-semibold" : "text-foreground"}>
                                    {formatDate(t.dueDate)}
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

                            <TableCell className="align-top">
                              <span className="text-sm font-medium">{t.progress ?? 0}%</span>
                            </TableCell>

                            <TableCell className="text-right align-top">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Link
                                    href={`/task/${t.id}`}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                                    aria-label="View task details"
                                  >
                                    <Eye className="h-5 w-5" />
                                  </Link>
                                </TooltipTrigger>
                                <TooltipContent sideOffset={6}>View task details</TooltipContent>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden px-4 pb-4 space-y-3">
                {tasks.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">No tasks found.</div>
                ) : (
                  tasks.map((t) => {
                    const ownerName = t.assignedTo?.name ?? "-";
                    const shortId = `T-${t.id.slice(0, 6).toUpperCase()}`;
                    return (
                      <div key={t.id} className="rounded-md border bg-white p-3 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex flex-col">
                            <Link href={`/task/${t.id}`} className="font-medium text-[#1f7aff]">
                              {shortId}
                            </Link>
                            <span className="text-xs text-muted-foreground">{t.title || "-"}</span>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link
                                href={`/task/${t.id}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                                aria-label="View task details"
                              >
                                <Eye className="h-4 w-4" />
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent sideOffset={6}>View task details</TooltipContent>
                          </Tooltip>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                          <div>
                            <div className="font-medium text-foreground">Assigned To</div>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[9px]">
                                  {(ownerName || "-")
                                    .toUpperCase()
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("") || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate max-w-[120px]" title={ownerName}>
                                {ownerName}
                              </span>
                            </div>
                          </div>
                          <div>
                            <div className="font-medium text-foreground">Priority</div>
                            <div className="truncate max-w-[160px]">{t.priority || "-"}</div>
                          </div>
                          <div>
                            <div className="font-medium text-foreground">Due Date</div>
                            <div>{formatDate(t.dueDate)}</div>
                          </div>
                          <div>
                            <div className="font-medium text-foreground">Progress</div>
                            <div>{t.progress ?? 0}%</div>
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
          href={viewMoreHref}
          className="bg-[#003459] cursor-pointer text-white text-[14px] py-[10px] mt-[10px] px-[10px] rounded-[5px] inline-block"
        >
          View more
        </Link>
      </div>
    </>
  );
}

function TaskSections({
  tasks,
  taskListHref,
}: {
  tasks: Task[];
  taskListHref: (status: string) => string;
}) {
  const tasksNew = tasks.filter((t) => statusKey(t.status) === "todo");
  const tasksInProgress = tasks.filter((t) => statusKey(t.status) === "inprogress");
  const tasksCompleted = tasks.filter((t) => statusKey(t.status) === "completed");
  const tasksHold = tasks.filter((t) => statusKey(t.status) === "hold");

  return (
    <div className="space-y-[40px]">
      <SectionTable label="New Task" tasks={tasksNew.slice(0, 3)} viewMoreHref={taskListHref("New Task")} />
      <SectionTable
        label="In Progress"
        tasks={tasksInProgress.slice(0, 3)}
        viewMoreHref={taskListHref("In Progress")}
      />
      <SectionTable
        label="Completed"
        tasks={tasksCompleted.slice(0, 3)}
        viewMoreHref={taskListHref("Completed")}
      />
      <SectionTable label="Hold" tasks={tasksHold.slice(0, 3)} viewMoreHref={taskListHref("Hold")} />
    </div>
  );
}

export default function ClientTasksPage() {
  const params = useParams();
  const id = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [retainershipTasks, setRetainershipTasks] = useState<Task[]>([]);
  const [triggerTasks, setTriggerTasks] = useState<Task[]>([]);
  const [legislations, setLegislations] = useState<ClientLegislation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskTab, setTaskTab] = useState("standard");

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      const results = await Promise.allSettled([
        fetchWithAuth(`/api/clients/${id}`),
        fetchWithAuth(`/api/tasks?clientId=${id}`),
        fetchWithAuth(`/api/tasks?clientId=${id}&retainershipTasks=true`),
        fetchWithAuth(`/api/tasks?clientId=${id}&trigger=true`),
        fetchWithAuth(`/api/legislation?retainershipClientId=${id}&pageSize=100`),
      ]);
      const [clientResult, tasksResult, retainershipResult, triggerResult, legislationResult] = results;

      if (clientResult.status === "fulfilled" && clientResult.value.ok) {
        setClient(await clientResult.value.json());
      }

      if (tasksResult.status === "fulfilled" && tasksResult.value.ok) {
        setTasks(parseTaskResponse(await tasksResult.value.json()));
      } else if (tasksResult.status === "rejected") {
        console.error("Error fetching client tasks:", tasksResult.reason);
        setError("Failed to load tasks for this client.");
      } else {
        setError("Failed to load tasks for this client.");
      }

      if (retainershipResult.status === "fulfilled" && retainershipResult.value.ok) {
        setRetainershipTasks(parseTaskResponse(await retainershipResult.value.json()));
      } else if (retainershipResult.status === "rejected") {
        console.error("Error fetching retainership tasks:", retainershipResult.reason);
      }

      if (triggerResult.status === "fulfilled" && triggerResult.value.ok) {
        setTriggerTasks(parseTaskResponse(await triggerResult.value.json()));
      } else if (triggerResult.status === "rejected") {
        console.error("Error fetching future-trigger tasks:", triggerResult.reason);
      }

      if (legislationResult.status === "fulfilled" && legislationResult.value.ok) {
        const legislationData = await legislationResult.value.json();
        setLegislations(legislationData.data || []);
      } else if (legislationResult.status === "rejected") {
        console.error("Error fetching legislation:", legislationResult.reason);
      }

      setLoading(false);
    };

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-8">
          <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
            <div>
              <Skeleton className="h-8 w-40 mb-2" />
              <Skeleton className="h-5 w-80" />
            </div>
            <Skeleton className="h-10 w-32 mt-5 md:mt-0" />
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-start justify-between gap-6">
                <div className="flex items-center gap-5">
                  <Skeleton className="h-20 w-20 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-56" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                </div>
                <Skeleton className="h-16 w-40" />
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const completed = tasks.filter((t) => statusKey(t.status) === "completed").length;
  const inprogress = tasks.filter((t) => statusKey(t.status) === "inprogress").length;
  const todo = tasks.filter((t) => statusKey(t.status) === "todo").length;
  const total = tasks.length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  const overdueTasks = tasks.filter(
    (task) => task.dueDate && new Date(task.dueDate) < new Date() && statusKey(task.status) !== "completed",
  );

  return (
    <section className="container mx-auto p-6 max-w-7xl space-y-8 overflow-x-hidden min-w-0">
      {/* Header */}
      <div>
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4 gap-4">
          <div>
            <h1 className="text-[28px] md:text-3xl font-bold">Client Tasks</h1>
            <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
              Comprehensive view of tasks assigned to this client
            </p>
          </div>
          <Button asChild variant="outline" className="w-fit">
            <Link href="/client">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Clients
            </Link>
          </Button>
        </div>

        {/* Client Summary Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start justify-between gap-6">
              <div className="flex items-center gap-5">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="text-lg">
                    {client?.clientType === "organization" ? (
                      <Building2 className="h-8 w-8" />
                    ) : (
                      getClientInitials(client)
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold">{getClientDisplayName(client)}</h2>
                    <Badge
                      className={
                        client?.clientType === "organization"
                          ? "bg-violet-100 text-violet-800 border-violet-200 border"
                          : "bg-blue-100 text-blue-800 border-blue-200 border"
                      }
                    >
                      {client?.clientType === "organization" ? (
                        <Building2 className="w-3 h-3 mr-1" />
                      ) : (
                        <User className="w-3 h-3 mr-1" />
                      )}
                      {client?.clientType === "organization" ? "Organization" : "Individual"}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>{client?.email || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{client?.phoneNumber || "N/A"}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{total}</div>
                    <div className="text-xs text-muted-foreground">Total Tasks</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{pct(completed)}%</div>
                    <div className="text-xs text-muted-foreground">Completion Rate</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        <StatCard title="Total Tasks" value={total} percent={100} Icon={ClipboardList} variant="total" />
        <StatCard title="Completed" value={completed} percent={pct(completed)} Icon={CheckCircle2} variant="completed" />
        <StatCard title="In Progress" value={inprogress} percent={pct(inprogress)} Icon={Loader2} variant="inprogress" />
        <StatCard title="Pending" value={todo} percent={pct(todo)} Icon={Clock} variant="pending" />
        <StatCard title="Overdue" value={overdueTasks.length} percent={pct(overdueTasks.length)} Icon={AlertTriangle} variant="overdue" />
      </div>

      {/* Task Segmentation Tabs */}
      <Tabs value={taskTab} onValueChange={setTaskTab} className="space-y-6">
        <div className="w-full overflow-x-auto">
          <TabsList className="grid h-auto min-w-max w-full grid-cols-4">
            <TabsTrigger value="standard" className="flex items-center gap-1 px-2 py-3 text-[10px] lg:text-sm whitespace-nowrap">
              <FileText className="h-4 w-4 hidden lg:block flex-shrink-0" />
              Standard Tasks ({tasks.length})
            </TabsTrigger>
            <TabsTrigger value="retainership" className="flex items-center gap-1 px-2 py-3 text-[10px] lg:text-sm whitespace-nowrap">
              <CheckCircle className="h-4 w-4 hidden lg:block flex-shrink-0" />
              Retainership Tasks ({retainershipTasks.length})
            </TabsTrigger>
            <TabsTrigger value="triggers" className="flex items-center gap-1 px-2 py-3 text-[10px] lg:text-sm whitespace-nowrap">
              <Clock className="h-4 w-4 hidden lg:block flex-shrink-0" />
              Future Triggers ({triggerTasks.length})
            </TabsTrigger>
            <TabsTrigger value="legislation" className="flex items-center gap-1 px-2 py-3 text-[10px] lg:text-sm whitespace-nowrap">
              <Gavel className="h-4 w-4 hidden lg:block flex-shrink-0" />
              Legislation ({legislations.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="standard" className="space-y-6">
          {tasks.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8 text-muted-foreground">
                No standard tasks found for this client.
              </CardContent>
            </Card>
          ) : (
            <TaskSections
              tasks={tasks}
              taskListHref={(label) =>
                `/task?clientId=${id}&status=${encodeURIComponent(sectionLabelToStatus(label))}`
              }
            />
          )}
        </TabsContent>

        <TabsContent value="retainership" className="space-y-6">
          {retainershipTasks.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8 text-muted-foreground">
                No retainership tasks found for this client.
              </CardContent>
            </Card>
          ) : (
            <TaskSections
              tasks={retainershipTasks}
              taskListHref={(label) =>
                `/task?clientId=${id}&retainershipTasks=true&status=${encodeURIComponent(sectionLabelToStatus(label))}`
              }
            />
          )}
        </TabsContent>

        <TabsContent value="triggers" className="space-y-6">
          {triggerTasks.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8 text-muted-foreground">
                No future-trigger tasks found for this client.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-[40px]">
              <SectionTable
                label="Upcoming Tasks"
                tasks={triggerTasks.slice(0, 3)}
                viewMoreHref={`/task?clientId=${id}&trigger=true`}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="legislation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gavel className="h-5 w-5" />
                Assigned Legislation ({legislations.length})
              </CardTitle>
              <CardDescription>
                Legislation records linked to {getClientDisplayName(client)}&apos;s retainership, including task counts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Legislation</TableHead>
                      <TableHead>Assigned Agent</TableHead>
                      <TableHead>Tasks</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {legislations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                          No legislation linked to this client.
                        </TableCell>
                      </TableRow>
                    ) : (
                      legislations.map((legislation) => {
                        const legislationTasks = legislation.tasks || [];
                        const activeTasks = legislationTasks.filter(
                          (task) => task.active && statusKey(task.status) !== "completed" && statusKey(task.status) !== "hold",
                        );
                        const overdue = activeTasks.filter(
                          (task) => task.dueDate && new Date(task.dueDate) < new Date(),
                        );
                        return (
                          <TableRow key={legislation.id} className="hover:bg-muted/50">
                            <TableCell>
                              <Link href={`/legislation/${legislation.id}`} className="font-medium text-sm hover:underline">
                                {legislation.title}
                              </Link>
                              <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                {legislation.description || "No description"}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{legislation.assignedAgent?.name || "Unassigned"}</TableCell>
                            <TableCell>
                              <div className="grid grid-cols-2 gap-1 max-w-[180px]">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 justify-center">
                                  Total: {legislationTasks.length}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 justify-center">
                                  Active: {activeTasks.length}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 justify-center">
                                  Overdue: {overdue.length}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Link
                                    href={`/legislation/${legislation.id}`}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                                    aria-label="View legislation details"
                                  >
                                    <Eye className="h-5 w-5" />
                                  </Link>
                                </TooltipTrigger>
                                <TooltipContent sideOffset={6}>View legislation details</TooltipContent>
                              </Tooltip>
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
      </Tabs>
    </section>
  );
}
