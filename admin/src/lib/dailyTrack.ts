import { FOLLOW_UP_STATUS } from "@/lib/taskFollowUp";

/**
 * Day track: a short note an agent leaves once per day on every In Progress
 * task assigned to them. It is stored as an ordinary task Comment whose content
 * starts with DAILY_TRACK_PREFIX, the same way "[NORMAL]" and "[CLIENT_UPDATE]"
 * mark the other comment types. Agents write these from the agent app (which
 * keeps its own copy of this file); the admin app only reads them to list who
 * has not tracked their tasks.
 */
export const DAILY_TRACK_PREFIX = "[DAILY_TRACK]";

/**
 * DAILY_TRACK_PREFIX for Prisma `startsWith` filters. On MongoDB Prisma turns
 * startsWith into an unescaped regex, so the bare prefix would be read as the
 * character class [DAILY_TRACK] and match any comment starting with one of
 * those letters.
 */
export const DAILY_TRACK_MATCH = "\\[DAILY_TRACK\\]";

export const DAILY_TRACK_STATUSES = ["In Progress", "in progress", FOLLOW_UP_STATUS];

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The IST calendar date ("YYYY-MM-DD") that `at` falls on. */
export function istDateKey(at: Date = new Date()): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** [start, end) of the IST day named by `dateKey`, or null when malformed. */
export function istDayRange(dateKey: string): { start: Date; end: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const start = new Date(`${dateKey}T00:00:00+05:30`);
  if (isNaN(start.getTime())) return null;
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

export function isDailyTrackContent(content?: string | null): boolean {
  return !!content?.startsWith(DAILY_TRACK_PREFIX);
}

export function stripDailyTrackPrefix(content: string): string {
  return content.slice(DAILY_TRACK_PREFIX.length).trimStart();
}
