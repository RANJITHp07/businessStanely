import prisma from "./prisma";
import type { AuditActor } from "./audit";

/** The diary fields whose before/after values are worth keeping. */
const TRACKED_FIELDS = ["entryDate", "heading", "content"] as const;

export type DiaryRevisionField = (typeof TRACKED_FIELDS)[number];

type DiarySnapshot = {
  entryDate?: string | null;
  heading?: string | null;
  content?: string | null;
};

export type DiaryRevision = {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  editedByType: string;
  editedByUsername: string;
  editedByEmail: string;
  createdAt: Date;
};

/**
 * Writes one revision row per field that actually changed.
 *
 * DeletionAudit records only which fields an UPDATE touched, so the values
 * themselves live here -- that is what makes an edit reviewable rather than
 * merely detectable. Saves that change nothing write nothing, so autosave
 * (which fires every couple of seconds while typing) cannot flood the log.
 *
 * Failures are swallowed by design: losing a history row must never cost the
 * user the edit they just made.
 */
export async function recordDiaryRevisions(params: {
  entryId: string;
  before: DiarySnapshot;
  after: DiarySnapshot;
  actor: AuditActor;
}): Promise<DiaryRevisionField[]> {
  const { entryId, before, after, actor } = params;

  const normalize = (value: string | null | undefined) =>
    value == null || value === "" ? null : value;

  const changed = TRACKED_FIELDS.filter(
    (field) => normalize(before[field]) !== normalize(after[field]),
  );

  if (changed.length === 0) return [];

  try {
    await prisma.clientDiaryRevision.createMany({
      data: changed.map((field) => ({
        entryId,
        field,
        oldValue: normalize(before[field]),
        newValue: normalize(after[field]),
        editedByType: actor.type,
        editedById: actor.id,
        editedByEmail: actor.email,
        editedByUsername: actor.username,
      })),
    });
  } catch (error) {
    console.error("Failed to record diary revisions:", error);
  }

  return changed;
}

/** The edit log for one entry, newest first. */
export async function fetchDiaryRevisions(
  entryId: string,
): Promise<DiaryRevision[]> {
  try {
    return (await prisma.clientDiaryRevision.findMany({
      where: { entryId },
      orderBy: { createdAt: "desc" },
    })) as DiaryRevision[];
  } catch (error) {
    console.error("Failed to load diary revisions:", error);
    return [];
  }
}
