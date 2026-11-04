// Which agent sidebar items an admin has hidden for an agent. Agent.hiddenSidebarItems
// stores the items' URLs, so an item added later stays visible to existing agents.
//
// Keep this file identical in `agent/src/lib` and `admin/src/lib`.

import { hasAdvisorRole, hasExecutionRole } from "@/lib/agentRole";

export interface HideableSidebarItem {
  key: string;
  title: string;
}

const EXECUTION_ITEMS: HideableSidebarItem[] = [
  { key: "/dashboard", title: "Dashboard" },
  { key: "/team", title: "Team" },
  { key: "/my-task", title: "Task" },
  { key: "/assigned-tasks", title: "Assigned Tasks" },
  { key: "/client", title: "Client" },
  { key: "/timesheet", title: "Time sheet" },
  { key: "/task_category", title: "Services" },
  { key: "/retainership", title: "Retainership" },
  { key: "/request-quote", title: "Request Quote" },
];

const SALES_ITEMS: HideableSidebarItem[] = [
  { key: "/sales/dashboard", title: "Sales Dashboard" },
  { key: "/sales/prospects", title: "Leads" },
  { key: "/sales/opportunites", title: "Opportunities" },
  { key: "/sales/calendar", title: "Calendar" },
  { key: "/sales/client", title: "Client Details" },
  { key: "/team", title: "Team" },
  { key: "/request-quote", title: "Request Quote" },
];

const COMMON_ITEMS: HideableSidebarItem[] = [
  { key: "/service-records", title: "Instructions and Service Records" },
  { key: "/my-diary", title: "My Diary" },
  { key: "/whatsapp", title: "WhatsApp" },
];

/** Never hideable, so every agent always has a page to land on. */
export const ALWAYS_VISIBLE_PATH = "/setting";

/**
 * Pages that belong to an item without sitting under its URL. /task/[id] is
 * left out on purpose: Assigned Tasks and other pages open tasks there.
 */
const RELATED_PATHS: Record<string, { exact?: string[]; prefix?: string[] }> = {
  "/my-task": { exact: ["/task"] },
  "/retainership": { prefix: ["/legislation"] },
};

const underPath = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`);

function uniqueItems(items: HideableSidebarItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

/** The hideable items an agent of `role` has, in sidebar order. */
export function sidebarItemsForRole(role?: string | null) {
  return uniqueItems([
    ...(hasExecutionRole(role) ? EXECUTION_ITEMS : []),
    ...(hasAdvisorRole(role) ? SALES_ITEMS : []),
    ...COMMON_ITEMS,
  ]);
}

/** Keeps only known hideable URLs, so bad input cannot hide Settings. */
export function sanitizeHiddenSidebarItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const known = new Set(
    [...EXECUTION_ITEMS, ...SALES_ITEMS, ...COMMON_ITEMS].map((item) => item.key),
  );
  return [...new Set(value)].filter(
    (key): key is string => typeof key === "string" && known.has(key),
  );
}

/** Whether `pathname` belongs to an item the agent has hidden. */
export function isPathHidden(pathname: string, hidden: string[]) {
  return hidden.some((key) => {
    if (underPath(pathname, key)) return true;
    const related = RELATED_PATHS[key];
    return (
      !!related?.exact?.includes(pathname) ||
      !!related?.prefix?.some((path) => underPath(pathname, path))
    );
  });
}

/** Where to send an agent away from a hidden page. WhatsApp opens in its own tab, so it is skipped. */
export function firstVisiblePath(role: string | null | undefined, hidden: string[]) {
  const first = sidebarItemsForRole(role).find(
    (item) => item.key !== "/whatsapp" && !hidden.includes(item.key),
  );
  return first?.key ?? ALWAYS_VISIBLE_PATH;
}
