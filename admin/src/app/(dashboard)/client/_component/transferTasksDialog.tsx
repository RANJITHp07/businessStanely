"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { AlertTriangle, ArrowLeftRight, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { Client } from "@/types";
import { cn } from "@/lib/utils";

export interface TransferSummary {
  clientId: string;
  clientName: string;
  counts: {
    totalTasks: number;
    openTasks: number;
    retainerships: number;
    diaryEntries: number;
  };
}

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
  const [targetSearch, setTargetSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    setTargetSearch("");
    loadSummary();
  }, [open, loadSummary]);

  const candidates = useMemo(() => {
    const term = targetSearch.trim().toLowerCase();
    return allClients
      .filter((candidate) => candidate.id !== client?.id)
      .filter((candidate) => {
        if (!term) return true;
        return (
          displayName(candidate).toLowerCase().includes(term) ||
          (candidate.email || "").toLowerCase().includes(term)
        );
      });
  }, [allClients, client?.id, targetSearch]);

  const totalTasks = summary?.counts.totalTasks ?? 0;
  const targetClient = allClients.find((c) => c.id === targetClientId);

  const canSubmit =
    !!client &&
    !submitting &&
    (effectiveAction === "soft-delete" || !!targetClientId) &&
    (effectiveAction !== "transfer" || mode === "delete" || totalTasks > 0);

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
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        toast.success(data.message || "Tasks transferred.");
        onCompleted({
          mode,
          sourceDeleted: mode === "delete",
          tasksTransferredCount: data.summary?.tasksTransferredCount ?? 0,
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
                before the client is deleted.
              </>
            ) : (
              <>
                Move every task on{" "}
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
                  {totalTasks} task(s) attached to this client
                </p>
                <p className="text-xs text-muted-foreground">
                  {summary?.counts.openTasks ?? 0} still open ·{" "}
                  {summary?.counts.retainerships ?? 0} retainership(s) ·{" "}
                  {summary?.counts.diaryEntries ?? 0} diary entr(ies)
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
                      task(s) stay attached and come back if the client is
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
                      Transfer tasks, then delete
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      All {totalTasks} task(s) move to another client first, so
                      they stay reachable after this client is gone.
                    </span>
                  </button>
                </div>
              )}

              {effectiveAction === "transfer" && (
                <div className="space-y-2">
                  <Label htmlFor="transfer-target">Target client</Label>
                  <Input
                    id="transfer-target-search"
                    placeholder="Search clients..."
                    value={targetSearch}
                    onChange={(event) => setTargetSearch(event.target.value)}
                  />
                  <Select
                    value={targetClientId}
                    onValueChange={setTargetClientId}
                  >
                    <SelectTrigger id="transfer-target" className="w-full">
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.length === 0 ? (
                        <div className="px-2 py-3 text-sm text-muted-foreground">
                          No matching clients
                        </div>
                      ) : (
                        candidates.map((candidate) => (
                          <SelectItem key={candidate.id} value={candidate.id}>
                            {displayName(candidate)}
                            {candidate.email ? ` — ${candidate.email}` : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  {targetClient && (
                    <p className="flex items-start gap-2 text-xs text-muted-foreground">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        {totalTasks} task(s) move from{" "}
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
                ? "Transfer tasks"
                : effectiveAction === "soft-delete"
                  ? "Delete client"
                  : "Transfer & delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
