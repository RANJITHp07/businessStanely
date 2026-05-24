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
};

export type WhatsAppChatSummary = {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: number | null;
  unreadCount: number;
  avatarSeed: string;
  avatarUrl: string | null;
  isGroup: boolean;
  isMuted: boolean;
  isPinned: boolean;
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
