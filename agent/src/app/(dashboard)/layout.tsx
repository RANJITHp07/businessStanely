"use client";

import "../globals.css";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Navigator from "@/components/navigator";
import { ToastContainer } from "react-toastify";
import { AuthGuard } from "@/components/AuthGuard";
import AuthSessionTimeout from "@/components/AuthSessionTimeout";
import { Plus, FileText, User, Layers, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Link from "next/link";
import { useState } from "react";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleClose = () => setPopoverOpen(false);

  return (
    <AuthGuard>
      <AuthSessionTimeout />
      <div className="overflow-auto flex w-full">
        <SidebarProvider>
          <AppSidebar />
          <main className="flex flex-col flex-1 min-w-0">
            <div className="flex gap-[20px] items-center py-[20px] p-6 md:pl-[20px] md:py-[15px] border-b">
              <Navigator />
              <div className="flex justify-between items-center flex-1 pr-4">
                <h1 className="text-[25px] block md:hidden">LegalStanley</h1>
                <SidebarTrigger />
              </div>
            </div>

            <div className="w-full flex-1 bg-[#e3f2fd] relative">
              {children}

              <div className="fixed bottom-6 right-6 z-50">
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button className="bg-blue-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors">
                      <Plus className="w-6 h-6" />
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent
                    className="w-56 p-2 rounded-lg shadow-xl bg-white"
                    align="end"
                    side="left"
                  >
                    <div className="flex flex-col gap-1">
                      <Link
                        href="/task/create"
                        onClick={handleClose}
                        className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-blue-100 border-b font-medium"
                      >
                        <FileText className="w-4 h-4" />
                        Create Task
                      </Link>
                      <Link
                        href="/client/create"
                        onClick={handleClose}
                        className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-blue-100 border-b font-medium"
                      >
                        <User className="w-4 h-4" />
                        Create Client
                      </Link>
                      <Link
                        href="/task_category/create"
                        onClick={handleClose}
                        className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-blue-100 border-b font-medium"
                      >
                        <Layers className="w-4 h-4" />
                        Create Service
                      </Link>
                      <Link
                        href="/retainership/create"
                        onClick={handleClose}
                        className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-blue-100 border-b font-medium"
                      >
                        <Users className="w-4 h-4" />
                        Create Retainership
                      </Link>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </main>
        </SidebarProvider>
        <ToastContainer />
      </div>
    </AuthGuard>
  );
}
