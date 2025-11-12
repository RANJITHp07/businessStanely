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
    <AuthGuard>
      {/* Constrain horizontal overflow at the app shell level and let main area scroll */}
      <div className={`flex w-full min-h-screen overflow-hidden`}>
        <SidebarProvider>
          <AppSidebar />
          {/* Make main content the scroll container and avoid horizontal overflow */}
          <main className="flex flex-col flex-1 min-w-0 overflow-auto">
            <div className="flex gap-[20px] items-center py-[20px] p-6 md:pl-[20px] md:py-[15px] border-b">
              <Navigator />
              <div className="flex justify-between items-center flex-1 pr-4">
                <h1 className="text-[25px] block md:hidden">
                  LegalStanley
                </h1>
                <SidebarTrigger />
              </div>
            </div>

            <div className="w-full flex-1 bg-[#e3f2fd] min-w-0">{children}</div>
          </main>
        </SidebarProvider>
        <ToastContainer />
      </div>
    </AuthGuard>
  );
}
