"use client";

import { useEffect } from "react";
import { prefetchWhatsApp } from "@/lib/whatsapp/prefetch";
import { useHiddenSidebarItems } from "@/components/SidebarAccessProvider";

// Renders nothing — warms WhatsApp data in the background once the dashboard
// mounts so opening the WhatsApp page is instant.
export default function WhatsAppPrefetcher() {
  const hidden = useHiddenSidebarItems().includes("/whatsapp");
  useEffect(() => {
    if (!hidden) prefetchWhatsApp();
  }, [hidden]);
  return null;
}
