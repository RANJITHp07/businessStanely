"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import { DAILY_TRACK_STATUSES } from "@/lib/dailyTrack";
import { isFollowUpTask, needsDayTrackOn } from "@/lib/taskFollowUp";

export interface DailyTrackEntry {
  id: string;
  note: string;
  updatedAt: string;
}

export type DailyTrackEntries = Record<string, DailyTrackEntry>;

/**
 * Task fields the save changed. A follow-up's first note of the day restarts
 * its wait, so followUpUntil moves and the row belongs to the Followups group.
 */
export type DailyTrackTaskPatch = { followUpUntil?: string | null };

/**
 * Today's day track notes for the signed-in agent. Pass `enabled: false` from
 * tables that never show the checkbox so they skip the request.
 */
export function useDailyTrack(enabled = true) {
  const [entries, setEntries] = useState<DailyTrackEntries>({});

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithAuth("/api/daily-track", { silent401: true });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setEntries(data.entries ?? {});
      } catch (error) {
        console.error("Failed to load day track", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const setEntry = useCallback((taskId: string, entry: DailyTrackEntry) => {
    setEntries((prev) => ({ ...prev, [taskId]: entry }));
  }, []);

  return { entries, setEntry };
}

/** Whether a row should offer the day track checkbox to this agent. */
export function needsDailyTrack(
  task: {
    status: string;
    followUpDuration?: string | null;
    followUpUntil?: Date | string | null;
    active?: boolean | null;
    assignedTo?: { id: string } | null;
  },
  agentId?: string | null,
) {
  return (
    !!agentId &&
    task.assignedTo?.id === agentId &&
    DAILY_TRACK_STATUSES.includes(task.status) &&
    needsDayTrackOn(task)
  );
}

/** Tells the agent a follow-up task's day track falls on today. */
export function DailyTrackDueNotice({
  task,
  agentId,
  done,
}: {
  task: Parameters<typeof needsDailyTrack>[0];
  agentId?: string | null;
  done?: boolean;
}) {
  if (done || !isFollowUpTask(task) || !needsDailyTrack(task, agentId)) return null;
  return (
    <span className="mt-1 inline-block w-fit rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
      Day track due today
    </span>
  );
}

/**
 * Checkbox at the start of an In Progress row. Clicking it opens a small note
 * box anchored to the cell, like a spreadsheet comment; saving ticks the box
 * for the rest of the day. Clicking a ticked box reopens today's note to edit.
 * `onTaskChanged` receives the task fields the save moved, so the table can
 * re-section a follow-up without a reload.
 */
export function DailyTrackCell({
  taskId,
  entry,
  onSaved,
  onTaskChanged,
}: {
  taskId: string;
  entry?: DailyTrackEntry;
  onSaved: (taskId: string, entry: DailyTrackEntry) => void;
  onTaskChanged?: (taskId: string, patch: DailyTrackTaskPatch) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setNote(entry?.note ?? "");
      setError(null);
    }
    setOpen(next);
  };

  const save = async () => {
    if (!note.trim()) {
      setError("Write a short update first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/daily-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save the day track.");
        return;
      }
      onSaved(taskId, data.entry);
      if (data.task) onTaskChanged?.(taskId, data.task);
      setOpen(false);
    } catch {
      setError("Could not save the day track.");
    } finally {
      setSaving(false);
    }
  };

  const tracked = !!entry;

  return (
    <div
      className="flex items-center justify-center"
      onClick={(e) => e.stopPropagation()}
    >
      <Popover open={open} onOpenChange={handleOpenChange}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Checkbox
                // Controlled with no change handler: a click only opens the
                // note box, and the box ticks once a note is saved.
                checked={tracked}
                aria-label={tracked ? "Edit today's day track" : "Add today's day track"}
                className={tracked ? "" : "border-blue-500"}
              />
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent sideOffset={6}>
            {tracked ? "Day track added today" : "Add today's day track"}
          </TooltipContent>
        </Tooltip>
        <PopoverContent
          align="start"
          side="right"
          className="w-80 border-l-4 border-l-blue-400 bg-blue-50 p-3"
        >
          <div className="space-y-2">
            <p className="text-sm font-semibold text-blue-900">Day track</p>
            <Textarea
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  save();
                }
              }}
              placeholder="What's the update today?"
              className="min-h-[90px] bg-white text-sm"
            />
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={save}
                disabled={saving}
                className="bg-[#003459] hover:bg-[#003459] text-white"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
