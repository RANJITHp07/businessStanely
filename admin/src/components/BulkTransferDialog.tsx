"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import SearchableSelect from "@/components/SearchableSelect";
import { canOwnLeads, getAdvisorType } from "@/lib/agentRole";
import type { Agent } from "@/types";

interface BulkTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "lead" | "opportunity";
  ids: string[];
  /** Assigned advisor name of each selected row, for the "from" breakdown. */
  currentAssignees: (string | undefined)[];
  onTransferred: () => void;
}

/**
 * Picks a target advisor and moves the selected leads or opportunities to
 * them through /api/prospects/bulk-transfer.
 */
export default function BulkTransferDialog({
  open,
  onOpenChange,
  kind,
  ids,
  currentAssignees,
  onTransferred,
}: BulkTransferDialogProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [toAgentId, setToAgentId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const noun = kind === "lead" ? "lead" : "opportunity";
  const nounPlural = kind === "lead" ? "leads" : "opportunities";

  useEffect(() => {
    if (!open) {
      setToAgentId("");
      return;
    }
    if (agents.length > 0) return;

    setLoadingAgents(true);
    fetch("/api/agents")
      .then((res) => res.json())
      .then((data) => {
        setAgents(Array.isArray(data) ? data.filter(canOwnLeads) : []);
      })
      .catch(() => toast.error("Failed to load advisors"))
      .finally(() => setLoadingAgents(false));
  }, [open, agents.length]);

  const fromBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const name of currentAssignees) {
      const key = name || "Unassigned";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [currentAssignees]);

  const options = agents.map((agent) => ({
    value: agent.id,
    label: agent.name,
    description: getAdvisorType(agent) ?? undefined,
  }));

  const handleTransfer = async () => {
    if (!toAgentId || ids.length === 0) return;

    try {
      setSubmitting(true);
      const res = await fetch("/api/prospects/bulk-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toAgentId,
          ...(kind === "lead" ? { prospectIds: ids } : { opportunityIds: ids }),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data?.error || `Failed to transfer ${nounPlural}`);
        return;
      }

      const s = data.summary;
      const parts = [
        kind === "lead"
          ? `Transferred ${s.leadsTransferredCount} lead(s) to ${s.toAgentName}.`
          : `Transferred ${s.opportunitiesTransferredCount} opportunity(ies) to ${s.toAgentName}.`,
      ];
      if (s.alreadyAssignedCount > 0) {
        parts.push(`${s.alreadyAssignedCount} already assigned to them.`);
      }
      if (s.notFoundCount > 0) {
        parts.push(`${s.notFoundCount} no longer exist.`);
      }
      toast.success(parts.join(" "));

      onOpenChange(false);
      onTransferred();
    } catch {
      toast.error(`Failed to transfer ${nounPlural}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Transfer {ids.length} {ids.length === 1 ? noun : nounPlural}
          </DialogTitle>
          <DialogDescription>
            Reassign the selected {nounPlural} to another Client Advisor. The
            creator is not changed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Currently assigned to</Label>
            <ul className="max-h-32 overflow-y-auto rounded-md border bg-slate-50 p-3 text-sm space-y-1">
              {fromBreakdown.map(([name, count]) => (
                <li key={name} className="flex justify-between gap-4">
                  <span className="truncate">{name}</span>
                  <span className="text-muted-foreground">{count}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-transfer-agent">Transfer to *</Label>
            <SearchableSelect
              id="bulk-transfer-agent"
              value={toAgentId}
              onChange={setToAgentId}
              options={options}
              placeholder={loadingAgents ? "Loading advisors..." : "Select an advisor"}
              searchPlaceholder="Search advisors..."
              emptyText="No advisor found."
              disabled={loadingAgents || submitting}
            />
          </div>

          {kind === "opportunity" && (
            <p className="text-xs text-muted-foreground">
              An opportunity follows its lead&apos;s advisor, so any other
              opportunity on the same lead moves too.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={!toAgentId || submitting || ids.length === 0}
            onClick={handleTransfer}
          >
            {submitting ? "Transferring..." : "Transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
