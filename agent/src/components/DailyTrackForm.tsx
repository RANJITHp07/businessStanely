"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import type { DailyTrackEntry, DailyTrackTaskPatch } from "@/components/DailyTrackCell";

/**
 * Today's day track note box on the task detail page. `todayNote` is the
 * note the agent already saved today, if any; saving again rewrites it, the
 * same as the checkbox in the task tables.
 */
export function DailyTrackForm({
  taskId,
  todayNote,
  onSaved,
}: {
  taskId: string;
  todayNote?: string;
  onSaved: (entry: DailyTrackEntry, task?: DailyTrackTaskPatch) => void;
}) {
  const [note, setNote] = useState(todayNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNote(todayNote ?? "");
  }, [todayNote]);

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
      onSaved(data.entry, data.task);
    } catch {
      setError("Could not save the day track.");
    } finally {
      setSaving(false);
    }
  };

  const unchanged = note.trim() === (todayNote ?? "").trim();

  return (
    <div className="space-y-2 rounded-lg border-l-4 border-l-blue-400 bg-blue-50 p-4 dark:bg-blue-950/20">
      <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
        {todayNote ? "Today's day track (saved)" : "Add today's day track"}
      </p>
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
          }
        }}
        placeholder="What's the update today?"
        className="min-h-[90px] bg-white text-sm dark:bg-background"
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={saving || !note.trim() || unchanged}
          className="bg-[#003459] hover:bg-[#003459] text-white"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : todayNote ? (
            "Update"
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </div>
  );
}
