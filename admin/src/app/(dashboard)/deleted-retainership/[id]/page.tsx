"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTablePage } from "@/hooks/useTablePage";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Gavel,
  ListTodo,
  Trash2,
  User,
} from "lucide-react";

interface DeletedLegislation {
  id: string;
  title: string;
  description?: string | null;
  assignedAgent?: string | null;
  assignedAgentId?: string | null;
  createdAt: string;
  deletedAt?: string | null;
  taskCount: number;
}

interface DeletedTask {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
  createdAt: string;
  deletedAt?: string | null;
  assignedTo?: string | null;
  assignedToId?: string | null;
  legislationId?: string | null;
  legislationTitle?: string | null;
}

interface DeletedRetainershipDetail {
  retainership: {
    id: string;
    name: string;
    description: string;
    color: string;
    status: string;
    createdAt: string;
    deletedAt: string;
    deletedByType?: string | null;
    deletedBy?: string | null;
    createdBy: string;
    createdByType?: string | null;
    client?: { id: string; name: string; email?: string | null } | null;
  };
  legislations: DeletedLegislation[];
  tasks: DeletedTask[];
}

/**
 * Status and priority are free-form strings in the schema, and existing rows
 * use inconsistent casing ("high" alongside "Medium"), so both maps are keyed
 * lowercase and looked up that way. An unmapped value falls back to the plain
 * badge rather than rendering uncolored-but-broken.
 */
const STATUS_COLORS: Record<string, string> = {
  "to do": "bg-gray-100 text-gray-800",
  "in progress": "bg-blue-100 text-blue-800",
  hold: "bg-amber-100 text-amber-800",
  completed: "bg-green-100 text-green-800",
  abandoned: "bg-rose-100 text-rose-800",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-gray-600 border-gray-300",
  medium: "text-amber-700 border-amber-300",
  high: "text-red-700 border-red-300",
};

/**
 * The status tabs, matching the set the main task table offers. Compared
 * lowercase for the same casing reason as the colour maps above. "All" is not
 * in this list — it is rendered separately as the default tab.
 */
const TASK_STATUSES = [
  "To Do",
  "In Progress",
  "Hold",
  "Completed",
  "Abandoned",
] as const;

/** Normalises the mixed casing above for display. */
function titleCase(value?: string | null) {
  if (!value) return "-";
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
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

export default function DeletedRetainershipDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [data, setData] = useState<DeletedRetainershipDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [taskStatus, setTaskStatus] = useState<string>("all");

  const {
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    clampToTotalPages,
  } = useTablePage("admin-deleted-retainership-tasks", 10);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const response = await fetchWithAuth(`/api/deleted-retainerships/${id}`);
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          setError(body.error ?? "Failed to load deleted retainership");
          return;
        }
        setData(await response.json());
      } catch (err) {
        console.error("Error fetching deleted retainership:", err);
        setError("Failed to load deleted retainership");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchDetail();
  }, [id]);

  // Derived above the early returns: the clamp below is a hook, and hooks
  // cannot sit after a conditional return.
  const tasks = data?.tasks ?? [];

  const tasksForStatus =
    taskStatus === "all"
      ? tasks
      : tasks.filter((task) => task.status?.toLowerCase() === taskStatus);

  const totalPages = Math.ceil(tasksForStatus.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTasks = tasksForStatus.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  // Counts drive the tab labels, so they come from the unfiltered list.
  const countByStatus = new Map<string, number>();
  for (const task of tasks) {
    const key = task.status?.toLowerCase() ?? "";
    countByStatus.set(key, (countByStatus.get(key) || 0) + 1);
  }

  useEffect(() => {
    clampToTotalPages(totalPages);
  }, [totalPages, clampToTotalPages]);

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number.parseInt(value));
    setCurrentPage(1);
  };

  // Switching status tab restarts paging, otherwise a page 3 carried over to a
  // shorter list lands on an empty table until the clamp catches up.
  const handleTaskStatusChange = (value: string) => {
    setTaskStatus(value);
    setCurrentPage(1);
  };

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
          <Link href="/retainership">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Retainerships
          </Link>
        </Button>
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4" />
          {error ?? "This deleted retainership could not be found."}
        </div>
      </section>
    );
  }

  const { retainership, legislations } = data;

  return (
    <section className="container mx-auto p-6 max-w-7xl space-y-8 overflow-x-hidden min-w-0">
      {/* Header */}
      <div>
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4 gap-4">
          <div>
            <h1 className="text-[28px] md:text-3xl font-bold">
              Deleted Retainership
            </h1>
            <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
              Legislation and tasks hidden when this retainership was deleted
            </p>
          </div>
          <Button asChild variant="outline" className="w-fit">
            <Link href="/retainership">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Retainerships
            </Link>
          </Button>
        </div>

        {/* Retainership Summary Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-semibold">
                    {retainership.name}
                  </h2>
                  <Badge variant="destructive" className="gap-1">
                    <Trash2 className="h-3 w-3" />
                    Deleted
                  </Badge>
                </div>
                {retainership.description && (
                  <p className="text-sm text-muted-foreground max-w-2xl">
                    {retainership.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pt-1">
                  <span className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    Created by {retainership.createdBy}
                  </span>
                  {retainership.client && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      {retainership.client.name}
                    </span>
                  )}
                  <span>Created {formatDate(retainership.createdAt)}</span>
                </div>
              </div>

              <div className="text-sm space-y-1 md:text-right">
                <div className="text-muted-foreground">
                  Deleted {formatDateTime(retainership.deletedAt)}
                </div>
                {retainership.deletedBy && (
                  <div className="text-muted-foreground">
                    by {retainership.deletedBy}
                    {retainership.deletedByType === "AGENT" && " (Agent)"}
                  </div>
                )}
                <div className="text-xs text-muted-foreground pt-1">
                  Status at deletion: {retainership.status}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="legislation" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="legislation" className="flex items-center gap-2">
            <Gavel className="h-4 w-4" />
            Legislation ({legislations.length})
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            Tasks ({tasks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="legislation">
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
                  No legislation was hidden with this retainership.
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">
                          Title
                        </TableHead>
                        <TableHead className="text-xs sm:text-sm">
                          Assigned Agent
                        </TableHead>
                        <TableHead className="text-xs sm:text-sm">
                          Tasks
                        </TableHead>
                        <TableHead className="text-xs sm:text-sm">
                          Created
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {legislations.map((legislation) => (
                        <TableRow key={legislation.id}>
                          <TableCell>
                            <div className="font-medium text-sm">
                              {legislation.title}
                            </div>
                            {legislation.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-md">
                                {legislation.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {legislation.assignedAgent ?? "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {legislation.taskCount}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(legislation.createdAt)}
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

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListTodo className="h-5 w-5" />
                Tasks ({tasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tasks were hidden with this retainership.
                </div>
              ) : (
                <Tabs
                  value={taskStatus}
                  onValueChange={handleTaskStatusChange}
                  className="space-y-4"
                >
                  <TabsList className="flex w-full flex-wrap h-auto justify-start gap-1">
                    <TabsTrigger value="all" className="text-xs">
                      All ({tasks.length})
                    </TabsTrigger>
                    {TASK_STATUSES.map((status) => (
                      <TabsTrigger
                        key={status}
                        value={status.toLowerCase()}
                        className="text-xs"
                      >
                        {status} ({countByStatus.get(status.toLowerCase()) ?? 0})
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  <TabsContent value={taskStatus} className="mt-0 space-y-4">
                    {tasksForStatus.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No tasks with this status.
                      </div>
                    ) : (
                      <>
                        <div className="rounded-md border">
                          <Table className="table-fixed w-full">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[30%] text-xs">
                                  Title
                                </TableHead>
                                <TableHead className="w-[13%] text-xs">
                                  Status
                                </TableHead>
                                <TableHead className="w-[11%] text-xs">
                                  Priority
                                </TableHead>
                                <TableHead className="w-[16%] text-xs">
                                  Agent
                                </TableHead>
                                <TableHead className="w-[20%] text-xs">
                                  Legislation
                                </TableHead>
                                <TableHead className="w-[10%] text-xs">
                                  Due
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {paginatedTasks.map((task) => (
                                <TableRow
                                  key={task.id}
                                  onClick={() => router.push(`/task/${task.id}`)}
                                  className="cursor-pointer hover:bg-muted/50"
                                >
                                  <TableCell className="align-top">
                                    <div
                                      className="font-medium text-sm truncate"
                                      title={task.title}
                                    >
                                      {task.title}
                                    </div>
                                    {task.description && (
                                      <div className="text-xs text-muted-foreground truncate">
                                        {task.description}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="align-top">
                                    <Badge
                                      variant="secondary"
                                      className={`text-xs whitespace-nowrap ${
                                        STATUS_COLORS[
                                          task.status?.toLowerCase()
                                        ] ?? ""
                                      }`}
                                    >
                                      {task.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="align-top">
                                    <Badge
                                      variant="outline"
                                      className={`text-xs whitespace-nowrap ${
                                        PRIORITY_COLORS[
                                          task.priority?.toLowerCase()
                                        ] ?? ""
                                      }`}
                                    >
                                      {titleCase(task.priority)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="align-top text-sm truncate">
                                    {task.assignedTo ?? "-"}
                                  </TableCell>
                                  <TableCell
                                    className="align-top text-sm truncate"
                                    title={task.legislationTitle ?? undefined}
                                  >
                                    {/* Tasks linked straight to the retainership
                                        have no legislation of their own. */}
                                    {task.legislationTitle ?? (
                                      <span className="text-muted-foreground">
                                        Direct
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="align-top text-sm whitespace-nowrap">
                                    {formatDate(task.dueDate)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {totalPages > 1 && (
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t">
                            <div className="text-xs sm:text-sm text-muted-foreground">
                              Page {currentPage} of {totalPages}
                            </div>
                            <div className="flex items-center flex-wrap gap-2">
                              <Select
                                value={itemsPerPage.toString()}
                                onValueChange={handleItemsPerPageChange}
                              >
                                <SelectTrigger className="w-24 text-xs sm:text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[5, 10, 20, 50].map((value) => (
                                    <SelectItem
                                      key={value}
                                      value={value.toString()}
                                      className="text-xs sm:text-sm"
                                    >
                                      {value} / page
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="text-xs"
                              >
                                <ChevronsLeft className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="text-xs"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </Button>

                              <div className="hidden sm:flex items-center gap-1">
                                {Array.from(
                                  { length: Math.min(5, totalPages) },
                                  (_, i) => {
                                    const pageNumber =
                                      Math.max(
                                        1,
                                        Math.min(totalPages - 4, currentPage - 2)
                                      ) + i;
                                    if (pageNumber > totalPages) return null;
                                    return (
                                      <Button
                                        key={pageNumber}
                                        variant={
                                          currentPage === pageNumber
                                            ? "default"
                                            : "outline"
                                        }
                                        size="sm"
                                        onClick={() => setCurrentPage(pageNumber)}
                                        className="text-xs"
                                      >
                                        {pageNumber}
                                      </Button>
                                    );
                                  }
                                )}
                              </div>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="text-xs"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                className="text-xs"
                              >
                                <ChevronsRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </section>
  );
}
