"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  FileText,
  Gavel,
  Loader2,
  Mail,
  Phone,
  Trash2,
  User,
} from "lucide-react";

interface DeletedTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  category?: { id: string; name: string } | null;
  assignedTo?: { id: string; name: string } | null;
  ownerShipBy?: { id: string; name: string } | null;
  retainership?: { id: string; name: string } | null;
}

interface DeletedRetainership {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  createdAt: string;
}

interface DeletedLegislation {
  id: string;
  title: string;
  description?: string | null;
  retainershipId: string;
}

interface DeletedClientDetail {
  client: {
    id: string;
    clientType: string;
    email: string;
    phoneNumber: string;
    address?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    organizationName?: string | null;
    authorizedPersonName?: string | null;
    name: string;
    deletedAt: string;
    deletedByType?: string | null;
    notes?: string | null;
  };
  standardTasks: DeletedTask[];
  retainershipTasks: DeletedTask[];
  retainerships: DeletedRetainership[];
  legislations: DeletedLegislation[];
}

function formatDate(dateString?: string | null) {
  if (!dateString) return "-";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(dateString?: string | null) {
  if (!dateString) return "-";
  const d = new Date(dateString);
  return isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

const statusKey = (status: string) =>
  status.toLowerCase().replace(/[\s_-]/g, "");

/** Same pill styling the live task tables use. */
function priorityBadge(priority: string) {
  const p = (priority || "").toLowerCase();
  if (!p) return <span className="text-muted-foreground">-</span>;
  if (p.includes("high"))
    return (
      <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs">
        <span className="text-[10px]">❗</span> High
      </span>
    );
  if (p.includes("medium"))
    return (
      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs">
        <span className="text-[10px]">⚠️</span> Medium
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
      Low
    </span>
  );
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

/**
 * Task table for deleted work. Uses the platform's fixed-column layout so every
 * column fits the viewport instead of scrolling sideways. Rows link to the real
 * task page, which loads deleted tasks read-only via ?includeDeleted=true.
 */
function DeletedTaskTable({
  tasks,
  showRetainership,
  emptyLabel,
}: {
  tasks: DeletedTask[];
  showRetainership: boolean;
  emptyLabel: string;
}) {
  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-muted-foreground">
          {emptyLabel}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="py-0 gap-0 rounded-md shadow-sm">
      <CardContent className="p-0">
        {/* Desktop: fixed columns, no horizontal scroll */}
        <div className="rounded-md overflow-hidden hidden md:block bg-white shadow-sm">
          <Table className="w-full table-fixed text-sm [&_th]:py-3 [&_th]:h-12 [&_td]:py-3">
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[18%]" />
              <col className="w-[12%]" />
              {showRetainership && <col className="w-[16%]" />}
              <col className="w-[14%]" />
              <col className={showRetainership ? "w-[9%]" : "w-[25%]"} />
              <col className="w-[5%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Priority</TableHead>
                {showRetainership && <TableHead>Retainership</TableHead>}
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t) => {
                const ownerName = t.assignedTo?.name ?? "-";
                const shortId = `T-${t.id.slice(0, 6).toUpperCase()}`;
                const isOverdue = t.dueDate
                  ? new Date(t.dueDate) < new Date() &&
                    statusKey(t.status) !== "completed"
                  : false;

                return (
                  <TableRow key={t.id} className="hover:bg-muted/50 even:bg-muted/30">
                    <TableCell className="align-top" title={t.title || shortId}>
                      <div className="flex flex-col min-w-0">
                        <Link
                          href={`/task/${t.id}`}
                          className="text-foreground font-medium hover:underline truncate"
                        >
                          {t.title || shortId}
                        </Link>
                        {t.category?.name ? (
                          <div className="mt-2">
                            <span className="inline-block bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-xs truncate max-w-full">
                              {t.category.name}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarFallback className="text-[10px]">
                            {(ownerName || "?")
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium truncate" title={ownerName}>
                          {ownerName}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      {priorityBadge(t.priority)}
                    </TableCell>

                    {showRetainership && (
                      <TableCell className="align-top">
                        <span
                          className="truncate block"
                          title={t.retainership?.name ?? "-"}
                        >
                          {t.retainership?.name ?? "-"}
                        </span>
                      </TableCell>
                    )}

                    <TableCell className="align-top" title={t.dueDate ?? ""}>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span
                            className={`truncate ${isOverdue ? "text-red-600 font-semibold" : "text-foreground"}`}
                          >
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
                      <Badge className="bg-gray-200 text-black truncate max-w-full">
                        {t.status}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right align-top">
                      <Link
                        href={`/task/${t.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                        aria-label="View task details"
                      >
                        <Eye className="h-5 w-5" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Mobile: cards, same as the live task screens */}
        <div className="md:hidden px-4 py-4 space-y-3">
          {tasks.map((t) => {
            const shortId = `T-${t.id.slice(0, 6).toUpperCase()}`;
            return (
              <div key={t.id} className="rounded-md border bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col min-w-0">
                    <Link
                      href={`/task/${t.id}`}
                      className="font-medium text-[#1f7aff] truncate"
                    >
                      {t.title || shortId}
                    </Link>
                    <span className="text-xs text-muted-foreground truncate">
                      {t.assignedTo?.name ?? "-"}
                    </span>
                  </div>
                  <Badge className="bg-gray-200 text-black shrink-0">{t.status}</Badge>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>Due {formatDate(t.dueDate)}</span>
                  {priorityBadge(t.priority)}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DeletedClientDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<DeletedClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskTab, setTaskTab] = useState("standard");

  useEffect(() => {
    if (!id) return;

    const fetchDetail = async () => {
      setLoading(true);
      try {
        const response = await fetchWithAuth(`/api/deleted-clients/${id}`);
        if (response.ok) {
          setData(await response.json());
        } else {
          setError("This deleted client could not be found.");
        }
      } catch (fetchError) {
        console.error("Error fetching deleted client:", fetchError);
        setError("Failed to load this deleted client.");
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [id]);

  if (loading) {
    return (
      <section className="container mx-auto p-6 max-w-7xl space-y-8">
        <div className="h-[120px] w-full bg-gray-200 rounded-2xl" />
        <div className="h-[200px] w-full bg-gray-200 rounded-2xl" />
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="container mx-auto p-6 max-w-7xl space-y-4">
        <Button asChild variant="outline" className="w-fit">
          <Link href="/deleted-client">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Deleted Clients
          </Link>
        </Button>
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4" />
          {error ?? "This deleted client could not be found."}
        </div>
      </section>
    );
  }

  const { client, standardTasks, retainershipTasks, retainerships, legislations } = data;

  const allTasks = [...standardTasks, ...retainershipTasks];
  const total = allTasks.length;
  const completed = allTasks.filter((t) => statusKey(t.status) === "completed").length;
  const inprogress = allTasks.filter((t) => statusKey(t.status) === "inprogress").length;
  const todo = allTasks.filter((t) => statusKey(t.status) === "todo").length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  const overdueTasks = allTasks.filter(
    (task) =>
      task.dueDate &&
      new Date(task.dueDate) < new Date() &&
      statusKey(task.status) !== "completed",
  );

  const getClientDisplayName = () => client.name;

  const getClientInitials = () =>
    `${client.firstName?.[0] ?? ""}${client.lastName?.[0] ?? ""}`.toUpperCase() || "C";

  const legislationsByRetainership = legislations.reduce<
    Record<string, DeletedLegislation[]>
  >((accumulator, legislation) => {
    (accumulator[legislation.retainershipId] ||= []).push(legislation);
    return accumulator;
  }, {});

  return (
    <section className="container mx-auto p-6 max-w-7xl space-y-8 overflow-x-hidden min-w-0">
      {/* Header */}
      <div>
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4 gap-4">
          <div>
            <h1 className="text-[28px] md:text-3xl font-bold">Deleted Client</h1>
            <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
              Tasks and retainerships hidden when this client was deleted
            </p>
          </div>
          <Button asChild variant="outline" className="w-fit">
            <Link href="/deleted-client">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Deleted Clients
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
                    {client.clientType === "organization" ? (
                      <Building2 className="h-8 w-8" />
                    ) : (
                      getClientInitials()
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center flex-wrap gap-3 mb-2">
                    <h2 className="text-2xl font-bold">{getClientDisplayName()}</h2>
                    <Badge
                      className={
                        client.clientType === "organization"
                          ? "bg-violet-100 text-violet-800 border-violet-200 border"
                          : "bg-blue-100 text-blue-800 border-blue-200 border"
                      }
                    >
                      {client.clientType === "organization" ? (
                        <Building2 className="w-3 h-3 mr-1" />
                      ) : (
                        <User className="w-3 h-3 mr-1" />
                      )}
                      {client.clientType === "organization" ? "Organization" : "Individual"}
                    </Badge>
                    <Badge className="bg-rose-100 text-rose-800 border-rose-200 border">
                      <Trash2 className="w-3 h-3 mr-1" />
                      Deleted
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>{client.email || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{client.phoneNumber || "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Trash2 className="h-4 w-4" />
                      <span>
                        Deleted {formatDateTime(client.deletedAt)}
                        {client.deletedByType ? ` by ${client.deletedByType}` : ""}
                      </span>
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
                    <div className="text-2xl font-bold text-violet-600">
                      {retainerships.length}
                    </div>
                    <div className="text-xs text-muted-foreground">Retainerships</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
              Standard Tasks ({standardTasks.length})
            </TabsTrigger>
            <TabsTrigger value="retainership" className="flex items-center gap-1 px-2 py-3 text-[10px] lg:text-sm whitespace-nowrap">
              <CheckCircle className="h-4 w-4 hidden lg:block flex-shrink-0" />
              Retainership Tasks ({retainershipTasks.length})
            </TabsTrigger>
            <TabsTrigger value="retainerships" className="flex items-center gap-1 px-2 py-3 text-[10px] lg:text-sm whitespace-nowrap">
              <ClipboardList className="h-4 w-4 hidden lg:block flex-shrink-0" />
              Retainerships ({retainerships.length})
            </TabsTrigger>
            <TabsTrigger value="legislation" className="flex items-center gap-1 px-2 py-3 text-[10px] lg:text-sm whitespace-nowrap">
              <Gavel className="h-4 w-4 hidden lg:block flex-shrink-0" />
              Legislation ({legislations.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="standard" className="space-y-6">
          <DeletedTaskTable
            tasks={standardTasks}
            showRetainership={false}
            emptyLabel="No standard tasks were hidden with this client."
          />
        </TabsContent>

        <TabsContent value="retainership" className="space-y-6">
          <DeletedTaskTable
            tasks={retainershipTasks}
            showRetainership
            emptyLabel="No retainership tasks were hidden with this client."
          />
        </TabsContent>

        <TabsContent value="retainerships" className="space-y-6">
          {retainerships.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8 text-muted-foreground">
                No retainerships were hidden with this client.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-3 sm:p-6">
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Retainership</TableHead>
                        <TableHead className="text-xs sm:text-sm">Status</TableHead>
                        <TableHead className="text-xs sm:text-sm">Legislations</TableHead>
                        <TableHead className="text-xs sm:text-sm">Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {retainerships.map((retainership) => (
                        <TableRow key={retainership.id}>
                          <TableCell>
                            <div className="font-medium text-sm">{retainership.name}</div>
                            {retainership.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-md">
                                {retainership.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-gray-200 text-black">
                              {retainership.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {legislationsByRetainership[retainership.id]?.length ?? 0}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(retainership.createdAt)}
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

        <TabsContent value="legislation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gavel className="h-5 w-5" />
                Legislation ({legislations.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              {legislations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No legislation was hidden with this client.
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Title</TableHead>
                        <TableHead className="text-xs sm:text-sm">Retainership</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {legislations.map((legislation) => (
                        <TableRow key={legislation.id}>
                          <TableCell>
                            <div className="font-medium text-sm">{legislation.title}</div>
                            {legislation.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-md">
                                {legislation.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {retainerships.find((r) => r.id === legislation.retainershipId)
                              ?.name ?? "-"}
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
      </Tabs>
    </section>
  );
}
