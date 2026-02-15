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
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

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
const salesItems = [
  {
    title: "Sales Dashboard",
    url: "/sales/dashboard",
    icon: Home,
  },
  {
    title: "Opportunities",
    url: "/sales/opportunites",
    icon: ClipboardList,
  },
  {
    title: "Leads",
    url: "/sales/prospects",
    icon: UserSearch,
  },
  {
    title: "Calendar",
    url: "/sales/calendar",
    icon: Calendar,
  },
  {
    title: "Client Detail",
    url: "/sales/client",
    icon: UserRoundPen,
  },
  {
    title: "Service Records",
    url: "/service-records",
    icon: FileText,
  },
  {
    title: "Settings",
    url: "/setting",
    icon: Settings,
  },
];


const dashboardItems = [
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
    title: "Service Records",
    url: "/service-records",
    icon: FileText,
  },
  {
    title: "Retainership",
    url: "/retainership",
    icon: Boxes,
  },
  {
    title: "Settings",
    url: "/setting",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  // Use agent info from localStorage (set at login/root redirect)
  let agentRole = null;
  let agentType = null;
  if (typeof window !== "undefined") {
    try {
      const agentLS = localStorage.getItem("agent");
      if (agentLS) {
        const agentObj = JSON.parse(agentLS);
        agentRole = agentObj.agentRole;
        agentType = agentObj.agentType;
      }
    } catch { }
  }

  let items = dashboardItems;
  if (agentRole === "Advisor Agent") {
    if (agentType === "Client Advisor" || agentType === "Client Manager") {
      items = salesItems;
    } else if (agentType === "Lead Maker") {
      items = salesItems.filter(item => item.title !== "Calendar");
    } else {
      items = salesItems;
    }
  }

  const handleLogout = async () => {
    try {
      // Clear localStorage immediately to prevent flash
      localStorage.removeItem("token");
      localStorage.removeItem("user");

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
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="mt-[10px] ">
              <Image src={Logo} alt="logo" />
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <Link href={item.url}>
                        <item.icon />
                        <span className="text-[16px]">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
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