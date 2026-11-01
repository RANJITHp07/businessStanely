"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { stripDailyTrackPrefix } from "@/lib/dailyTrack";

export interface DailyTrackNote {
  id: string;
  authorType: string;
  content: string;
  createdAt: string | Date;
  updatedAt?: string | Date;
  user?: { username?: string } | null;
  agent?: { name?: string } | null;
}

const istDay = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const istTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function authorName(note: DailyTrackNote) {
  return note.authorType === "USER"
    ? note.user?.username || "Unknown User"
    : note.agent?.name || "Former Agent";
}

/** Daily track notes of a task, newest first, one card per note. */
export function DailyTrackList({
  notes,
  emptyText = "No daily track yet.",
}: {
  notes: DailyTrackNote[];
  emptyText?: string;
}) {
  if (notes.length === 0) {
    return <p className="text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => {
        const name = authorName(note);
        const created = new Date(note.createdAt);
        const edited =
          note.updatedAt &&
          new Date(note.updatedAt).getTime() - created.getTime() > 60_000;
        return (
          <div
            key={note.id}
            className="flex items-start gap-3 rounded-lg border-l-4 border-l-blue-400 bg-blue-50/60 p-4 dark:bg-blue-950/20"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{name}</span>
                <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                  {istDay.format(created)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {istTime.format(created)}
                  {edited ? " · edited" : ""}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm">
                {stripDailyTrackPrefix(note.content)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
