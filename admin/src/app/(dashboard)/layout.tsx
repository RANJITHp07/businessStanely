import { Inter } from "next/font/google";
import "./globals.css";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Navigator from "@/components/navigator";
import { ToastContainer } from "react-toastify";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className={` h-screen flex overflow-hidden`}>
            <SidebarProvider>
                <AppSidebar />
                <main className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex gap-[20px] items-center py-[20px] p-6 md:pl-[20px] md:py-[15px] border-b">
                        <Navigator />
                        <div className="flex justify-between items-center flex-1 pr-4">
                            <h1 className="text-[25px] block md:hidden">Business Stanely</h1>
                            <SidebarTrigger />
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto bg-[#e3f2fd]">
                        {children}
                    </div>
                </main>
            </SidebarProvider>
            <ToastContainer />
        </div>
    );
}
