import { useCallback, useState } from "react";

/**
 * Checkbox selection for a paginated table. Selection is kept by id so it
 * survives page changes; callers clear it when the filtered set changes.
 */
export function useRowSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Selects every id given, or deselects them all if all are already selected. */
  const toggleMany = useCallback((ids: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => setSelected(new Set(ids)), []);

  const clear = useCallback(() => setSelected(new Set()), []);

  return { selected, toggle, toggleMany, selectAll, clear };
}
