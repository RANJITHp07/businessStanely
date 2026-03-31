"use client";

import {
  ClipboardCheck,
  Home,
  LogOut,
  Settings,
  UserRoundPen,
  Boxes,
  ClipboardList,
  UserSearch,
  FileText,
  Calendar
} from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Image from "next/image";
import Logo from "./../../public/Logo.jpg";
import { hasAdvisorRole, hasExecutionRole, EXECUTION_AND_ADVISOR_AGENT_ROLE } from "@/lib/agentRole";
import { getAdvisorAgentType } from "@/lib/agentType";

type MenuItem = {
  title: string;
  url: string;
  icon: typeof Home;
};

const salesItems: MenuItem[] = [
  {
    title: "Sales Dashboard",
    url: "/sales/dashboard",
    icon: Home,
  },
  {
    title: "Leads",
    url: "/sales/prospects",
    icon: UserSearch,
  },
  {
    title: "Opportunities",
    url: "/sales/opportunites",
    icon: ClipboardList,
  },
  {
    title: "Calendar",
    url: "/sales/calendar",
    icon: Calendar,
  },
  {
    title: "Client Details",
    url: "/sales/client",
    icon: UserRoundPen,
  },
  {
    title: "Team",
    url: "/team",
    icon: UserRoundPen,
  },
  {
    title: "Request Quote",
    url: "/request-quote",
    icon: FileText,
  },
];


const dashboardItems: MenuItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
  },
  {
    title: "Team",
    url: "/team",
    icon: UserRoundPen,
  },
  {
    title: "Task",
    url: "/my-task",
    icon: ClipboardCheck,
  },
  {
    title: "Client",
    url: "/client",
    icon: UserSearch,
  },
  {
    title: "Time sheet",
    url: "/timesheet",
    icon: ClipboardList,
  },
  {
    title: "Services",
    url: "/task_category",
    icon: Boxes,
  },
  {
    title: "Retainership",
    url: "/retainership",
    icon: Boxes,
  },
  {
    title: "Request Quote",
    url: "/request-quote",
    icon: FileText,
  },
];

const commonItems: MenuItem[] = [
  {
    title: "Service Records",
    url: "/service-records",
    icon: FileText,
  },
  {
    title: "My Diary",
    url: "/my-diary",
    icon: UserRoundPen,
  },
  {
    title: "Settings",
    url: "/setting",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();

  const { agentRole, agentType } = useMemo(() => {
    if (typeof window === "undefined") {
      return { agentRole: null as string | null, agentType: null as string | null };
    }

    try {
      const agentLS = localStorage.getItem("agent");
      if (!agentLS) {
        return { agentRole: null as string | null, agentType: null as string | null };
      }

      const agentObj = JSON.parse(agentLS);
      return {
        agentRole: agentObj.agentRole ?? null,
        agentType: getAdvisorAgentType(agentObj) || agentObj.agentType || null,
      };
    } catch {
      return { agentRole: null as string | null, agentType: null as string | null };
    }
  }, []);

  const isDualRole = agentRole === EXECUTION_AND_ADVISOR_AGENT_ROLE;
  const showExecutionPanel = hasExecutionRole(agentRole);
  const showSalesPanel = hasAdvisorRole(agentRole);

  const visibleSalesItems = useMemo(() => {
    const advisorItems = showExecutionPanel
      ? salesItems.filter((item) => item.title !== "Team")
      : salesItems;

    if (agentType === "Client Advisor") {
      const clientAdvisorTitles = [
        "Sales Dashboard",
        "Leads",
        "Opportunities",
        "Calendar",
        "Client Details",
      ];

      return clientAdvisorTitles
        .map((title) => advisorItems.find((item) => item.title === title))
        .filter((item): item is MenuItem => Boolean(item));
    }

    if (agentType === "Lead Maker") {
      return advisorItems.filter((item) => item.title !== "Calendar");
    }

    return advisorItems;
  }, [agentType, showExecutionPanel]);

  const singleRoleItems = useMemo(() => {
    if (isDualRole) {
      return [] as MenuItem[];
    }

    if (showExecutionPanel) {
      return [...dashboardItems, ...commonItems];
    }

    if (showSalesPanel) {
      if (agentType === "Client Advisor") {
        const clientAdvisorCommonItems = commonItems.filter(
          (item) => item.title === "Service Records" || item.title === "Settings",
        );
        return [...visibleSalesItems, ...clientAdvisorCommonItems];
      }

      return [...visibleSalesItems, ...commonItems];
    }

    return [...commonItems];
  }, [isDualRole, showExecutionPanel, showSalesPanel, visibleSalesItems]);

  const renderItems = (items: MenuItem[]) =>
    items.map((item) => {
      const isActive =
        pathname === item.url ||
        (item.url !== "/dashboard" && pathname.startsWith(`${item.url}/`));

      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild>
            <Link
              href={item.url}
              onClick={() => isMobile && setOpenMobile(false)}
              className={`flex items-center gap-2 ${isActive ? "bg-white text-primary" : "hover:bg-white hover:text-primary"}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[16px]">{item.title}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  const handleLogout = async () => {
    try {
      // Clear localStorage immediately to prevent flash
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("agent");

      // Call logout API to clear server-side cookie
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      // Force page reload to ensure clean state
      window.location.replace("/login");
    } catch (error) {
      console.error("Logout error:", error);
      // Even if API fails, localStorage is already cleared
      window.location.replace("/login");
    } finally {
      setShowLogoutDialog(false);
    }
  };

  return (
    <>
      <Sidebar className="hidden md:flex flex-shrink-0">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="mt-[10px] ">
              <Image src={Logo} alt="logo" />
            </SidebarGroupLabel>
          </SidebarGroup>

          {!isDualRole && (
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu className="mt-[30px]">
                  {renderItems(singleRoleItems)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {isDualRole && showExecutionPanel && (
            <SidebarGroup>
              <SidebarGroupLabel className="text-[16px] mt-[30px] text-white py-5 px-3 -ml-4 rounded-none border-b border-t border-white font-medium">
                Execution Panel
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="mt-[8px]">
                  {renderItems(dashboardItems)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {isDualRole && showSalesPanel && (
            <SidebarGroup>
              <SidebarGroupLabel className="text-[16px] text-white py-5 px-3 -ml-4 rounded-none border-b border-t border-white font-medium">
                Sales Panel
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="mt-[8px]">
                  {renderItems(visibleSalesItems)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {isDualRole && (
            <SidebarGroup>
              <SidebarGroupLabel className="text-[16px] text-white py-5 px-3 -ml-4 rounded-none border-b border-t border-white font-medium">
                Common
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="mt-[8px]">
                  {renderItems(commonItems)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setShowLogoutDialog(true)}
                    className="flex items-center gap-[5px] mb-[20px] px-3 py-2 rounded-md text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-200"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="text-[18px] font-semibold bg-gradient-to-r from-red-500 to-pink-500 bg-clip-text text-transparent hover:scale-105 transition-transform duration-200">
                      Logout
                    </span>
                  </SidebarMenuButton>

                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarFooter>
      </Sidebar>

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to logout? You will need to sign in again to
              access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowLogoutDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700"
            >
              Logout
            </AlertDialogAction>


          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}