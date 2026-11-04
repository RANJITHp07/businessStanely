/**
 * For lists shown as "newest few rows per status, plus each status's size".
 * `rows` must be sorted newest first. Returns the size of every status and the
 * ids of the rows worth loading in full.
 */
export function firstRowsPerStatus(
  rows: { id: string; status: string }[],
  limit: number,
) {
  const statusCounts: Record<string, number> = {};
  const ids: string[] = [];
  for (const { id, status } of rows) {
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    if (statusCounts[status] <= limit) ids.push(id);
  }
  return { statusCounts, ids };
}
