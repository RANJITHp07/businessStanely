"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  firstVisiblePath,
  isPathHidden,
  sanitizeHiddenSidebarItems,
} from "@/lib/sidebarAccess";

const HiddenSidebarItemsContext = createContext<string[]>([]);

/** URLs of the sidebar items an admin has hidden for the signed-in agent. */
export function useHiddenSidebarItems() {
  return useContext(HiddenSidebarItemsContext);
}

function readStoredAgent() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem("agent") || "null");
  } catch {
    return null;
  }
}

/**
 * Supplies the hidden items and sends the agent away from a hidden page. Starts
 * from the copy saved at login, then re-reads the server on every navigation so
 * an admin's change applies without the agent logging in again.
 *
 * This only guards pages. The APIs behind them stay open.
 */
export function SidebarAccessProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [access, setAccess] = useState(() => {
    const stored = readStoredAgent();
    return {
      hidden: sanitizeHiddenSidebarItems(stored?.hiddenSidebarItems),
      role: (stored?.agentRole ?? null) as string | null,
    };
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.agent) return;
        const hidden = sanitizeHiddenSidebarItems(data.agent.hiddenSidebarItems);
        setAccess({ hidden, role: data.agent.agentRole ?? null });
        const stored = readStoredAgent();
        if (stored) {
          localStorage.setItem(
            "agent",
            JSON.stringify({ ...stored, hiddenSidebarItems: hidden }),
          );
        }
      })
      .catch((error) => console.error("Error loading sidebar access:", error));
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const blocked = isPathHidden(pathname, access.hidden);

  useEffect(() => {
    if (blocked) router.replace(firstVisiblePath(access.role, access.hidden));
  }, [blocked, access, router]);

  return (
    <HiddenSidebarItemsContext.Provider value={access.hidden}>
      {blocked ? null : children}
    </HiddenSidebarItemsContext.Provider>
  );
}
