"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface RestoreAgentDialogProps {
  agent: { id: string; name: string } | null;
  /** "role" restores a removed role on an active agent; "agent" a deleted agent. */
  kind: "agent" | "role";
  /** For kind "role": the role that was removed, e.g. "Advisor". */
  roleLabel?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored: () => void;
}

/** Confirms and runs POST /api/agents/[id]/restore. */
export default function RestoreAgentDialog({
  agent,
  kind,
  roleLabel,
  open,
  onOpenChange,
  onRestored,
}: RestoreAgentDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleRestore = async () => {
    if (!agent) return;
    setSubmitting(true);
    try {
      const response = await fetchWithAuth(`/api/agents/${agent.id}/restore`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error || "Failed to restore");
        return;
      }
      toast.success(
        kind === "agent"
          ? `${agent.name} restored.`
          : `${roleLabel} role restored for ${agent.name}.`,
      );
      onRestored();
      onOpenChange(false);
    } catch (error) {
      console.error("Error restoring agent:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {kind === "agent" ? `Restore ${agent?.name}?` : `Restore ${roleLabel} role?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {kind === "agent"
              ? "The agent becomes active again and can log in with their original email."
              : `${agent?.name} becomes a dual-role agent again.`}{" "}
            Work that was hidden by the delete comes back. Work that was
            transferred stays with the agent it was moved to, and team links
            that were moved or removed are not put back.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <Button onClick={handleRestore} disabled={submitting} className="cursor-pointer">
            {submitting ? "Restoring..." : "Restore"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
