"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { useHiddenSidebarItems } from "@/lib/sidebarVisibility";

function WhatsAppVisibilityGuard({ children }: Readonly<{ children: React.ReactNode }>) {
    const router = useRouter();
    const isHidden = useHiddenSidebarItems().includes("/whatsapp");

    // The admin hid WhatsApp for this agent; this page has no sidebar to apply
    // that, so redirect here instead.
    useEffect(() => {
        if (isHidden) router.replace("/");
    }, [isHidden, router]);

    return isHidden ? null : <>{children}</>;
}

export default function WhatsAppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <AuthGuard>
            <WhatsAppVisibilityGuard>{children}</WhatsAppVisibilityGuard>
        </AuthGuard>
    );
}
