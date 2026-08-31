"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Loader2, Search } from "lucide-react";

interface ConvertibleTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  assignedTo: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
}

interface ConvertibleLegislation {
  id: string;
  title: string;
  assignedAgentId: string | null;
  assignedAgent: { id: string; name: string } | null;
}

interface ConvertTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  retainershipId: string;
  /** Fired after the server confirms, so the page can refresh its data. */
  onConverted: (result: { convertedCount: number }) => void;
}

const PAGE_SIZE = 25;

/**
 * Bulk conversion of normal tasks into legislation tasks.
 *
 * A task becomes a legislation task by being given a `legislationId`, so the
 * admin picks one legislation on this retainership and ticks the normal tasks
 * to file under it. The pool is the retainership's own client's live tasks that
 * have no legislation yet -- still long enough to need search and paging.
 */
export default function ConvertTasksDialog({
  open,
  onOpenChange,
  retainershipId,
  onConverted,
}: ConvertTasksDialogProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [legislations, setLegislations] = useState<ConvertibleLegislation[]>([]);
  const [tasks, setTasks] = useState<ConvertibleTask[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [legislationId, setLegislationId] = useState("");
  // Ids are kept across pages and searches, so a selection made on page 1
  // survives paging away and back before submitting.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (search) query.set("search", search);

      const response = await fetch(
        `/api/retainerships/${retainershipId}/convert-tasks?${query.toString()}`,
      );
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = await response.json();
      setLegislations(data.legislations || []);
      setTasks(data.tasks || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error("Error loading convertible tasks:", error);
      toast.error("Failed to load tasks");
      setLegislations([]);
      setTasks([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [retainershipId, page, search]);

  useEffect(() => {
    if (!open) return;
    loadData();
  }, [open, loadData]);

  // Fresh state each time the dialog opens, so a previous run's ticks and
  // search do not carry into the next one.
  useEffect(() => {
    if (open) return;
    setSelectedIds(new Set());
    setSearchInput("");
    setSearch("");
    setLegislationId("");
    setPage(1);
  }, [open]);

  const selectedLegislation = useMemo(
    () => legislations.find((item) => item.id === legislationId) || null,
    [legislations, legislationId],
  );

  const pageIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  const toggleTask = (taskId: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const togglePage = () => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (allOnPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const runSearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleConvert = async () => {
    if (!legislationId) {
      toast.error("Select a legislation to convert into");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("Select at least one task");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/retainerships/${retainershipId}/convert-tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            legislationId,
            taskIds: Array.from(selectedIds),
          }),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Failed to convert tasks");
      }

      toast.success(data.message || "Tasks converted");
      onConverted({ convertedCount: data.summary?.convertedCount ?? 0 });
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to convert tasks";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Convert Tasks to Legislation Tasks</DialogTitle>
          <DialogDescription>
            Select normal tasks belonging to this retainership&apos;s client and
            file them under one of its legislations. Converted tasks are linked
            to this retainership and reassigned to the legislation&apos;s agent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="convert-legislation">Target legislation *</Label>
            {loading && legislations.length === 0 ? (
              <Skeleton className="h-10 w-full" />
            ) : legislations.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  This retainership has no legislation yet. Add one before
                  converting tasks.
                </span>
              </div>
            ) : (
              <Select value={legislationId} onValueChange={setLegislationId}>
                <SelectTrigger id="convert-legislation">
                  <SelectValue placeholder="Select a legislation" />
                </SelectTrigger>
                <SelectContent>
                  {legislations.map((legislation) => (
                    <SelectItem key={legislation.id} value={legislation.id}>
                      {legislation.title}
                      {legislation.assignedAgent
                        ? ` — ${legislation.assignedAgent.name}`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedLegislation && !selectedLegislation.assignedAgentId && (
              <p className="text-xs text-muted-foreground">
                This legislation has no assigned agent, so the tasks keep their
                current assignee.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search normal tasks by title or description"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    runSearch();
                  }
                }}
              />
            </div>
            <Button variant="outline" onClick={runSearch} disabled={loading}>
              Search
            </Button>
          </div>

          <div className="max-h-[45vh] overflow-y-auto rounded-md border">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allOnPageSelected}
                      onCheckedChange={togglePage}
                      disabled={loading || pageIds.length === 0}
                      aria-label="Select all tasks on this page"
                    />
                  </TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead className="w-44">Assigned To</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : tasks.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No normal tasks available to convert for this client.
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map((task) => (
                    <TableRow
                      key={task.id}
                      className="cursor-pointer"
                      onClick={() => toggleTask(task.id)}
                    >
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(task.id)}
                          onCheckedChange={() => toggleTask(task.id)}
                          aria-label={`Select ${task.title}`}
                        />
                      </TableCell>
                      {/* max-w-0 + w-full lets the cell take the leftover width
                          and truncate inside it, instead of the long title
                          stretching the table past the dialog. */}
                      <TableCell className="w-full max-w-0" title={task.title}>
                        <div className="truncate font-medium">{task.title}</div>
                        {task.category && (
                          <div className="truncate text-xs text-muted-foreground">
                            {task.category.name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell
                        className="truncate"
                        title={task.assignedTo?.name || "Unassigned"}
                      >
                        {task.assignedTo?.name || "Unassigned"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{task.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {selectedIds.size} selected · {total} normal task(s) for this
              client
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={loading || page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || page >= totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
              >
                Next
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConvert}
            disabled={
              submitting ||
              loading ||
              !legislationId ||
              selectedIds.size === 0
            }
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Convert {selectedIds.size > 0 ? `${selectedIds.size} ` : ""}Task
            {selectedIds.size === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
