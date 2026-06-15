"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";

import type {
  WhatsAppChatSummary,
  WhatsAppMessage,
  WhatsAppState,
} from "@/lib/whatsapp/types";
import { resolveAvatarsBatch } from "@/lib/whatsapp/avatar-cache";
import { openWhatsAppStream } from "@/lib/whatsapp/stream";

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

// Smaller first fetch paints the conversation faster; "Load older messages"
// pulls more on demand.
const INITIAL_MESSAGE_LIMIT = 30;
const MESSAGE_LOAD_MORE_CHUNK = 50;
// The backend pushes a `chats-updated` SSE event the moment its chat list first
// populates, so the initial fetch no longer needs to poll aggressively. These
// are a safety net in case the stream is unavailable. The limit is generous so
// the sidebar keeps showing the loading state (not an empty "No chats found")
// while WhatsApp Web finishes its first cold-start sync, which can take a while.
const CHATS_EMPTY_RETRY_LIMIT = 40;
const CHATS_EMPTY_RETRY_DELAY_MS = 3000;

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const isFormData =
    typeof FormData !== "undefined" && init?.body instanceof FormData;

  // Get token from localStorage
  let token: string | null = null;
  if (typeof window !== "undefined") {
    token = localStorage.getItem("token");
  }

  const baseHeaders = isFormData
    ? { ...(init?.headers || {}) }
    : {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      };

  // Always add Authorization header if token exists
  const headers = token
    ? { ...baseHeaders, Authorization: `Bearer ${token}` }
    : baseHeaders;

  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers,
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

function fallbackChatName(chatId: string) {
  const normalized = chatId.split("@")[0]?.split(":")[0];
  return normalized || chatId;
}

function fallbackChatPhone(chatId: string) {
  const normalized = fallbackChatName(chatId);
  const digits = normalized.replace(/\D/g, "");
  return digits || normalized || null;
}

export function useWhatsAppDesktop() {
  const [state, setState] = useState<SerializableWhatsAppState>(defaultState);
  const [chats, setChats] = useState<WhatsAppChatSummary[]>([]);
  const [hasMoreChats, setHasMoreChats] = useState(true);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isChatsLoading, setIsChatsLoading] = useState(false);
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [canLoadMore, setCanLoadMore] = useState(false);
  const [searchResults, setSearchResults] = useState<WhatsAppChatSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const messageLimitRef = useRef(INITIAL_MESSAGE_LIMIT);
  const chatPageRef = useRef(1);
  const chatsCountRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const selectedChatIdRef = useRef<string | null>(null);
  const stateRef = useRef<SerializableWhatsAppState>(defaultState);
  const deletedMessageIdsRef = useRef<Set<string>>(new Set());
  const editedMessagesRef = useRef<Map<string, WhatsAppMessage>>(new Map());

  const reconcileMessages = (incoming: WhatsAppMessage[]) =>
    incoming
      .filter((message) => !deletedMessageIdsRef.current.has(message.id))
      .map((message) => editedMessagesRef.current.get(message.id) ?? message);

  const selectedChat = useMemo(
    () =>
      chats.find((chat) => chat.id === selectedChatId) ??
      searchResults.find((chat) => chat.id === selectedChatId) ??
      null,
    [chats, searchResults, selectedChatId],
  );

  const upsertChatPreview = (
    chatId: string,
    update: (existing: WhatsAppChatSummary | null) => WhatsAppChatSummary,
  ) => {
    setChats((current) => {
      const existing = current.find((chat) => chat.id === chatId) ?? null;
      const nextChat = update(existing);
      const withoutCurrent = current.filter((chat) => chat.id !== chatId);

      return [nextChat, ...withoutCurrent].sort(
        (left, right) => (right.timestamp ?? 0) - (left.timestamp ?? 0),
      );
    });
  };

  // When searching, show backend results (which span ALL chats + contacts, not
  // just the loaded sidebar); otherwise show the loaded chat list.
  const displayChats = useMemo(
    () => (searchQuery.trim() ? searchResults : chats),
    [searchQuery, searchResults, chats],
  );

  // Debounced backend search across every chat and contact in WhatsApp.
  useEffect(() => {
    const term = searchQuery.trim();
    if (!term) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    const handle = setTimeout(async () => {
      try {
        const data = await getJson<{ chats: WhatsAppChatSummary[] }>(
          `/api/whatsapp/chats?search=${encodeURIComponent(term)}&page=1&pageSize=30`,
        );
        if (cancelled) return;
        setSearchResults(data.chats ?? []);
        resolveAvatarsBatch((data.chats ?? []).map((chat) => chat.id));
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [searchQuery]);

  const loadStatus = async () => {
    const nextState = await getJson<SerializableWhatsAppState>(
      "/api/whatsapp/status",
    );
    setState(nextState);
    return nextState;
  };

  const fetchChatsPage = async (page: number, pageSize: number) => {
    const data = await getJson<{ chats: WhatsAppChatSummary[] }>(
      `/api/whatsapp/chats?page=${page}&pageSize=${pageSize}`,
    );
    return data.chats ?? [];
  };

  const loadChats = async (
    preferredChatId?: string | null,
    retryCount = 0,
  ): Promise<string | null> => {
    setIsChatsLoading(true);
    setChatsError(null);
    try {
      const chatList = await fetchChatsPage(1, 15);
      setChats(chatList);
      resolveAvatarsBatch(chatList.map((chat) => chat.id));
      chatPageRef.current = 1;
      setHasMoreChats(chatList.length >= 15);

      const nextSelectedChatId = preferredChatId ?? selectedChatIdRef.current;
      const activeChat =
        chatList.find((chat) => chat.id === nextSelectedChatId) ||
        chatList[0] ||
        null;

      setSelectedChatId(activeChat?.id ?? null);
      setChatsError(null);
      // Keep the loading state on and retry gently while WhatsApp Web syncs —
      // but normally the `chats-updated` SSE event delivers the list first.
      if (chatList.length === 0 && retryCount < CHATS_EMPTY_RETRY_LIMIT) {
        await new Promise((res) =>
          setTimeout(res, CHATS_EMPTY_RETRY_DELAY_MS),
        );
        return loadChats(preferredChatId, retryCount + 1);
      }
      setIsChatsLoading(false);
      return activeChat?.id ?? null;
    } catch (err: any) {
      if (retryCount < CHATS_EMPTY_RETRY_LIMIT) {
        await new Promise((res) =>
          setTimeout(res, CHATS_EMPTY_RETRY_DELAY_MS),
        );
        return loadChats(preferredChatId, retryCount + 1);
      }
      setIsChatsLoading(false);
      setChatsError(err?.message || "Failed to load chats.");
      return null;
    }
  };

  // Lightweight background refresh — no spinner, no retries. Used by SSE events
  // so a single network fetch replaces the full retry-heavy loadChats().
  const refreshChats = async (preferredChatId?: string | null) => {
    try {
      const loadedPages = Math.max(1, chatPageRef.current);
      const pageSize = loadedPages * 15;
      const chatList = await fetchChatsPage(1, pageSize);
      if (chatList.length === 0) return;
      setChats(chatList);
      resolveAvatarsBatch(chatList.map((chat) => chat.id));
      setHasMoreChats(chatList.length >= pageSize);
      const sel = preferredChatId ?? selectedChatIdRef.current;
      if (!sel) {
        setSelectedChatId(chatList[0]?.id ?? null);
      }
    } catch {
      // Leave existing list on screen; next event will retry.
    }
  };

  const loadMoreChats = async () => {
    if (!hasMoreChats || isChatsLoading) return;
    const nextPage = chatPageRef.current + 1;
    try {
      const chatList = await fetchChatsPage(nextPage, 15);
      if (chatList.length > 0) {
        resolveAvatarsBatch(chatList.map((chat) => chat.id));
        setChats((prev) => {
          const seen = new Set(prev.map((chat) => chat.id));
          const merged = [...prev];
          for (const chat of chatList) {
            if (!seen.has(chat.id)) merged.push(chat);
          }
          return merged;
        });
        chatPageRef.current = nextPage;
      }
      setHasMoreChats(chatList.length >= 15);
    } catch {
      // Leave hasMoreChats as-is so the user can try again.
    }
  };

  const loadMessages = async (chatId: string, limit = INITIAL_MESSAGE_LIMIT) => {
    const data = await getJson<{ messages: WhatsAppMessage[] }>(
      `/api/whatsapp/messages?chatId=${encodeURIComponent(chatId)}&limit=${limit}`,
    );
    const nextMessages = reconcileMessages(data.messages);
    setMessages(nextMessages);
    setCanLoadMore(data.messages.length >= limit);
  };

  const loadMoreMessages = async () => {
    const chatId = selectedChatIdRef.current;
    if (!chatId || isLoadingMore) return;
    const nextLimit = messageLimitRef.current + MESSAGE_LOAD_MORE_CHUNK;
    messageLimitRef.current = nextLimit;
    setIsLoadingMore(true);
    try {
      await loadMessages(chatId, nextLimit);
    } catch {
      messageLimitRef.current -= MESSAGE_LOAD_MORE_CHUNK;
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
    chatsCountRef.current = chats.length;
  }, [chats]);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        const nextState = await loadStatus();

        if (!active) return;

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
    let disposed = false;
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let backoffMs = 1000;
    let chatsRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    let chatsRefreshInFlight = false;
    let chatsRefreshQueued = false;

    const triggerChatsRefresh = () => {
      if (chatsRefreshTimer) {
        clearTimeout(chatsRefreshTimer);
      }

      chatsRefreshTimer = setTimeout(async () => {
        if (disposed) {
          return;
        }

        if (chatsRefreshInFlight) {
          chatsRefreshQueued = true;
          return;
        }

        chatsRefreshInFlight = true;
        try {
          await refreshChats(selectedChatIdRef.current);
        } catch {
          // Ignore transient refresh failures while the desktop client reconnects.
        } finally {
          chatsRefreshInFlight = false;
          if (chatsRefreshQueued && !disposed) {
            chatsRefreshQueued = false;
            triggerChatsRefresh();
          }
        }
      }, 350);
    };

    async function connect() {
      if (disposed) return;

      source = await openWhatsAppStream();
      if (disposed) {
        source.close();
        return;
      }
      eventSourceRef.current = source;

      source.onopen = () => {
        backoffMs = 1000;
      };

      source.onerror = () => {
        if (disposed) return;
        source?.close();
        source = null;
        eventSourceRef.current = null;
        const jitter = Math.floor(Math.random() * 1000);
        reconnectTimer = setTimeout(() => {
          if (!disposed) {
            backoffMs = Math.min(backoffMs * 2, 30000);
            connect();
          }
        }, backoffMs + jitter);
      };

      source.addEventListener("state", async (event) => {
        const nextState = JSON.parse(
          (event as MessageEvent).data,
        ) as SerializableWhatsAppState;
        const wasReady = stateRef.current.status === "ready";
        setState(nextState);

        if (nextState.status === "ready" && !wasReady) {
          try {
            const chatId = await loadChats(selectedChatIdRef.current);
            if (chatId) {
              // Stagger message loads so many reconnecting agents do not stampede backend.
              await new Promise<void>((resolve) =>
                setTimeout(resolve, Math.floor(Math.random() * 3000)),
              );
              await loadMessages(chatId);
            }
          } catch {
            // The route remains usable while the client warms up.
          }
        }
      });

      source.addEventListener("chats-updated", async (event) => {
        if (stateRef.current.status !== "ready") {
          return;
        }

        // Reload on an explicit change (chatId = new contact) OR when we have no
        // chats yet — the latter is the warm-up push the backend fires the moment
        // its list first populates, so we fetch once instead of polling.
        const payload = JSON.parse((event as MessageEvent).data) as {
          chatId?: string;
          at?: number;
        };
        if (payload.chatId || chatsCountRef.current === 0) {
          triggerChatsRefresh();
        }
      });

      source.addEventListener("messages-updated", async (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          chatId?: string;
        };
        if (!payload.chatId) return;
        if (payload.chatId === selectedChatIdRef.current) {
          try {
            await loadMessages(payload.chatId, messageLimitRef.current);
          } catch {
            // ignore
          }
        }
      });
      source.addEventListener("message", async (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          chatId?: string;
          chat?: WhatsAppChatSummary;
          message?: WhatsAppMessage;
        };

        if (!payload.chatId || !payload.message) {
          return;
        }

        if (payload.chatId === selectedChatIdRef.current) {
          setMessages((current) => {
            if (deletedMessageIdsRef.current.has(payload.message!.id)) {
              return current;
            }

            const editedMessage =
              editedMessagesRef.current.get(payload.message!.id) ??
              payload.message!;
            if (current.some((message) => message.id === editedMessage.id)) {
              return current.map((message) =>
                message.id === editedMessage.id ? editedMessage : message,
              );
            }

            return [...current, editedMessage];
          });
        }

        setChats((current) => {
          const chatIndex = current.findIndex((c) => c.id === payload.chatId);
          if (chatIndex === -1) {
            if (!payload.chat) {
              return current;
            }

            const nextChats = [
              {
                ...payload.chat,
                lastMessage: payload.message!.body,
                timestamp: payload.message!.timestamp,
                unreadCount:
                  payload.chatId !== selectedChatIdRef.current &&
                  !payload.message!.fromMe
                    ? Math.max(payload.chat.unreadCount || 0, 1)
                    : 0,
              },
              ...current,
            ];

            return nextChats.sort(
              (a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0),
            );
          }

          const updated = current.map((c) =>
            c.id === payload.chatId
              ? {
                  ...c,
                  lastMessage: payload.message!.body,
                  timestamp: payload.message!.timestamp,
                  unreadCount:
                    payload.chatId !== selectedChatIdRef.current
                      ? (c.unreadCount || 0) + (payload.message!.fromMe ? 0 : 1)
                      : 0,
                }
              : c,
          );

          return [...updated].sort(
            (a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0),
          );
        });
      });

      return;
    }

    connect();

    return () => {
      disposed = true;
      if (chatsRefreshTimer) clearTimeout(chatsRefreshTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      source?.close();
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

    const interval = setInterval(poll, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [state.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedChatId || state.status !== "ready") {
      setMessages([]);
      setCanLoadMore(false);
      messageLimitRef.current = INITIAL_MESSAGE_LIMIT;
      return;
    }

    messageLimitRef.current = INITIAL_MESSAGE_LIMIT;
    loadMessages(selectedChatId, INITIAL_MESSAGE_LIMIT).catch(() => {
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
    const previewText = hasFile
      ? content ||
        (file?.type?.startsWith("image/") ? "📷 Photo" : "📎 Attachment")
      : content;

    upsertChatPreview(chatId, (existing) => ({
      id: chatId,
      name: existing?.name || fallbackChatName(chatId),
      phoneNumber: existing?.phoneNumber || fallbackChatPhone(chatId),
      lastMessage: previewText,
      timestamp: Date.now(),
      unreadCount: 0,
      avatarSeed: existing?.avatarSeed || fallbackChatName(chatId),
      avatarUrl: existing?.avatarUrl || null,
      isGroup: existing?.isGroup || chatId.endsWith("@g.us"),
      isMuted: existing?.isMuted || false,
      isPinned: existing?.isPinned || false,
    }));

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
      upsertChatPreview(chatId, (existing) => ({
        id: chatId,
        name: existing?.name || fallbackChatName(chatId),
        phoneNumber: existing?.phoneNumber || fallbackChatPhone(chatId),
        lastMessage: data.message.body,
        timestamp: data.message.timestamp,
        unreadCount: 0,
        avatarSeed: existing?.avatarSeed || fallbackChatName(chatId),
        avatarUrl: existing?.avatarUrl || null,
        isGroup: existing?.isGroup || chatId.endsWith("@g.us"),
        isMuted: existing?.isMuted || false,
        isPinned: existing?.isPinned || false,
      }));
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
    const previousEditedMessage = editedMessagesRef.current.get(messageId);

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

      editedMessagesRef.current.set(messageId, data.message);
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? data.message : message,
        ),
      );
      upsertChatPreview(chatId, (existing) => ({
        id: chatId,
        name: existing?.name || fallbackChatName(chatId),
        phoneNumber: existing?.phoneNumber || fallbackChatPhone(chatId),
        lastMessage: data.message.body || existing?.lastMessage || "",
        timestamp: data.message.timestamp || existing?.timestamp || Date.now(),
        unreadCount: existing?.unreadCount || 0,
        avatarSeed: existing?.avatarSeed || fallbackChatName(chatId),
        avatarUrl: existing?.avatarUrl || null,
        isGroup: existing?.isGroup || chatId.endsWith("@g.us"),
        isMuted: existing?.isMuted || false,
        isPinned: existing?.isPinned || false,
      }));
    } catch (error) {
      if (previousEditedMessage) {
        editedMessagesRef.current.set(messageId, previousEditedMessage);
      } else {
        editedMessagesRef.current.delete(messageId);
      }
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
    deletedMessageIdsRef.current.add(messageId);
    setMessages((current) =>
      current.filter((message) => message.id !== messageId),
    );

    try {
      await getJson<{ ok: boolean }>("/api/whatsapp/messages", {
        method: "DELETE",
        body: JSON.stringify({ messageId, everyone: true }),
      });
      const remainingMessages = previousMessages.filter(
        (message) => message.id !== messageId,
      );
      const latestMessage = remainingMessages[remainingMessages.length - 1];
      if (latestMessage) {
        upsertChatPreview(chatId, (existing) => ({
          id: chatId,
          name: existing?.name || fallbackChatName(chatId),
          phoneNumber: existing?.phoneNumber || fallbackChatPhone(chatId),
          lastMessage: latestMessage.body || existing?.lastMessage || "",
          timestamp: latestMessage.timestamp,
          unreadCount: existing?.unreadCount || 0,
          avatarSeed: existing?.avatarSeed || fallbackChatName(chatId),
          avatarUrl: existing?.avatarUrl || null,
          isGroup: existing?.isGroup || chatId.endsWith("@g.us"),
          isMuted: existing?.isMuted || false,
          isPinned: existing?.isPinned || false,
        }));
      }
    } catch (error) {
      deletedMessageIdsRef.current.delete(messageId);
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
    chats: displayChats,
    hasMoreChats,
    isSearching,
    deleteMessage,
    editMessage,
    isBootstrapping,
    isLoadingMore,
    isSending,
    loadMoreChats,
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
    isChatsLoading,
    chatsError,
  };
}
