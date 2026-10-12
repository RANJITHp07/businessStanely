// Sidebar sections of the agent portal that an admin can hide per agent.
// Keys are the agent portal routes and are stored in Agent.hiddenSidebarItems,
// so keep them in sync with agent/src/components/app-sidebar.tsx.
export type AgentSidebarGroup = "execution" | "sales" | "common";

export type AgentSidebarItem = {
  key: string;
  label: string;
  group: AgentSidebarGroup;
};

export const AGENT_SIDEBAR_ITEMS: AgentSidebarItem[] = [
  { key: "/dashboard", label: "Dashboard", group: "execution" },
  { key: "/my-task", label: "Task", group: "execution" },
  { key: "/assigned-tasks", label: "Assigned Tasks", group: "execution" },
  { key: "/client", label: "Client", group: "execution" },
  { key: "/timesheet", label: "Time sheet", group: "execution" },
  { key: "/task_category", label: "Services", group: "execution" },
  { key: "/retainership", label: "Retainership", group: "execution" },
  { key: "/sales/dashboard", label: "Sales Dashboard", group: "sales" },
  { key: "/sales/prospects", label: "Leads", group: "sales" },
  { key: "/sales/opportunites", label: "Opportunities", group: "sales" },
  { key: "/sales/calendar", label: "Calendar", group: "sales" },
  { key: "/sales/client", label: "Client Details", group: "sales" },
  { key: "/team", label: "Team", group: "common" },
  { key: "/request-quote", label: "Request Quote", group: "common" },
  { key: "/service-records", label: "Instructions and Service Records", group: "common" },
  { key: "/my-diary", label: "My Diary", group: "common" },
  { key: "/whatsapp", label: "WhatsApp", group: "common" },
];

export const AGENT_SIDEBAR_GROUP_LABELS: Record<AgentSidebarGroup, string> = {
  execution: "Execution Panel",
  sales: "Sales Panel",
  common: "Common",
};
