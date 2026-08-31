"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeftRight } from "lucide-react";
import { toast } from "react-toastify";
import { Agent } from "@/types";
import { hasAdvisorRole, hasExecutionRole } from "@/lib/agentRole";

interface TransferSummaryResponse {
  canTransferTasks: boolean;
  canTransferProspects: boolean;
  counts: {
    openTasks: number;
    ownedTasks: number;
    prospects: number;
    opportunities: number;
  };
}

interface TransferWorkCardProps {
  agent: Agent;
  allAgents: Agent[];
}

/**
 * Hands an active agent's live workload to someone else. Separate from the
 * delete-time transfer flow: the agent stays active and only open work moves.
 */
export default function TransferWorkCard({
  agent,
  allAgents,
}: TransferWorkCardProps) {
  const [summary, setSummary] = useState<TransferSummaryResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [transferTasks, setTransferTasks] = useState(false);
  const [transferProspects, setTransferProspects] = useState(false);
  const [taskTransferAgentId, setTaskTransferAgentId] = useState("");
  const [prospectTransferAgentId, setProspectTransferAgentId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  const showTasks = hasExecutionRole(agent.agentRole);
  const showProspects = hasAdvisorRole(agent.agentRole);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const response = await fetch(`/api/agents/${agent.id}/reassign`);
      if (response.ok) {
        setSummary(await response.json());
      }
    } catch (error) {
      console.error("Error loading transfer summary:", error);
    } finally {
      setLoadingSummary(false);
    }
  }, [agent.id]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const isActive = (candidate: Agent) =>
    candidate.status?.trim().toLowerCase() !== "inactive";

  const taskCandidates = allAgents.filter(
    (candidate) =>
      candidate.id !== agent.id &&
      isActive(candidate) &&
      hasExecutionRole(candidate.agentRole),
  );

  const prospectCandidates = allAgents.filter(
    (candidate) =>
      candidate.id !== agent.id &&
      isActive(candidate) &&
      hasAdvisorRole(candidate.agentRole),
  );

  const counts = summary?.counts;
  const hasTasksToTransfer =
    showTasks && !!counts && (counts.openTasks > 0 || counts.ownedTasks > 0);
  const hasProspectsToTransfer =
    showProspects && !!counts && counts.prospects > 0;
  const nothingToTransfer =
    !!counts && !hasTasksToTransfer && !hasProspectsToTransfer;

  const canSubmit =
    (transferTasks || transferProspects) &&
    (!transferTasks || !!taskTransferAgentId) &&
    (!transferProspects || !!prospectTransferAgentId);

  const handleTransfer = async () => {
    const scopes: string[] = [];
    if (transferTasks) scopes.push("tasks");
    if (transferProspects) scopes.push("prospects");

    try {
      setIsTransferring(true);
      const response = await fetch(`/api/agents/${agent.id}/reassign`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopes,
          taskTransferAgentId: transferTasks ? taskTransferAgentId : undefined,
          prospectTransferAgentId: transferProspects
            ? prospectTransferAgentId
            : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const moved = data.summary;
        toast.success(
          `Transferred ${moved.tasksTransferredCount} task(s), ${moved.prospectsTransferredCount} lead(s) and ${moved.opportunitiesTransferredCount} opportunity(ies).`,
        );
        setTransferTasks(false);
        setTransferProspects(false);
        setTaskTransferAgentId("");
        setProspectTransferAgentId("");
        loadSummary();
      } else {
        toast.error(data.error || "Failed to transfer work");
      }
    } catch (error) {
      console.error("Error transferring work:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsTransferring(false);
      setConfirmOpen(false);
    }
  };

  const selectedTaskAgent = allAgents.find((a) => a.id === taskTransferAgentId);
  const selectedProspectAgent = allAgents.find(
    (a) => a.id === prospectTransferAgentId,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5" />
          Transfer Work
        </CardTitle>
        <CardDescription>
          Move this agent&apos;s open work to another agent. The agent stays
          active and completed work stays in their history.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loadingSummary ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : nothingToTransfer ? (
          <p className="text-sm text-muted-foreground">
            This agent has no open tasks or leads to transfer.
          </p>
        ) : (
          <>
            {hasTasksToTransfer && (
              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="transfer-tasks"
                    checked={transferTasks}
                    onCheckedChange={(checked) =>
                      setTransferTasks(checked === true)
                    }
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor="transfer-tasks"
                      className="cursor-pointer font-medium"
                    >
                      Transfer tasks
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {counts?.openTasks ?? 0} open task(s) and ownership of the
                      agent&apos;s live tasks move to the selected agent.
                    </p>
                  </div>
                </div>

                {transferTasks && (
                  <Select
                    value={taskTransferAgentId}
                    onValueChange={setTaskTransferAgentId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select an execution agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {taskCandidates.map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          {candidate.name} — {candidate.agentType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {hasProspectsToTransfer && (
              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="transfer-prospects"
                    checked={transferProspects}
                    onCheckedChange={(checked) =>
                      setTransferProspects(checked === true)
                    }
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor="transfer-prospects"
                      className="cursor-pointer font-medium"
                    >
                      Transfer leads &amp; opportunities
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {counts?.prospects ?? 0} lead(s) and their{" "}
                      {counts?.opportunities ?? 0} opportunity(ies) move to the
                      selected agent. Opportunities follow their lead.
                    </p>
                  </div>
                </div>

                {transferProspects && (
                  <Select
                    value={prospectTransferAgentId}
                    onValueChange={setProspectTransferAgentId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select an advisor agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {prospectCandidates.map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          {candidate.name} —{" "}
                          {candidate.advisorAgentType || candidate.agentType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                type="button"
                disabled={!canSubmit || isTransferring}
                onClick={() => setConfirmOpen(true)}
                className="cursor-pointer"
              >
                {isTransferring ? "Transferring..." : "Transfer"}
              </Button>
            </div>
          </>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm transfer</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {transferTasks && (
                  <p>
                    {counts?.openTasks ?? 0} open task(s) move from{" "}
                    <span className="font-medium">{agent.name}</span> to{" "}
                    <span className="font-medium">
                      {selectedTaskAgent?.name}
                    </span>
                    .
                  </p>
                )}
                {transferProspects && (
                  <p>
                    {counts?.prospects ?? 0} lead(s) and{" "}
                    {counts?.opportunities ?? 0} opportunity(ies) move from{" "}
                    <span className="font-medium">{agent.name}</span> to{" "}
                    <span className="font-medium">
                      {selectedProspectAgent?.name}
                    </span>
                    .
                  </p>
                )}
                <p className="text-muted-foreground">
                  This cannot be undone from the app — the work has to be
                  transferred back manually.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isTransferring}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleTransfer();
              }}
              disabled={isTransferring}
            >
              {isTransferring ? "Transferring..." : "Confirm transfer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
