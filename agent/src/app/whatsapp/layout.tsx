"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { SidebarAccessProvider } from "@/components/SidebarAccessProvider";

export default function WhatsAppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <AuthGuard>
            <SidebarAccessProvider>{children}</SidebarAccessProvider>
        </AuthGuard>
    );
}
