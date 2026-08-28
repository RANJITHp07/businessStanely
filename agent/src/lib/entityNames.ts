/**
 * Human-readable labels captured into the audit trail at write time.
 *
 * The audit stores a name alongside the id so a row stays identifiable after it
 * is edited or its parent disappears. Models without a single `name` column need
 * a rule for what to show.
 */

export function clientDisplayName(client: {
  clientType?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  organizationName?: string | null;
  email?: string | null;
}): string {
  const individual = [client.firstName, client.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    client.organizationName?.trim() ||
    individual ||
    client.email ||
    "Unnamed client"
  );
}

/** Comments have no title, so the audit shows a trimmed snippet of the body. */
export function commentDisplayName(comment: { content?: string | null }): string {
  const content = (comment.content ?? "").trim().replace(/\s+/g, " ");
  if (!content) return "Empty comment";
  return content.length > 80 ? `${content.slice(0, 77)}...` : content;
}

/** Time logs are identified by their date and hours. */
export function timeLogDisplayName(log: {
  date?: Date | null;
  hours?: number | null;
}): string {
  const date = log.date ? new Date(log.date).toISOString().slice(0, 10) : "no date";
  return `${date} - ${log.hours ?? 0}h`;
}

/** Diary entries fall back to the date when the heading is blank. */
export function diaryDisplayName(entry: {
  heading?: string | null;
  title?: string | null;
  entryDate?: string | null;
}): string {
  return (
    entry.heading?.trim() ||
    entry.title?.trim() ||
    entry.entryDate ||
    "Diary entry"
  );
}
