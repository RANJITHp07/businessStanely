"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "react-toastify";
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
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import {
  EXECUTION_AND_ADVISOR_AGENT_ROLE,
  getAdvisorType,
  hasAdvisorRole,
  hasExecutionRole,
} from "@/lib/agentRole";
import { cn } from "@/lib/utils";
import { Agent } from "@/types";

export type AgentRemovalScope = "agent" | "execution" | "advisor";
type RemovalMode = "soft-delete" | "transfer";

interface RemovalSummary {
  execution: { openTasks: number; completedTasks: number; legislations: number };
  advisor: { openLeads: number; openOpportunities: number };
}

// Highest rank first. Tasks may only move to an agent of the same or a higher
// rank, as the agent list's delete always required.
const EXECUTION_RANKS = [
  "Owner",
  "Partner",
  "CEO",
  "Senior Manager",
  "Manager",
  "Senior Executive",
  "Executive",
  "Junior Executive",
  "Trainee",
  "Intern",
];

const executionTypeOf = (agent: Agent) => agent.executionAgentType || agent.agentType;

interface DeleteAgentDialogProps {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired after the server confirms, so the caller can refresh its list. */
  onCompleted: (result: { scope: AgentRemovalScope }) => void;
}

/**
 * Deletes an agent, or removes one role from a dual-role agent, with or
 * without handing the work to another agent first. A delete without transfer
 * is a soft delete: the agent's open work is hidden with it and comes back if
 * the agent is restored. See lib/agentRemoval.ts.
 */
export default function DeleteAgentDialog({
  agent,
  open,
  onOpenChange,
  onCompleted,
}: DeleteAgentDialogProps) {
  const [summary, setSummary] = useState<RemovalSummary | null>(null);
  const [candidates, setCandidates] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<AgentRemovalScope>("agent");
  const [mode, setMode] = useState<RemovalMode>("soft-delete");
  const [transferAgentId, setTransferAgentId] = useState("");
  const [transferLeadsAgentId, setTransferLeadsAgentId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !agent) return;
    setScope("agent");
    setMode("soft-delete");
    setTransferAgentId("");
    setTransferLeadsAgentId("");

    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchWithAuth(`/api/agents/${agent.id}/remove`).then((r) => (r.ok ? r.json() : null)),
      fetchWithAuth("/api/agents").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([summaryData, agents]) => {
        if (cancelled) return;
        setSummary(summaryData);
        setCandidates(Array.isArray(agents) ? agents : []);
      })
      .catch((error) => {
        console.error("Error loading agent delete details:", error);
        if (!cancelled) setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, agent]);

  const isDual = agent?.agentRole === EXECUTION_AND_ADVISOR_AGENT_ROLE;
  const agentHasExecution = hasExecutionRole(agent?.agentRole);
  const agentHasAdvisor = hasAdvisorRole(agent?.agentRole);
  const fullDelete = scope === "agent";

  // Which kinds of work this choice touches. A full delete takes all of it.
  const coversExecution = fullDelete || scope === "execution";
  const coversAdvisor = scope === "advisor" || (fullDelete && agentHasAdvisor);
  // A pure advisor's tasks go to the advisor picked for its leads.
  const needsTaskTarget = mode === "transfer" && coversExecution && agentHasExecution;
  const needsLeadsTarget = mode === "transfer" && coversAdvisor;

  const executionOptions = useMemo(() => {
    if (!agent) return [];
    const sourceRank = EXECUTION_RANKS.indexOf(executionTypeOf(agent));
    return candidates
      .filter(
        (candidate) =>
          candidate.id !== agent.id &&
          candidate.status?.toLowerCase() !== "inactive" &&
          hasExecutionRole(candidate.agentRole) &&
          (sourceRank === -1 ||
            EXECUTION_RANKS.indexOf(executionTypeOf(candidate)) <= sourceRank),
      )
      .map((candidate) => ({
        value: candidate.id,
        label: candidate.name,
        description: executionTypeOf(candidate),
      }));
  }, [agent, candidates]);

  const advisorOptions = useMemo(() => {
    if (!agent) return [];
    const leadMaker = getAdvisorType(agent) === "Lead Maker";
    return candidates
      .filter(
        (candidate) =>
          candidate.id !== agent.id &&
          candidate.status?.toLowerCase() !== "inactive" &&
          hasAdvisorRole(candidate.agentRole) &&
          // A Lead Maker's leads can only go to another Lead Maker.
          (!leadMaker || getAdvisorType(candidate) === "Lead Maker"),
      )
      .map((candidate) => ({
        value: candidate.id,
        label: candidate.name,
        description: getAdvisorType(candidate) || candidate.agentType,
      }));
  }, [agent, candidates]);

  const executionWork = summary
    ? `${summary.execution.openTasks} open task(s) and ${summary.execution.legislations} legislation(s)`
    : "";
  const advisorWork = summary
    ? `${summary.advisor.openLeads} open lead(s) and ${summary.advisor.openOpportunities} open opportunit(ies)`
    : "";
  const workText = [coversExecution && executionWork, coversAdvisor && advisorWork]
    .filter(Boolean)
    .join(", ");

  const remainingRole = scope === "execution" ? "Advisor Agent" : "Execution Agent";
  const removedRoleLabel = scope === "execution" ? "Execution" : "Advisor";

  const canSubmit =
    !!agent &&
    !submitting &&
    !loading &&
    (!needsTaskTarget || !!transferAgentId) &&
    (!needsLeadsTarget || !!transferLeadsAgentId);

  const handleSubmit = async () => {
    if (!agent) return;
    setSubmitting(true);
    try {
      const response = await fetchWithAuth(`/api/agents/${agent.id}/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          mode,
          ...(needsTaskTarget ? { transferAgentId } : {}),
          ...(needsLeadsTarget ? { transferLeadsAgentId } : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(data.error || "Failed to delete agent");
        return;
      }

      toast.success(
        fullDelete
          ? `${agent.name} deleted.`
          : `${removedRoleLabel} role removed. ${agent.name} is now an ${remainingRole}.`,
      );
      onCompleted({ scope });
      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting agent:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const optionClass = (selected: boolean) =>
    cn(
      "w-full cursor-pointer rounded-lg border p-3 text-left transition-colors",
      selected ? "border-primary bg-primary/5" : "hover:bg-muted/50",
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            {fullDelete ? "Delete agent" : `Remove ${removedRoleLabel} role`}
          </DialogTitle>
          <DialogDescription>
            Choose what happens to <span className="font-medium">{agent?.name}</span>
            &apos;s work.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <>
              {summary && (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
                  {agentHasExecution && (
                    <p>
                      <span className="font-medium">Execution:</span> {executionWork}
                      <span className="text-muted-foreground">
                        {" "}· {summary.execution.completedTasks} completed task(s) stay as history
                      </span>
                    </p>
                  )}
                  {!agentHasExecution && summary.execution.openTasks > 0 && (
                    <p>
                      <span className="font-medium">Tasks:</span> {executionWork}
                    </p>
                  )}
                  {agentHasAdvisor && (
                    <p>
                      <span className="font-medium">Advisor:</span> {advisorWork}
                    </p>
                  )}
                </div>
              )}

              {isDual && (
                <div className="space-y-2">
                  <Label>What to delete</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(
                      [
                        ["agent", "Whole agent", "Both roles"],
                        ["execution", "Execution role", "Stays as Advisor"],
                        ["advisor", "Advisor role", "Stays as Execution"],
                      ] as const
                    ).map(([value, title, hint]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setScope(value);
                          setTransferAgentId("");
                          setTransferLeadsAgentId("");
                        }}
                        className={optionClass(scope === value)}
                      >
                        <span className="block text-sm font-medium">{title}</span>
                        <span className="block text-xs text-muted-foreground">{hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setMode("soft-delete")}
                  className={optionClass(mode === "soft-delete")}
                >
                  <span className="block text-sm font-medium">
                    {fullDelete ? "Soft delete the agent" : `Remove the role and hide its work`}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {fullDelete
                      ? `The agent is hidden and recoverable. Their ${workText} are hidden with them, and all come back if the agent is restored.`
                      : `${agent?.name} stays active as an ${remainingRole}. Their ${workText} are hidden, and come back if the role is restored from the agent's page.`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("transfer")}
                  className={optionClass(mode === "transfer")}
                >
                  <span className="block text-sm font-medium">
                    {fullDelete ? "Transfer work, then delete" : "Transfer work, then remove the role"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Their {workText} move to the agent(s) you pick, so the work stays live.
                    Restoring later does not move it back.
                  </span>
                </button>
              </div>

              {needsTaskTarget && (
                <div className="space-y-2">
                  <Label htmlFor="transfer-tasks-agent">Transfer tasks to *</Label>
                  <SearchableSelect
                    id="transfer-tasks-agent"
                    value={transferAgentId}
                    onChange={setTransferAgentId}
                    options={executionOptions}
                    placeholder="Select an execution agent..."
                    searchPlaceholder="Search agents..."
                    emptyText="No eligible execution agent (same or higher rank)."
                  />
                </div>
              )}

              {needsLeadsTarget && (
                <div className="space-y-2">
                  <Label htmlFor="transfer-leads-agent">
                    {agentHasExecution ? "Transfer leads to *" : "Transfer leads and tasks to *"}
                  </Label>
                  <SearchableSelect
                    id="transfer-leads-agent"
                    value={transferLeadsAgentId}
                    onChange={setTransferLeadsAgentId}
                    options={advisorOptions}
                    placeholder="Select an advisor agent..."
                    searchPlaceholder="Search agents..."
                    emptyText="No eligible advisor agent."
                  />
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
            variant="destructive"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="cursor-pointer"
          >
            {submitting
              ? "Working..."
              : fullDelete
                ? mode === "transfer"
                  ? "Transfer & delete"
                  : "Delete agent"
                : mode === "transfer"
                  ? "Transfer & remove role"
                  : "Remove role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
