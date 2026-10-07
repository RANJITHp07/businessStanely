"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import SearchableSelect from "@/components/SearchableSelect";

interface ConvertLegislation {
  id: string;
  title: string;
  assignedAgentId: string | null;
  assignedAgent: { id: string; name: string } | null;
}

interface ConvertRetainership {
  id: string;
  name: string;
  status: string;
  clientId: string | null;
  clientName: string | null;
  legislation: ConvertLegislation[];
}

interface ConvertTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskTitle: string;
  /**
   * Which way the conversion goes. A legislation task converts to normal; a
   * normal task converts to legislation.
   */
  isLegislationTask: boolean;
  /** Shown in the convert-to-normal confirmation. */
  legislationTitle?: string | null;
  /** Fired after the server confirms, so the caller can refresh its data. */
  onConverted: () => void;
}

/**
 * Converts one task between normal and legislation.
 *
 * Normal to legislation asks for a retainership and one of its legislations
 * (only the task's own client's retainerships are offered); legislation to
 * normal is a confirmation, since it only unlinks the task.
 */
export default function ConvertTaskDialog({
  open,
  onOpenChange,
  taskId,
  taskTitle,
  isLegislationTask,
  legislationTitle,
  onConverted,
}: ConvertTaskDialogProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [retainerships, setRetainerships] = useState<ConvertRetainership[]>([]);
  const [retainershipId, setRetainershipId] = useState("");
  const [legislationId, setLegislationId] = useState("");

  const loadOptions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}/convert`);
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = await response.json();
      const list: ConvertRetainership[] = data.retainerships || [];
      setRetainerships(list);
      // Most clients have a single retainership; picking it saves a step.
      if (list.length === 1) setRetainershipId(list[0].id);
    } catch (error) {
      console.error("Error loading conversion options:", error);
      toast.error("Failed to load legislations");
      setRetainerships([]);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!open || isLegislationTask) return;
    loadOptions();
  }, [open, isLegislationTask, loadOptions]);

  // Fresh state each time the dialog opens.
  useEffect(() => {
    if (open) return;
    setRetainershipId("");
    setLegislationId("");
  }, [open]);

  const retainership = useMemo(
    () => retainerships.find((item) => item.id === retainershipId) || null,
    [retainerships, retainershipId],
  );

  const selectedLegislation = useMemo(
    () =>
      retainership?.legislation.find((item) => item.id === legislationId) ||
      null,
    [retainership, legislationId],
  );

  const retainershipOptions = useMemo(
    () =>
      retainerships.map((item) => ({
        value: item.id,
        label:
          item.status === "pending" ? `${item.name} (pending)` : item.name,
        description: item.clientName ?? undefined,
      })),
    [retainerships],
  );

  const legislationOptions = useMemo(
    () =>
      (retainership?.legislation || []).map((item) => ({
        value: item.id,
        label: item.title,
        description: item.assignedAgent
          ? `Agent: ${item.assignedAgent.name}`
          : "No assigned agent",
      })),
    [retainership],
  );

  const handleRetainershipChange = (value: string) => {
    setRetainershipId(value);
    // A legislation id only makes sense on the retainership it was picked from.
    setLegislationId("");
  };

  const handleConvert = async () => {
    if (!isLegislationTask && !legislationId) {
      toast.error("Select a legislation");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isLegislationTask
            ? { to: "normal" }
            : { to: "legislation", legislationId },
        ),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to convert task");
      }

      toast.success(data.message || "Task converted");
      onConverted();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to convert task",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isLegislationTask
              ? "Convert to Normal Task"
              : "Convert to Legislation Task"}
          </DialogTitle>
          <DialogDescription>
            {isLegislationTask ? (
              <>
                &quot;{taskTitle}&quot; will be removed from
                {legislationTitle
                  ? ` legislation "${legislationTitle}" and its retainership`
                  : " its legislation and retainership"}{" "}
                and become a normal task. Its assignee, comments and time logs
                stay as they are.
              </>
            ) : (
              <>
                File &quot;{taskTitle}&quot; under a legislation. The task is
                linked to that legislation&apos;s retainership and reassigned
                to the legislation&apos;s agent.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {!isLegislationTask && (
          <div className="min-w-0 space-y-4">
            {loading ? (
              <Skeleton className="h-10 w-full" />
            ) : retainerships.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  This task&apos;s client has no retainership. Create a
                  retainership with a legislation first.
                </span>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
                <div className="space-y-2">
                  <Label htmlFor="convert-task-retainership">
                    Retainership *
                  </Label>
                  <SearchableSelect
                    id="convert-task-retainership"
                    value={retainershipId}
                    onChange={handleRetainershipChange}
                    options={retainershipOptions}
                    placeholder="Select a retainership"
                    searchPlaceholder="Search retainership or client..."
                    emptyText="No retainership found."
                  />
                </div>

                <ArrowRight className="mx-auto hidden h-4 w-4 text-muted-foreground md:mb-3 md:block" />

                <div className="space-y-2">
                  <Label htmlFor="convert-task-legislation">
                    Legislation *
                  </Label>
                  {retainership && retainership.legislation.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-2 text-sm text-yellow-800">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>This retainership has no legislation.</span>
                    </div>
                  ) : (
                    <SearchableSelect
                      id="convert-task-legislation"
                      value={legislationId}
                      onChange={setLegislationId}
                      options={legislationOptions}
                      placeholder={
                        retainership
                          ? "Select a legislation"
                          : "Select a retainership first"
                      }
                      searchPlaceholder="Search legislation or agent..."
                      emptyText="No legislation found."
                      disabled={!retainership}
                    />
                  )}
                </div>
              </div>
            )}

            {selectedLegislation && !selectedLegislation.assignedAgentId && (
              <p className="text-xs text-muted-foreground">
                This legislation has no assigned agent, so the task keeps its
                current assignee.
              </p>
            )}
          </div>
        )}

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
              submitting || (!isLegislationTask && (loading || !legislationId))
            }
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLegislationTask
              ? "Convert to Normal Task"
              : "Convert to Legislation Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
