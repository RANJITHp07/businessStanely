"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";

import type {
  WhatsAppChatSummary,
  WhatsAppMessage,
  WhatsAppState,
} from "@/lib/whatsapp/types";

type SerializableWhatsAppState = WhatsAppState & {
  qrCodeDataUrl: string | null;
};

const defaultState: SerializableWhatsAppState = {
  status: "idle",
  qr: null,
  qrCodeDataUrl: null,
  clientInfo: {
    pushname: null,
    wid: null,
    platform: null,
  },
  error: null,
  lastUpdatedAt: new Date(0).toISOString(),
};

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const isFormData =
    typeof FormData !== "undefined" && init?.body instanceof FormData;

  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: isFormData
      ? { ...(init?.headers || {}) }
      : {
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
    cache: "no-store",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "Request failed.");
  }

  return response.json();
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export function useWhatsAppDesktop() {
  const [state, setState] = useState<SerializableWhatsAppState>(defaultState);
  const [chats, setChats] = useState<WhatsAppChatSummary[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [canLoadMore, setCanLoadMore] = useState(false);
  const messageLimitRef = useRef(80);
  const eventSourceRef = useRef<EventSource | null>(null);
  const selectedChatIdRef = useRef<string | null>(null);
  const stateRef = useRef<SerializableWhatsAppState>(defaultState);

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );

  const filteredChats = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();

    if (!normalized) {
      return chats;
    }

    return chats.filter((chat) => {
      const searchableText = [chat.name, chat.lastMessage, chat.id]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalized);
    });
  }, [chats, searchQuery]);

  const loadStatus = async () => {
    const nextState = await getJson<SerializableWhatsAppState>(
      "/api/whatsapp/status",
    );
    setState(nextState);
    return nextState;
  };

  const loadChats = async (preferredChatId?: string | null) => {
    const data = await getJson<{ chats: WhatsAppChatSummary[] }>(
      "/api/whatsapp/chats",
    );
    setChats(data.chats);

    const nextSelectedChatId = preferredChatId ?? selectedChatIdRef.current;
    const activeChat =
      data.chats.find((chat) => chat.id === nextSelectedChatId) ||
      data.chats[0] ||
      null;

    setSelectedChatId(activeChat?.id ?? null);

    return activeChat?.id ?? null;
  };

  const loadMessages = async (chatId: string, limit = 80) => {
    const data = await getJson<{ messages: WhatsAppMessage[] }>(
      `/api/whatsapp/messages?chatId=${encodeURIComponent(chatId)}&limit=${limit}`,
    );
    setMessages(data.messages);
    setCanLoadMore(data.messages.length >= limit);
  };

  const loadMoreMessages = async () => {
    const chatId = selectedChatIdRef.current;
    if (!chatId || isLoadingMore) return;
    const nextLimit = messageLimitRef.current + 80;
    messageLimitRef.current = nextLimit;
    setIsLoadingMore(true);
    try {
      await loadMessages(chatId, nextLimit);
    } catch {
      messageLimitRef.current -= 80;
      toast.error("Failed to load older messages.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        const nextState = await loadStatus();

        if (!active) {
          return;
        }

        if (nextState.status === "ready") {
          const chatId = await loadChats();
          if (active && chatId) {
            await loadMessages(chatId);
          }
        }
      } catch (error) {
        if (active) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to initialize WhatsApp.",
          );
        }
      } finally {
        if (active) {
          setIsBootstrapping(false);
        }
      }
    };

    bootstrap();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/whatsapp/stream", {
      withCredentials: true,
    });
    eventSourceRef.current = source;

    source.addEventListener("state", async (event) => {
      const nextState = JSON.parse(
        (event as MessageEvent).data,
      ) as SerializableWhatsAppState;
      setState(nextState);

      if (nextState.status === "ready") {
        try {
          const chatId = await loadChats(selectedChatIdRef.current);
          if (chatId) {
            await loadMessages(chatId);
          }
        } catch {
          // The route remains usable while the client warms up.
        }
      }
    });

    source.addEventListener("chats-updated", async () => {
      if (stateRef.current.status !== "ready") {
        return;
      }

      try {
        const currentSelectedChatId = selectedChatIdRef.current;
        const chatId = await loadChats(currentSelectedChatId);
        if (chatId === currentSelectedChatId && chatId) {
          await loadMessages(chatId);
        }
      } catch {
        // Ignore transient refresh failures while the desktop client reconnects.
      }
    });

    source.addEventListener("message", async (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as {
        chatId?: string;
        message?: WhatsAppMessage;
      };

      if (!payload.chatId || !payload.message) {
        return;
      }

      if (payload.chatId === selectedChatIdRef.current) {
        setMessages((current) => {
          if (current.some((message) => message.id === payload.message?.id)) {
            return current;
          }

          return [...current, payload.message!];
        });
      }

      try {
        await loadChats(selectedChatIdRef.current);
      } catch {
        // Ignore transient chat refresh failures.
      }
    });

    return () => {
      source.close();
      eventSourceRef.current = null;
    };
  }, []);

  // Polling fallback: if SSE misses a state update while a QR/auth is in
  // progress, poll /status every 3 s so the UI catches the "ready" transition.
  useEffect(() => {
    const pollable = ["initializing", "qr", "authenticated"];
    if (!pollable.includes(state.status)) return;

    let active = true;

    const poll = async () => {
      if (!active) return;
      try {
        const nextState = await loadStatus();
        if (!active) return;
        if (nextState.status === "ready") {
          try {
            const chatId = await loadChats(selectedChatIdRef.current);
            if (active && chatId) {
              await loadMessages(chatId);
            }
          } catch {
            // ignore — chats load on next poll or SSE event
          }
        }
      } catch {
        // ignore transient network errors
      }
    };

    const interval = setInterval(poll, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [state.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedChatId || state.status !== "ready") {
      setMessages([]);
      setCanLoadMore(false);
      messageLimitRef.current = 80;
      return;
    }

    messageLimitRef.current = 80;
    loadMessages(selectedChatId, 80).catch(() => {
      toast.error("Failed to load messages.");
    });
  }, [selectedChatId, state.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = async (body: string, file?: File | null) => {
    const activeChatId = selectedChatIdRef.current ?? selectedChatId;

    if (!activeChatId) {
      return;
    }

    const chatId = activeChatId;
    const content = body.trim();
    const hasFile = Boolean(file && file.size > 0);

    if (!content && !hasFile) {
      return;
    }

    const optimisticId = `optimistic-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    if (!hasFile) {
      const optimisticMessage: WhatsAppMessage = {
        id: optimisticId,
        chatId,
        body: content,
        timestamp: Date.now(),
        fromMe: true,
        author: null,
        ack: 0,
        hasMedia: false,
        mediaType: null,
        mimetype: null,
        filename: null,
      };
      setMessages((current) => [...current, optimisticMessage]);
    }

    setIsSending(true);

    try {
      let data: { message: WhatsAppMessage };

      if (hasFile && file) {
        const base64 = arrayBufferToBase64(await file.arrayBuffer());
        data = await getJson<{ message: WhatsAppMessage }>(
          "/api/whatsapp/send",
          {
            method: "POST",
            body: JSON.stringify({
              chatId,
              body: content,
              media: {
                data: base64,
                mimetype: file.type || "application/octet-stream",
                filename: file.name || "attachment",
              },
            }),
          },
        );
      } else {
        data = await getJson<{ message: WhatsAppMessage }>(
          "/api/whatsapp/send",
          {
            method: "POST",
            body: JSON.stringify({ chatId, body: content }),
          },
        );
      }

      setMessages((current) => {
        const withoutOptimistic = current.filter(
          (message) => message.id !== optimisticId,
        );

        if (
          withoutOptimistic.some((message) => message.id === data.message.id)
        ) {
          return withoutOptimistic;
        }

        return [...withoutOptimistic, data.message];
      });

      loadChats(chatId).catch(() => {
        // Keep send responsive even if chat list refresh fails.
      });
    } catch (error) {
      if (!hasFile) {
        setMessages((current) =>
          current.filter((message) => message.id !== optimisticId),
        );
      }
      throw error;
    } finally {
      setIsSending(false);
    }
  };

  const editMessage = async (messageId: string, body: string) => {
    const chatId = selectedChatIdRef.current;
    const content = body.trim();

    if (!chatId || !content) {
      return;
    }

    const previousMessages = messages;

    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, body: content } : message,
      ),
    );

    try {
      const data = await getJson<{ message: WhatsAppMessage }>(
        "/api/whatsapp/messages",
        {
          method: "PATCH",
          body: JSON.stringify({ messageId, body: content }),
        },
      );

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? data.message : message,
        ),
      );

      await loadChats(chatId);
    } catch (error) {
      setMessages(previousMessages);
      throw error;
    }
  };

  const deleteMessage = async (messageId: string) => {
    const chatId = selectedChatIdRef.current;

    if (!chatId) {
      return;
    }

    const previousMessages = messages;
    setMessages((current) =>
      current.filter((message) => message.id !== messageId),
    );

    try {
      await getJson<{ ok: boolean }>("/api/whatsapp/messages", {
        method: "DELETE",
        body: JSON.stringify({ messageId, everyone: true }),
      });

      await loadChats(chatId);
    } catch (error) {
      setMessages(previousMessages);
      throw error;
    }
  };

  const logout = async () => {
    await getJson<{ ok: boolean }>("/api/whatsapp/logout", { method: "POST" });
    setChats([]);
    setMessages([]);
    setSelectedChatId(null);
    setSearchQuery("");
    await loadStatus();
  };

  return {
    canLoadMore,
    chats: filteredChats,
    deleteMessage,
    editMessage,
    isBootstrapping,
    isLoadingMore,
    isSending,
    loadMoreMessages,
    logout,
    messages,
    searchQuery,
    selectedChat,
    selectedChatId,
    sendMessage,
    setSearchQuery,
    setSelectedChatId,
    state,
  };
}
