"use client";

import "../globals.css";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Navigator from "@/components/navigator";
import { ToastContainer } from "react-toastify";
import { AuthGuard } from "@/components/AuthGuard";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // <AuthGuard>
    <div className={`overflow-auto flex w-full`}>
      <SidebarProvider>
        <AppSidebar />
        <main className="flex flex-col flex-1">
          <div className="flex gap-[20px] items-center py-[20px] p-6 md:pl-[20px] md:py-[15px] border-b">
            <Navigator />
            <div className="flex justify-between items-center flex-1 pr-4">
              <h1 className="text-[25px] block md:hidden">
                Business Stanely
              </h1>
              <SidebarTrigger />
            </div>
          </div>

          <div className="w-full  flex-1 bg-[#e3f2fd]">{children}</div>
        </main>
      </SidebarProvider>
      <ToastContainer />
    </div>
    // </AuthGuard>
  );
}
