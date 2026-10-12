import { useEffect, useState } from "react";

// Agent.hiddenSidebarItems holds the sidebar routes (e.g. "/timesheet") an
// admin has hidden for this agent. Keys must match the urls in
// components/app-sidebar.tsx and admin/src/lib/agentSidebarItems.ts.

export function isRouteHidden(pathname: string, hiddenItems: string[]): boolean {
  return hiddenItems.some(
    (url) => pathname === url || pathname.startsWith(`${url}/`),
  );
}

function readCachedHiddenItems(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const agent = JSON.parse(localStorage.getItem("agent") || "null");
    return Array.isArray(agent?.hiddenSidebarItems) ? agent.hiddenSidebarItems : [];
  } catch {
    return [];
  }
}

/**
 * Sidebar routes hidden for the logged-in agent. Starts from the copy cached
 * in localStorage at login (so hidden items don't flash in), then refreshes
 * from the server so admin changes apply without logging in again.
 */
export function useHiddenSidebarItems(): string[] {
  const [hiddenItems, setHiddenItems] = useState<string[]>(readCachedHiddenItems);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.agent) return;
        const items: string[] = Array.isArray(data.agent.hiddenSidebarItems)
          ? data.agent.hiddenSidebarItems
          : [];
        setHiddenItems(items);
        try {
          const cached = JSON.parse(localStorage.getItem("agent") || "null");
          if (cached) {
            localStorage.setItem(
              "agent",
              JSON.stringify({ ...cached, hiddenSidebarItems: items }),
            );
          }
        } catch {
          // Cache is a convenience only.
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return hiddenItems;
}
