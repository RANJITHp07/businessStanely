"use client";

import { AuthGuard } from "@/components/AuthGuard";

export default function WhatsAppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return <AuthGuard>{children}</AuthGuard>;
}
