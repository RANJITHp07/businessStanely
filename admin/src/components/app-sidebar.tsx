"use client";

import {
  ClipboardCheck,
  Home,
  LogOut,
  Settings,
  UserRoundPen,
  UserSearch,
  Boxes,
  ShieldUser,
  ChevronDown,
  ClipboardList,
  CircleFadingPlusIcon
} from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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

import Logo from "./../../public/Logo.jpg";

type ChildItem = {
  title: string;
  url: string;
  icon: any;
};

type MenuItem = {
  title: string;
  icon: any;
  url?: string;
  children?: ChildItem[];
};

const items: MenuItem[] = [
  {
    title: "Dashboard",
    icon: Home,
    children: [
      { title: "Agents", url: "/dashboard", icon: UserRoundPen, },
      { title: "Prospects", url: "/dashboard/prospects", icon: UserSearch },
      { title: "Opportunites", url: "/dashboard/opportunities", icon: ClipboardList },
    ],
  },
  {
    title: "Agent",
    url: "/agent",
    icon: UserRoundPen,
  },
  {
    title: "Client",
    url: "/client",
    icon: UserSearch,
  },
  {
    title: "Task",
    url: "/my-task",
    icon: ClipboardCheck,
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
    title: "Lead Source",
    url: "/lead_source",
    icon: CircleFadingPlusIcon,
  },
  {
    title: "Admin",
    url: "/admin",
    icon: ShieldUser,
  },
  {
    title: "Settings",
    url: "/setting",
    icon: Settings,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const { setOpenMobile, isMobile } = useSidebar();

  useEffect(() => {
    items.forEach((item) => {
      if (item.children?.some((child) => pathname.startsWith(child.url))) {
        setOpenMenus((prev) => ({
          ...prev,
          [item.title]: true,
        }));
      }
    });
  }, [pathname]);

  const toggleMenu = (title: string) => {
    setOpenMenus((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      window.location.replace("/login");
    } catch {
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
            <SidebarGroupLabel className="mt-[10px]">
              <Image src={Logo} alt="logo" />
            </SidebarGroupLabel>

            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const isParentActive =
                    item.children?.some((c) => pathname.startsWith(c.url)) ||
                    pathname === item.url;

                  return (
                    <SidebarMenuItem key={item.title}>
                      {item.children ? (
                        <>
                          <button
                            onClick={() => toggleMenu(item.title)}
                            className={`flex w-full items-center justify-between  p-2 rounded-md transition ${isParentActive
                              ? ""
                              : "hover:bg-white hover:text-primary"
                              }`}
                          >
                            <div className="flex items-center gap-2">
                              <item.icon className="w-5 h-5" />
                              <span className="text-[16px]">{item.title}</span>
                            </div>
                            <ChevronDown
                              className={`w-5 h-5 transition-transform ${openMenus[item.title] ? "rotate-180" : ""
                                }`}
                            />
                          </button>

                          {openMenus[item.title] && (
                            <div className="ml-7 mt-1 space-y-1">
                              {item.children.map((child) => {
                                const isActive = pathname === child.url;

                                return (
                                  <SidebarMenuButton key={child.url} asChild>
                                    <Link
                                      href={child.url}
                                      onClick={() => {
                                        if (isMobile) setOpenMobile(false);
                                      }}
                                      className={`block px-3 py-2 text-[16px] my-2 rounded-md transition ${isActive
                                        ? "bg-white text-primary"
                                        : "hover:bg-white hover:text-primary"
                                        }`}
                                    >
                                      <child.icon className="w-5 h-5" />
                                      {child.title}
                                    </Link>
                                  </SidebarMenuButton>
                                );
                              })}
                            </div>
                          )}
                        </>
                      ) : (
                        <SidebarMenuButton asChild>
                          <Link
                            href={item.url!}
                            onClick={() => {
                              if (isMobile) setOpenMobile(false);
                            }}
                            className={`flex items-center gap-2 ${pathname === item.url
                              ? "bg-white text-primary"
                              : ""
                              }`}
                          >
                            <item.icon className="w-5 h-5" />
                            <span className="text-[16px]">{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setShowLogoutDialog(true)}
                className="flex items-center gap-2 mb-4 text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-[16px] font-semibold">Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to logout?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
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
