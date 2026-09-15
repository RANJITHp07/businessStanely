"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  ChevronsUpDown,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "react-toastify";
import { Client } from "@/types";
import { cn } from "@/lib/utils";

/** One row in the "selected tasks" picker. */
export interface TransferableTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  isRetainershipTask: boolean;
  assignedTo?: string | null;
}

export interface TransferSummary {
  clientId: string;
  clientName: string;
  counts: {
    totalTasks: number;
    openTasks: number;
    retainerships: number;
    diaryEntries: number;
  };
  tasks: TransferableTask[];
}

/**
 * "all" moves every task plus the retainerships; "selected" moves only the
 * picked tasks and leaves retainerships on the source. The API draws the same
 * line -- see the note at the top of the transfer-tasks route.
 */
export type TransferScope = "all" | "selected";

/**
 * "delete" opens with the soft-delete / transfer-then-delete choice.
 * "transfer" is the standalone move with no deletion.
 */
export type TransferTasksMode = "delete" | "transfer";

interface TransferTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: TransferTasksMode;
  client: Client | null;
  /** Every client the admin can pick from; the source is filtered out. */
  allClients: Client[];
  /** Fired after the server confirms, so the caller can refresh or navigate. */
  onCompleted: (result: {
    mode: TransferTasksMode;
    sourceDeleted: boolean;
    tasksTransferredCount: number;
    retainershipsTransferredCount: number;
  }) => void;
}

const displayName = (client: Client) =>
  client.name ||
  client.organizationName ||
  `${client.firstName || ""} ${client.lastName || ""}`.trim() ||
  client.email ||
  "Unnamed client";

/**
 * Deleting a client is a soft delete and soft delete does not cascade, so the
 * client's tasks stay live but hang off a hidden parent. This dialog makes that
 * the admin's decision: keep the tasks with the client (they come back if the
 * client is restored), or hand them to another client first.
 */
export default function TransferTasksDialog({
  open,
  onOpenChange,
  mode,
  client,
  allClients,
  onCompleted,
}: TransferTasksDialogProps) {
  const [summary, setSummary] = useState<TransferSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [action, setAction] = useState<"soft-delete" | "transfer">(
    "soft-delete",
  );
  const [targetClientId, setTargetClientId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scope, setScope] = useState<TransferScope>("all");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [taskSearch, setTaskSearch] = useState("");

  // The standalone card has no soft-delete branch, so its only action is the
  // transfer itself.
  const effectiveAction = mode === "transfer" ? "transfer" : action;

  const loadSummary = useCallback(async () => {
    if (!client) return;
    setLoadingSummary(true);
    try {
      const response = await fetch(`/api/clients/${client.id}/transfer-tasks`);
      if (response.ok) {
        setSummary(await response.json());
      } else {
        setSummary(null);
      }
    } catch (error) {
      console.error("Error loading client transfer summary:", error);
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, [client]);

  useEffect(() => {
    if (!open) return;
    setAction("soft-delete");
    setTargetClientId("");
    setPickerOpen(false);
    setScope("all");
    setSelectedTaskIds([]);
    setTaskSearch("");
    loadSummary();
  }, [open, loadSummary]);

  // Text matching is cmdk's job; this only drops the source client, which must
  // never be a transfer target.
  const candidates = useMemo(
    () => allClients.filter((candidate) => candidate.id !== client?.id),
    [allClients, client?.id],
  );

  const totalTasks = summary?.counts.totalTasks ?? 0;
  const totalRetainerships = summary?.counts.retainerships ?? 0;
  const hasWorkToMove = totalTasks > 0 || totalRetainerships > 0;
  const targetClient = allClients.find((c) => c.id === targetClientId);

  const tasks = summary?.tasks ?? [];

  const visibleTasks = useMemo(() => {
    const term = taskSearch.trim().toLowerCase();
    if (!term) return tasks;
    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(term) ||
        (task.assignedTo ?? "").toLowerCase().includes(term) ||
        task.status.toLowerCase().includes(term),
    );
  }, [tasks, taskSearch]);

  // Transfer-then-delete has to take everything, or the tasks left behind would
  // be hidden with the source client. The API rejects the combination too.
  const scopePickerAvailable = mode === "transfer";
  const effectiveScope: TransferScope = scopePickerAvailable ? scope : "all";
  const isPartial = effectiveScope === "selected";

  const toggleTask = (taskId: string) =>
    setSelectedTaskIds((current) =>
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId],
    );

  // Acts on what is currently filtered, so "select all" during a search means
  // the search results rather than the whole list.
  const allVisibleSelected =
    visibleTasks.length > 0 &&
    visibleTasks.every((task) => selectedTaskIds.includes(task.id));

  const toggleAllVisible = () =>
    setSelectedTaskIds((current) => {
      const visibleIds = visibleTasks.map((task) => task.id);
      if (allVisibleSelected) {
        return current.filter((id) => !visibleIds.includes(id));
      }
      return Array.from(new Set([...current, ...visibleIds]));
    });

  const canSubmit =
    !!client &&
    !submitting &&
    (effectiveAction === "soft-delete" || !!targetClientId) &&
    (effectiveAction !== "transfer" || mode === "delete" || hasWorkToMove) &&
    (effectiveAction !== "transfer" || !isPartial || selectedTaskIds.length > 0);

  const handleSubmit = async () => {
    if (!client) return;

    setSubmitting(true);
    try {
      if (effectiveAction === "soft-delete") {
        const response = await fetch(`/api/clients/${client.id}`, {
          method: "DELETE",
        });

        if (response.ok) {
          toast.success(`${displayName(client)} deleted.`);
          onCompleted({
            mode,
            sourceDeleted: true,
            tasksTransferredCount: 0,
            retainershipsTransferredCount: 0,
          });
          onOpenChange(false);
        } else {
          const data = await response.json().catch(() => ({}));
          toast.error(data.error || "Failed to delete client");
        }
        return;
      }

      const response = await fetch(`/api/clients/${client.id}/transfer-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetClientId,
          deleteSource: mode === "delete",
          // Omitted entirely for a full move -- the API reads absent as "all".
          ...(isPartial ? { taskIds: selectedTaskIds } : {}),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        toast.success(data.message || "Tasks transferred.");
        onCompleted({
          mode,
          sourceDeleted: mode === "delete",
          tasksTransferredCount: data.summary?.tasksTransferredCount ?? 0,
          retainershipsTransferredCount:
            data.summary?.retainershipsTransferredCount ?? 0,
        });
        onOpenChange(false);
      } else {
        toast.error(data.error || "Failed to transfer tasks");
      }
    } catch (error) {
      console.error("Error running client transfer:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const sourceName = client ? displayName(client) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "delete" ? (
              <Trash2 className="h-5 w-5" />
            ) : (
              <ArrowLeftRight className="h-5 w-5" />
            )}
            {mode === "delete" ? "Delete client" : "Transfer tasks"}
          </DialogTitle>
          <DialogDescription>
            {mode === "delete" ? (
              <>
                Choose what happens to{" "}
                <span className="font-medium">{sourceName}</span>&apos;s tasks
                and retainerships before the client is deleted.
              </>
            ) : (
              <>
                Move tasks and retainerships from{" "}
                <span className="font-medium">{sourceName}</span> to another
                client. The client stays active.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loadingSummary ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <>
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <p className="font-medium">
                  {totalTasks} task(s) and {totalRetainerships} retainership(s)
                  attached to this client
                </p>
                <p className="text-xs text-muted-foreground">
                  {summary?.counts.openTasks ?? 0} task(s) still open ·{" "}
                  {summary?.counts.diaryEntries ?? 0} diary entr(ies) stay with
                  this client
                </p>
              </div>

              {mode === "delete" && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setAction("soft-delete")}
                    className={cn(
                      "w-full cursor-pointer rounded-lg border p-3 text-left transition-colors",
                      action === "soft-delete"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50",
                    )}
                  >
                    <span className="block text-sm font-medium">
                      Soft delete the client
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      The client is hidden and recoverable. Its {totalTasks}{" "}
                      task(s) and {totalRetainerships} retainership(s) are
                      hidden with it, and all come back if the client is
                      restored.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAction("transfer")}
                    className={cn(
                      "w-full cursor-pointer rounded-lg border p-3 text-left transition-colors",
                      action === "transfer"
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50",
                    )}
                  >
                    <span className="block text-sm font-medium">
                      Transfer tasks &amp; retainerships, then delete
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      All {totalTasks} task(s) and {totalRetainerships}{" "}
                      retainership(s) move to another client first, so they stay
                      reachable after this client is gone.
                    </span>
                  </button>
                </div>
              )}

              {effectiveAction === "transfer" && scopePickerAvailable && (
                <div className="space-y-2">
                  <Label>What to transfer</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setScope("all")}
                      className={cn(
                        "cursor-pointer rounded-lg border p-3 text-left transition-colors",
                        effectiveScope === "all"
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50",
                      )}
                    >
                      <span className="block text-sm font-medium">
                        All tasks
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {totalTasks} task(s) and {totalRetainerships}{" "}
                        retainership(s)
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setScope("selected")}
                      className={cn(
                        "cursor-pointer rounded-lg border p-3 text-left transition-colors",
                        effectiveScope === "selected"
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50",
                      )}
                    >
                      <span className="block text-sm font-medium">
                        Selected tasks
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Pick tasks to move. Retainerships stay.
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {effectiveAction === "transfer" && isPartial && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>
                      Tasks to move ({selectedTaskIds.length} selected)
                    </Label>
                    {visibleTasks.length > 0 && (
                      <button
                        type="button"
                        onClick={toggleAllVisible}
                        className="cursor-pointer text-xs text-primary hover:underline"
                      >
                        {allVisibleSelected ? "Clear all" : "Select all"}
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={taskSearch}
                      onChange={(event) => setTaskSearch(event.target.value)}
                      placeholder="Search tasks..."
                      className="pl-8"
                    />
                  </div>

                  <ScrollArea className="h-56 rounded-lg border">
                    {visibleTasks.length === 0 ? (
                      <p className="p-4 text-center text-sm text-muted-foreground">
                        {tasks.length === 0
                          ? "This client has no tasks to transfer."
                          : "No tasks match your search."}
                      </p>
                    ) : (
                      <div className="divide-y">
                        {visibleTasks.map((task) => (
                          <label
                            key={task.id}
                            className="flex cursor-pointer items-start gap-3 p-3 hover:bg-muted/50"
                          >
                            <Checkbox
                              checked={selectedTaskIds.includes(task.id)}
                              onCheckedChange={() => toggleTask(task.id)}
                              className="mt-0.5"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {task.title}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {task.status}
                                {task.assignedTo && ` · ${task.assignedTo}`}
                                {task.isRetainershipTask && " · Retainership"}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </ScrollArea>

                  <p className="flex items-start gap-2 text-xs text-muted-foreground">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Retainerships stay with{" "}
                      <span className="font-medium">{sourceName}</span>. A
                      retainership task moved on its own keeps its link, so its
                      retainership will sit under the other client.
                    </span>
                  </p>
                </div>
              )}

              {effectiveAction === "transfer" && (
                <div className="space-y-2">
                  <Label htmlFor="transfer-target">Target client</Label>
                  <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="transfer-target"
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={pickerOpen}
                        className="w-full justify-between bg-transparent font-normal"
                      >
                        <span
                          className={cn(
                            "truncate",
                            !targetClient && "text-muted-foreground",
                          )}
                        >
                          {targetClient
                            ? displayName(targetClient)
                            : "Search and select a client..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-0"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Type a name or email..." />
                        <CommandList>
                          <CommandEmpty>No client found.</CommandEmpty>
                          <CommandGroup>
                            {candidates.map((candidate) => (
                              <CommandItem
                                key={candidate.id}
                                // cmdk filters on `value`, so both fields the
                                // admin might type have to be in it.
                                value={`${displayName(candidate)} ${candidate.email ?? ""}`}
                                onSelect={() => {
                                  setTargetClientId(
                                    candidate.id === targetClientId
                                      ? ""
                                      : candidate.id,
                                  );
                                  setPickerOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 shrink-0",
                                    targetClientId === candidate.id
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                <div className="flex min-w-0 flex-col">
                                  <span className="truncate font-medium">
                                    {displayName(candidate)}
                                  </span>
                                  {candidate.email && (
                                    <span className="truncate text-xs text-muted-foreground">
                                      {candidate.email}
                                    </span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {targetClient && (
                    <p className="flex items-start gap-2 text-xs text-muted-foreground">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        {isPartial
                          ? `${selectedTaskIds.length} selected task(s)`
                          : `${totalTasks} task(s) and ${totalRetainerships} retainership(s)`}{" "}
                        move from{" "}
                        <span className="font-medium">{sourceName}</span> to{" "}
                        <span className="font-medium">
                          {displayName(targetClient)}
                        </span>
                        {mode === "delete"
                          ? ", then the source client is deleted."
                          : "."}{" "}
                        This is not undone by restoring the client — the tasks
                        have to be transferred back.
                      </span>
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={mode === "delete" ? "destructive" : "default"}
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="cursor-pointer"
          >
            {submitting
              ? "Working..."
              : mode === "transfer"
                ? isPartial
                  ? `Transfer ${selectedTaskIds.length} task(s)`
                  : "Transfer all"
                : effectiveAction === "soft-delete"
                  ? "Delete client"
                  : "Transfer & delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
