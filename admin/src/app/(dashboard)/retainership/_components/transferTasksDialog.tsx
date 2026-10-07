"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { AlertTriangle, ArrowRight, Loader2, Search } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";

interface TransferableTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  legislationId: string | null;
  assignedTo: { id: string; name: string } | null;
  legislation: { id: string; title: string } | null;
}

interface TargetLegislation {
  id: string;
  title: string;
  assignedAgentId: string | null;
  assignedAgent: { id: string; name: string } | null;
}

interface TargetRetainership {
  id: string;
  name: string;
  status: string;
  clientId: string | null;
  clientName: string | null;
  legislation: TargetLegislation[];
}

interface SourceLegislation {
  id: string;
  title: string;
}

interface TransferTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The retainership the tasks are moving out of. */
  retainershipId: string;
  /**
   * Narrows the source to one legislation. Set when opened from a legislation
   * page; left out on the retainership page, where every legislation's tasks
   * are listed and can be filtered.
   */
  legislationId?: string;
  /** Fired after the server confirms, so the page can refresh its data. */
  onTransferred: (result: { transferredCount: number }) => void;
}

const PAGE_SIZE = 25;
/** Select needs a non-empty value, so "no filter" gets a sentinel. */
const ALL_LEGISLATIONS = "__all__";

/**
 * Moves legislation tasks to another legislation, on this retainership or on
 * another retainership.
 *
 * The admin ticks tasks, picks the retainership to move them to (this one by
 * default), then a legislation on it. Moved tasks go to the target
 * legislation's agent, and to the target retainership's client when it differs.
 */
export default function TransferTasksDialog({
  open,
  onOpenChange,
  retainershipId,
  legislationId,
  onTransferred,
}: TransferTasksDialogProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sourceLegislations, setSourceLegislations] = useState<
    SourceLegislation[]
  >([]);
  const [sourceLegislation, setSourceLegislation] =
    useState<SourceLegislation | null>(null);
  const [targets, setTargets] = useState<TargetRetainership[]>([]);
  const [sourceClientId, setSourceClientId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TransferableTask[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  // Only used on the retainership page, to list one legislation's tasks at a
  // time. It filters the list; it does not narrow what the POST may move.
  const [filterLegislationId, setFilterLegislationId] =
    useState(ALL_LEGISLATIONS);
  const [targetRetainershipId, setTargetRetainershipId] = useState("");
  const [targetLegislationId, setTargetLegislationId] = useState("");
  // Ids are kept across pages and searches, so a selection made on page 1
  // survives paging away and back before submitting.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // The default target is applied once per opening. Re-applying it whenever the
  // field is empty would undo the admin clearing it.
  const preselectedRef = useRef(false);

  const listLegislationId =
    legislationId ||
    (filterLegislationId !== ALL_LEGISLATIONS ? filterLegislationId : "");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (search) query.set("search", search);
      if (listLegislationId) query.set("legislationId", listLegislationId);

      const response = await fetch(
        `/api/retainerships/${retainershipId}/transfer-tasks?${query.toString()}`,
      );
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = await response.json();
      setSourceLegislations(data.sourceLegislations || []);
      setSourceLegislation(data.sourceLegislation || null);
      setTargets(data.targets || []);
      setSourceClientId(data.retainership?.clientId ?? null);
      setTasks(data.tasks || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error("Error loading transferable tasks:", error);
      toast.error("Failed to load tasks");
      setTargets([]);
      setTasks([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [retainershipId, page, search, listLegislationId]);

  useEffect(() => {
    if (!open) return;
    loadData();
  }, [open, loadData]);

  // Fresh state each time the dialog opens, so a previous run's ticks and
  // choices do not carry into the next one.
  useEffect(() => {
    if (open) return;
    setSelectedIds(new Set());
    setSearchInput("");
    setSearch("");
    setFilterLegislationId(ALL_LEGISLATIONS);
    setTargetRetainershipId("");
    setTargetLegislationId("");
    setPage(1);
    preselectedRef.current = false;
  }, [open]);

  // The current retainership is listed first, and moving between its own
  // legislations is the common case, so it is preselected.
  useEffect(() => {
    if (preselectedRef.current || targets.length === 0) return;
    preselectedRef.current = true;
    setTargetRetainershipId((current) => current || targets[0].id);
  }, [targets]);

  const targetRetainership = useMemo(
    () => targets.find((item) => item.id === targetRetainershipId) || null,
    [targets, targetRetainershipId],
  );

  // Moving tasks onto the legislation they came from would be a no-op.
  const targetLegislations = useMemo(
    () =>
      (targetRetainership?.legislation || []).filter(
        (item) => item.id !== legislationId,
      ),
    [targetRetainership, legislationId],
  );

  const selectedTargetLegislation = useMemo(
    () =>
      targetLegislations.find((item) => item.id === targetLegislationId) ||
      null,
    [targetLegislations, targetLegislationId],
  );

  const retainershipOptions = useMemo(
    () =>
      targets.map((retainership) => ({
        value: retainership.id,
        label:
          retainership.id === retainershipId
            ? `${retainership.name} (current)`
            : retainership.status === "pending"
              ? `${retainership.name} (pending)`
              : retainership.name,
        description: retainership.clientName ?? undefined,
      })),
    [targets, retainershipId],
  );

  const legislationOptions = useMemo(
    () =>
      targetLegislations.map((legislation) => ({
        value: legislation.id,
        label: legislation.title,
        description: legislation.assignedAgent
          ? `Agent: ${legislation.assignedAgent.name}`
          : "No assigned agent",
      })),
    [targetLegislations],
  );

  const isCrossRetainership =
    !!targetRetainershipId && targetRetainershipId !== retainershipId;
  const isCrossClient =
    isCrossRetainership &&
    !!targetRetainership?.clientId &&
    targetRetainership.clientId !== sourceClientId;

  /** A task already filed under the chosen target has nowhere to move. */
  const isAlreadyInTarget = useCallback(
    (task: TransferableTask) =>
      !!targetLegislationId && task.legislationId === targetLegislationId,
    [targetLegislationId],
  );

  const selectableIds = useMemo(
    () => tasks.filter((task) => !isAlreadyInTarget(task)).map((t) => t.id),
    [tasks, isAlreadyInTarget],
  );
  const allOnPageSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selectedIds.has(id));

  // Picking a target can make some ticked tasks pointless to send; they are
  // dropped so the button's count matches what will actually move.
  useEffect(() => {
    if (!targetLegislationId) return;
    const alreadyThere = tasks
      .filter((task) => task.legislationId === targetLegislationId)
      .map((task) => task.id);
    if (alreadyThere.length === 0) return;
    setSelectedIds((previous) => {
      if (!alreadyThere.some((id) => previous.has(id))) return previous;
      const next = new Set(previous);
      alreadyThere.forEach((id) => next.delete(id));
      return next;
    });
  }, [targetLegislationId, tasks]);

  const toggleTask = (task: TransferableTask) => {
    if (isAlreadyInTarget(task)) return;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(task.id)) {
        next.delete(task.id);
      } else {
        next.add(task.id);
      }
      return next;
    });
  };

  const togglePage = () => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (allOnPageSelected) {
        selectableIds.forEach((id) => next.delete(id));
      } else {
        selectableIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const runSearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleTargetRetainershipChange = (value: string) => {
    setTargetRetainershipId(value);
    // A legislation id only makes sense on the retainership it was picked from.
    setTargetLegislationId("");
  };

  const handleTransfer = async () => {
    if (!targetLegislationId) {
      toast.error("Select a legislation to transfer into");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("Select at least one task");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/retainerships/${retainershipId}/transfer-tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetLegislationId,
            taskIds: Array.from(selectedIds),
            ...(legislationId ? { legislationId } : {}),
          }),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Failed to transfer tasks");
      }

      toast.success(data.message || "Tasks transferred");
      onTransferred({ transferredCount: data.summary?.transferredCount ?? 0 });
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to transfer tasks";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const showLegislationColumn = !legislationId;
  const columnCount = showLegislationColumn ? 5 : 4;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Transfer Tasks</DialogTitle>
          <DialogDescription>
            {legislationId && sourceLegislation
              ? `Move tasks from "${sourceLegislation.title}" to another legislation on this retainership, or to a legislation on another retainership.`
              : "Move legislation tasks to another legislation on this retainership, or to a legislation on another retainership."}{" "}
            Transferred tasks are reassigned to the target legislation&apos;s
            agent.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="transfer-target-retainership">
                Target retainership *
              </Label>
              {loading && targets.length === 0 ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <SearchableSelect
                  id="transfer-target-retainership"
                  value={targetRetainershipId}
                  onChange={handleTargetRetainershipChange}
                  options={retainershipOptions}
                  placeholder="Select a retainership"
                  searchPlaceholder="Search retainership or client..."
                  emptyText="No retainership found."
                />
              )}
            </div>

            <ArrowRight className="mx-auto hidden h-4 w-4 text-muted-foreground md:mb-3 md:block" />

            <div className="space-y-2">
              <Label htmlFor="transfer-target-legislation">
                Target legislation *
              </Label>
              {loading && targets.length === 0 ? (
                <Skeleton className="h-10 w-full" />
              ) : targetRetainership && targetLegislations.length === 0 ? (
                <div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-2 text-sm text-yellow-800">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    {targetRetainership.id === retainershipId && legislationId
                      ? "This retainership has no other legislation."
                      : "This retainership has no legislation."}
                  </span>
                </div>
              ) : (
                <SearchableSelect
                  id="transfer-target-legislation"
                  value={targetLegislationId}
                  onChange={setTargetLegislationId}
                  options={legislationOptions}
                  placeholder={
                    targetRetainership
                      ? "Select a legislation"
                      : "Select a retainership first"
                  }
                  searchPlaceholder="Search legislation or agent..."
                  emptyText="No legislation found."
                  disabled={!targetRetainership}
                />
              )}
            </div>
          </div>

          {selectedTargetLegislation &&
            !selectedTargetLegislation.assignedAgentId && (
              <p className="text-xs text-muted-foreground">
                This legislation has no assigned agent, so the tasks keep their
                current assignee.
              </p>
            )}
          {isCrossClient && targetRetainership ? (
            <div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-2 text-sm text-yellow-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                &quot;{targetRetainership.name}&quot; belongs to another client
                {targetRetainership.clientName
                  ? ` (${targetRetainership.clientName})`
                  : ""}
                . The transferred tasks will move to that client too.
              </span>
            </div>
          ) : (
            isCrossRetainership &&
            targetRetainership && (
              <p className="text-xs text-muted-foreground">
                Tasks will move out of this retainership and into &quot;
                {targetRetainership.name}&quot;.
              </p>
            )
          )}

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            {!legislationId && (
              <Select
                value={filterLegislationId}
                onValueChange={(value) => {
                  setPage(1);
                  setFilterLegislationId(value);
                }}
              >
                <SelectTrigger className="md:w-56">
                  <SelectValue placeholder="All legislations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_LEGISLATIONS}>
                    All legislations
                  </SelectItem>
                  {sourceLegislations.map((legislation) => (
                    <SelectItem key={legislation.id} value={legislation.id}>
                      {legislation.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search tasks by title or description"
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

          <div className="max-h-[40vh] overflow-y-auto rounded-md border">
            <Table className="min-w-[640px] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allOnPageSelected}
                      onCheckedChange={togglePage}
                      disabled={loading || selectableIds.length === 0}
                      aria-label="Select all tasks on this page"
                    />
                  </TableHead>
                  <TableHead>Task</TableHead>
                  {showLegislationColumn && (
                    <TableHead className="w-44">Legislation</TableHead>
                  )}
                  <TableHead className="w-40">Assigned To</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={columnCount}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : tasks.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columnCount}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No tasks available to transfer.
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map((task) => {
                    const alreadyInTarget = isAlreadyInTarget(task);
                    return (
                      <TableRow
                        key={task.id}
                        className={
                          alreadyInTarget
                            ? "opacity-50"
                            : "cursor-pointer"
                        }
                        onClick={() => toggleTask(task)}
                        title={
                          alreadyInTarget
                            ? "Already in the target legislation"
                            : undefined
                        }
                      >
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(task.id)}
                            onCheckedChange={() => toggleTask(task)}
                            disabled={alreadyInTarget}
                            aria-label={`Select ${task.title}`}
                          />
                        </TableCell>
                        {/* max-w-0 + w-full lets the cell take the leftover
                            width and truncate inside it, instead of the long
                            title stretching the table past the dialog. */}
                        <TableCell
                          className="w-full max-w-0"
                          title={task.title}
                        >
                          <div className="truncate font-medium">
                            {task.title}
                          </div>
                        </TableCell>
                        {showLegislationColumn && (
                          <TableCell
                            className="truncate"
                            title={task.legislation?.title || "None"}
                          >
                            {task.legislation?.title || "None"}
                          </TableCell>
                        )}
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
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {selectedIds.size} selected · {total} task(s)
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
            onClick={handleTransfer}
            disabled={
              submitting ||
              loading ||
              !targetLegislationId ||
              selectedIds.size === 0
            }
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Transfer {selectedIds.size > 0 ? `${selectedIds.size} ` : ""}Task
            {selectedIds.size === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
