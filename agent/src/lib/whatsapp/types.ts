export type WhatsAppConnectionStatus =
  | "idle"
  | "initializing"
  | "qr"
  | "authenticated"
  | "ready"
  | "disconnected"
  | "error";

export type WhatsAppState = {
  status: WhatsAppConnectionStatus;
  qr: string | null;
  clientInfo: {
    pushname: string | null;
    wid: string | null;
    platform: string | null;
  };
  error: string | null;
  lastUpdatedAt: string;
  // Set by the Cloud API provider; absent on the legacy WhatsApp Web engine.
  provider?: "web" | "cloud";
  capabilities?: {
    editMessages: boolean;
    deleteMessages: boolean;
    templates: boolean;
    logout: boolean;
  };
  // Cloud provider: health of each side. 1:1 chats go through Meta, groups
  // through the whatsapp-groups linked device; either can be down alone.
  channels?: {
    meta: { status: WhatsAppConnectionStatus; error: string | null };
    groups: { status: string; error: string | null; linkedAs: string | null } | null;
  };
  // Present while the Cloud API number is not connected yet, so the admin
  // panel can run Meta's Embedded Signup.
  onboarding?: {
    appId: string;
    configId: string;
    graphApiVersion: string;
  } | null;
};

export type WhatsAppChatSummary = {
  id: string;
  name: string;
  phoneNumber: string | null;
  lastMessage: string;
  timestamp: number | null;
  unreadCount: number;
  avatarSeed: string;
  avatarUrl: string | null;
  isGroup: boolean;
  isMuted: boolean;
  isPinned: boolean;
  // Cloud API: free-form replies are allowed until this time (ms); after it
  // only approved templates can be sent. null = window closed / never opened.
  windowExpiresAt?: number | null;
};

export type WhatsAppMessage = {
  id: string;
  chatId: string;
  body: string;
  timestamp: number;
  fromMe: boolean;
  author: string | null;
  ack?: number;
  hasMedia: boolean;
  mediaType: string | null;
  mimetype: string | null;
  filename: string | null;
  quotedMessageId: string | null;
  quotedMessageBody: string | null;
  quotedMessageAuthor: string | null;
  error?: string | null;
};

export type WhatsAppTemplate = {
  name: string;
  language: string;
  category: string;
  headerText: string | null;
  bodyText: string;
  footerText: string | null;
  parameterFormat: "POSITIONAL" | "NAMED";
  // Placeholder names in order ("1", "2" for positional templates).
  headerParams: string[];
  bodyParams: string[];
};

export type WhatsAppEventPayload = {
  state?: WhatsAppState;
  chatId?: string;
  chat?: WhatsAppChatSummary;
  message?: WhatsAppMessage;
};

export type WhatsAppStreamEvent =
  | "state"
  | "chats-updated"
  | "message"
  | "messages-updated";
