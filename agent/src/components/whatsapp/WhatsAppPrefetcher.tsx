"use client";

import { useEffect } from "react";
import { prefetchWhatsApp } from "@/lib/whatsapp/prefetch";

// Renders nothing — warms WhatsApp data in the background once the dashboard
// mounts so opening the WhatsApp page is instant.
export default function WhatsAppPrefetcher() {
  useEffect(() => {
    prefetchWhatsApp();
  }, []);
  return null;
}
