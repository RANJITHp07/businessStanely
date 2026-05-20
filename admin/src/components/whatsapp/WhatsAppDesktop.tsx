"use client";

import { FormEvent, memo, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
    Paperclip,
    ArrowLeft,
    Check,
    CheckCheck,
    FileText,
    LoaderCircle,
    LogOut,
    MessageSquare,
    MoreVertical,
    Pencil,
    Phone,
    Search,
    SendHorizonal,
    Trash2,
    Video,
} from "lucide-react";

import { useWhatsAppDesktop } from "@/hooks/use-whatsapp-desktop";
import type { WhatsAppChatSummary, WhatsAppMessage } from "@/lib/whatsapp/types";

const WHATSAPP_EDIT_WINDOW_MS = 15 * 60 * 1000;

function formatTime(timestamp: number | null) {
    if (!timestamp) {
        return "";
    }

    return new Intl.DateTimeFormat("en-IN", {
        hour: "numeric",
        minute: "2-digit",
    }).format(timestamp);
}

function WhatsAppDesktop() {

    function formatDay(timestamp: number) {
        return new Intl.DateTimeFormat("en-IN", {
            day: "numeric",
            month: "short",
        }).format(timestamp);
    }

    function initials(name: string) {
        return name
            .split(" ")
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() || "")
            .join("") || "WA";
    }

    function canEditMessage(message: WhatsAppMessage) {
        const isTextMessage = !message.hasMedia && (!message.mediaType || message.mediaType === "chat");
        const withinEditWindow = Date.now() - message.timestamp <= WHATSAPP_EDIT_WINDOW_MS;

        return message.fromMe && isTextMessage && withinEditWindow;
    }

    function ChatAvatar({
        chat,
        sizeClassName,
    }: {
        chat: Pick<WhatsAppChatSummary, "name" | "avatarUrl">;
        sizeClassName: string;
    }) {
        const [loadFailed, setLoadFailed] = useState(false);

        useEffect(() => {
            setLoadFailed(false);
        }, [chat.avatarUrl]);

        return (
            <div className={`relative overflow-hidden rounded-full bg-[#6a7175] ${sizeClassName}`}>
                {chat.avatarUrl && !loadFailed ? (
                    <img
                        src={chat.avatarUrl}
                        alt={chat.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={() => setLoadFailed(true)}
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
                        {initials(chat.name)}
                    </div>
                )}
            </div>
        );
    }

    function MessageMedia({ message }: { message: WhatsAppMessage }) {
        const src = `/api/whatsapp/media?messageId=${encodeURIComponent(message.id)}`;

        if (message.mediaType === "image" || message.mediaType === "sticker") {
            return (
                <div>
                    <img
                        src={src}
                        alt={message.body || "Image"}
                        className="max-h-64 max-w-full rounded-lg object-cover"
                        loading="lazy"
                    />
                    {message.body ? (
                        <p className="mt-1 wrap-break-word whitespace-pre-wrap text-[14px] leading-6">{message.body}</p>
                    ) : null}
                </div>
            );
        }

        if (message.mediaType === "video") {
            return (
                <div>
                    <video
                        src={src}
                        controls
                        className="max-h-64 max-w-full rounded-lg"
                        preload="metadata"
                    />
                    {message.body ? (
                        <p className="mt-1 wrap-break-word whitespace-pre-wrap text-[14px] leading-6">{message.body}</p>
                    ) : null}
                </div>
            );
        }

        if (message.mediaType === "audio" || message.mediaType === "ptt") {
            return (
                <audio
                    src={src}
                    controls
                    className="w-full min-w-55"
                    preload="metadata"
                />
            );
        }

        if (message.mediaType === "document") {
            return (
                <a
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg bg-black/10 px-3 py-2 text-sm hover:bg-black/20 transition"
                >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{message.filename || "Document"}</span>
                </a>
            );
        }

        // Fallback: generic download link
        return (
            <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg bg-black/10 px-3 py-2 text-sm hover:bg-black/20 transition"
            >
                <FileText className="h-4 w-4 shrink-0" />
                <span>{message.filename || "Attachment"}</span>
            </a>
        );
    }

    const MessageComposer = memo(function MessageComposer({
        isSending,
        onSend,
    }: {
        isSending: boolean;
        onSend: (content: string, file?: File | null) => Promise<void>;
    }) {
        const [draft, setDraft] = useState("");
        const [attachment, setAttachment] = useState<File | null>(null);
        const fileInputRef = useRef<HTMLInputElement>(null);

        const openFilePicker = () => {
            fileInputRef.current?.click();
        };

        const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            const nextFile = event.target.files?.[0] ?? null;
            setAttachment(nextFile);
        };

        const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();

            const content = draft.trim();
            const pendingFile = attachment;

            if (!content && !pendingFile) {
                return;
            }

            setDraft("");
            setAttachment(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }

            onSend(content, pendingFile).catch((error) => {
                setDraft(content);
                setAttachment(pendingFile || null);
                toast.error(error instanceof Error ? error.message : "Failed to send message.");
            });
        };

        return (
            <form onSubmit={handleSubmit} className="flex items-end gap-3">
                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                />
                <button
                    type="button"
                    onClick={openFilePicker}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-[#2a3942] text-[#aebac1] transition hover:bg-[#33454f] hover:text-white"
                    title="Attach file"
                >
                    <Paperclip className="h-5 w-5" />
                </button>
                <div className="flex-1 rounded-lg bg-[#2a3942] px-4 py-3">
                    {attachment ? (
                        <div className="mb-2 flex items-center justify-between rounded-md bg-black/20 px-2 py-1 text-xs text-[#d1d7db]">
                            <span className="truncate pr-2">{attachment.name}</span>
                            <button
                                type="button"
                                onClick={() => {
                                    setAttachment(null);
                                    if (fileInputRef.current) {
                                        fileInputRef.current.value = "";
                                    }
                                }}
                                className="text-[#aebac1] hover:text-white"
                            >
                                Remove
                            </button>
                        </div>
                    ) : null}
                    <textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder={attachment ? "Add a caption (optional)" : "Type a message"}
                        rows={1}
                        className="max-h-32 min-h-6 w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-[#8696a0]"
                    />
                </div>
                <button
                    type="submit"
                    disabled={isSending || (!draft.trim() && !attachment)}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-[#00a884] text-[#111b21] transition hover:bg-[#06b48f] disabled:cursor-not-allowed disabled:bg-[#8696a0]"
                >
                    {isSending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <SendHorizonal className="h-5 w-5" />}
                </button>
            </form>
        );
    });

    const {
        canLoadMore,
        chats,
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
        loadMoreChats,
        hasMoreChats,
        isChatsLoading,
        chatsError,
    } = useWhatsAppDesktop();
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);
    const [isRetrying, setIsRetrying] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editingDraft, setEditingDraft] = useState("");
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const suppressNextScrollRef = useRef(false);

    // Scroll to bottom when new messages arrive, but NOT when loading older ones.
    useEffect(() => {
        if (suppressNextScrollRef.current) return;
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const handleLoadMore = async () => {
        const container = messagesContainerRef.current;
        const prevScrollHeight = container?.scrollHeight ?? 0;
        suppressNextScrollRef.current = true;
        await loadMoreMessages();
        requestAnimationFrame(() => {
            suppressNextScrollRef.current = false;
            if (container) {
                container.scrollTop = container.scrollHeight - prevScrollHeight;
            }
        });
    };

    const handleRetry = async () => {
        setIsRetrying(true);
        try {
            // Clear and reinitialize
            await fetch("/api/whatsapp/logout", { method: "POST", credentials: "include" });
            // Give it a moment before reloading
            await new Promise(resolve => setTimeout(resolve, 1000));
            window.location.reload();
        } catch {
            setIsRetrying(false);
        }
    };

    const groupedMessages = useMemo(() => {
        return messages.reduce<Array<{ label: string; items: typeof messages }>>((groups, message) => {
            const label = formatDay(message.timestamp);
            const existing = groups[groups.length - 1];

            if (existing?.label === label) {
                existing.items.push(message);
                return groups;
            }

            groups.push({ label, items: [message] });
            return groups;
        }, []);
    }, [messages]);

    const startEdit = (message: WhatsAppMessage) => {
        if (message.hasMedia || (message.mediaType && message.mediaType !== "chat")) {
            toast.info("Only text messages can be edited.");
            return;
        }

        if (Date.now() - message.timestamp > WHATSAPP_EDIT_WINDOW_MS) {
            toast.info("This message can no longer be edited. WhatsApp allows edits only within 15 minutes.");
            return;
        }

        setEditingMessageId(message.id);
        setEditingDraft(message.body);
    };

    const cancelEdit = () => {
        setEditingMessageId(null);
        setEditingDraft("");
    };

    const saveEdit = async () => {
        if (!editingMessageId) {
            return;
        }

        const content = editingDraft.trim();

        if (!content) {
            toast.error("Message cannot be empty.");
            return;
        }

        const existing = messages.find((message) => message.id === editingMessageId);
        if (existing && existing.body.trim() === content) {
            cancelEdit();
            return;
        }

        try {
            await editMessage(editingMessageId, content);
            cancelEdit();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to edit message.");
        }
    };

    const handleDelete = async (messageId: string) => {
        const confirmed = window.confirm("Delete this message for everyone?");

        if (!confirmed) {
            return;
        }

        try {
            await deleteMessage(messageId);
            if (editingMessageId === messageId) {
                cancelEdit();
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to delete message.");
        }
    };

    if (isBootstrapping) {
        const statusMessages: Record<string, string> = {
            idle: "Preparing session...",
            initializing: "Launching WhatsApp Web browser...",
            qr: "QR code ready, waiting for scan...",
            authenticated: "Authenticating with WhatsApp...",
            ready: "Loading chats...",
        };

        const currentMessage = statusMessages[state.status] || "Starting WhatsApp desktop session...";

        return (
            <div className="flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#111b21] text-white">
                <div className="flex w-full max-w-md flex-col items-center gap-6 px-6">
                    <div className="flex items-center gap-4 rounded-2xl bg-white/5 px-6 py-4 backdrop-blur border border-white/10 w-full justify-center">
                        <LoaderCircle className="h-6 w-6 animate-spin text-[#00a884] shrink-0" />
                        <div className="flex flex-col gap-1 min-w-0">
                            <span className="text-sm font-medium text-[#e9edef]">{currentMessage}</span>
                            <span className="text-xs text-[#8696a0]">This may take up to 60 seconds on first load...</span>
                        </div>
                    </div>

                    <div className="flex w-full flex-col gap-2">
                        <div className="text-xs text-[#8696a0] space-y-1">
                            <div className={`flex items-center gap-2 ${state.status !== "idle" ? "text-[#00a884]" : ""}`}>
                                <div className={`h-2 w-2 rounded-full ${state.status !== "idle" ? "bg-[#00a884]" : "bg-[#3b4a54]"}`} />
                                <span>Initializing browser</span>
                            </div>
                            <div className={`flex items-center gap-2 ${state.status === "qr" || state.status === "authenticated" || state.status === "ready" ? "text-[#00a884]" : ""}`}>
                                <div className={`h-2 w-2 rounded-full ${state.status === "qr" || state.status === "authenticated" || state.status === "ready" ? "bg-[#00a884]" : "bg-[#3b4a54]"}`} />
                                <span>Waiting for QR scan</span>
                            </div>
                            <div className={`flex items-center gap-2 ${state.status === "ready" ? "text-[#00a884]" : ""}`}>
                                <div className={`h-2 w-2 rounded-full ${state.status === "ready" ? "bg-[#00a884]" : "bg-[#3b4a54]"}`} />
                                <span>Loading chats</span>
                            </div>
                        </div>
                    </div>

                    {state.error && (
                        <div className="w-full rounded-lg bg-red-900/20 border border-red-500/30 px-4 py-3">
                            <p className="text-xs text-red-400">{state.error}</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (state.status !== "ready") {
        return (
            <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0b141a] px-6 py-12 text-white">
                <div className="absolute inset-x-0 top-0 h-56 bg-[#00a884]" />
                <div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-[#111b21] shadow-[0_20px_80px_rgba(0,0,0,0.45)] lg:grid-cols-[1.1fr_1fr]">
                    <div className="flex flex-col justify-between gap-10 p-10">
                        <div>
                            <div className="mb-8 flex items-center gap-3 text-[#e9edef]">
                                <div className="rounded-2xl bg-white/8 p-3">
                                    <MessageSquare className="h-7 w-7 text-[#00a884]" />
                                </div>
                                <div>
                                    <p className="text-sm uppercase tracking-[0.3em] text-[#8696a0]">Admin only</p>
                                    <h1 className="text-3xl font-semibold">WhatsApp Desktop</h1>
                                </div>
                            </div>
                            <p className="max-w-xl text-base leading-7 text-[#d1d7db]">
                                Scan the QR code with the WhatsApp app on your phone. This session stays persisted on the server,
                                so you only need to scan again after you explicitly log out or WhatsApp invalidates the device.
                            </p>
                        </div>

                        <ol className="space-y-5 text-sm text-[#aebac1]">
                            <li className="flex gap-4"><span className="text-[#00a884]">1</span><span>Open WhatsApp on your phone.</span></li>
                            <li className="flex gap-4"><span className="text-[#00a884]">2</span><span>Tap Menu or Settings and choose Linked devices.</span></li>
                            <li className="flex gap-4"><span className="text-[#00a884]">3</span><span>Tap Link a device and scan this code.</span></li>
                        </ol>

                        {state.error && (
                            <div className="rounded-lg bg-red-900/20 border border-red-500/30 px-4 py-3">
                                <p className="text-sm text-red-400 mb-3">{state.error}</p>
                                <button
                                    onClick={handleRetry}
                                    disabled={isRetrying}
                                    className="w-full px-4 py-2 bg-[#00a884] hover:bg-[#06b48f] disabled:bg-[#8696a0] text-[#111b21] rounded-lg font-medium text-sm transition"
                                >
                                    {isRetrying ? "Retrying..." : "Try Again"}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-center border-l border-white/6 bg-[#0f1a20] p-10">
                        <div className="w-full max-w-sm rounded-3xl bg-[#f7f8fa] p-8 text-[#111b21] shadow-2xl">
                            {state.status === "authenticated" ? (
                                <div className="mx-auto flex h-72 w-72 flex-col items-center justify-center gap-4 rounded-2xl bg-white text-[#5e6b72]">
                                    <LoaderCircle className="h-10 w-10 animate-spin text-[#00a884]" />
                                    <p className="text-center text-sm font-medium text-[#3b4a54]">Scan detected!<br />Connecting to WhatsApp…</p>
                                </div>
                            ) : state.qrCodeDataUrl ? (
                                <img src={state.qrCodeDataUrl} alt="WhatsApp QR code" className="mx-auto h-72 w-72 rounded-2xl bg-white p-4" />
                            ) : (
                                <div className="mx-auto flex h-72 w-72 flex-col items-center justify-center gap-3 rounded-2xl bg-white text-[#5e6b72]">
                                    <LoaderCircle className="h-8 w-8 animate-spin" />
                                    <p className="text-xs text-center">
                                        {state.status === "initializing" ? "Starting WhatsApp…" : "Waiting for QR code…"}
                                    </p>
                                </div>
                            )}

                            <div className="mt-6 rounded-2xl bg-[#e9edef] px-4 py-3 text-sm text-[#3b4a54]">
                                <div className="flex items-center justify-between gap-4">
                                    <span>Status</span>
                                    <span className={`font-medium capitalize ${state.status === "authenticated" ? "text-[#00a884]" : state.status === "error" ? "text-red-500" : ""}`}>
                                        {state.status === "authenticated" ? "Scan confirmed — connecting" : state.status.replace(/-/g, " ")}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full bg-[#0b141a] text-[#e9edef]">
            <div className="mx-auto flex h-screen w-full max-w-screen-2xl overflow-hidden border-x border-white/5 bg-[#111b21] shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
                <aside className={`${mobileSidebarOpen ? "flex" : "hidden"} w-full max-w-full flex-col border-r border-white/6 bg-[#111b21] md:flex md:max-w-md`}>
                    <div className="flex items-center justify-between bg-[#202c33] px-4 py-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6a7175] text-sm font-semibold text-white">
                                {initials(state.clientInfo.pushname || "WhatsApp")}
                            </div>
                            <div>
                                <p className="text-sm font-medium">{state.clientInfo.pushname || "WhatsApp"}</p>
                                <p className="text-xs text-[#8696a0]">{state.clientInfo.wid || "Connected device"}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button type="button" className="rounded-full p-2 text-[#aebac1] transition hover:bg-white/8 hover:text-white">
                                <Search className="h-5 w-5" />
                            </button>
                            <button
                                type="button"
                                onClick={logout}
                                className="rounded-full p-2 text-[#aebac1] transition hover:bg-white/8 hover:text-white"
                                title="Log out WhatsApp session"
                            >
                                <LogOut className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    <div className="border-b border-white/6 px-3 py-3">
                        <label className="flex items-center gap-3 rounded-lg bg-[#202c33] px-4 py-2.5 text-sm text-[#8696a0] focus-within:ring-1 focus-within:ring-[#00a884]">
                            <Search className="h-4 w-4" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search chats"
                                className="w-full bg-transparent text-sm text-[#e9edef] outline-none placeholder:text-[#8696a0]"
                            />
                        </label>
                    </div>

                    <div className="no-scrollbar flex-1 overflow-y-auto">
                        {isChatsLoading ? (
                            <div className="flex flex-col items-center justify-center h-full py-10 text-[#00a884]">
                                <LoaderCircle className="h-8 w-8 animate-spin mb-3" />
                                <span className="text-base font-medium">Loading chats…</span>
                                <span className="text-xs text-[#8696a0] mt-2">This may take up to a minute on first login.</span>
                            </div>
                        ) : chatsError ? (
                            <div className="flex flex-col items-center justify-center h-full py-10 text-red-400">
                                <MessageSquare className="h-8 w-8 mb-3" />
                                <span className="text-base font-medium">{chatsError}</span>
                                <span className="text-xs text-[#8696a0] mt-2">Please try again or refresh the page.</span>
                            </div>
                        ) : chats.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full py-10 text-[#8696a0]">
                                <MessageSquare className="h-8 w-8 mb-3" />
                                <span className="text-base font-medium">No chats found</span>
                            </div>
                        ) : (
                            <>
                                {chats.map((chat) => {
                                    const isActive = chat.id === selectedChatId;
                                    return (
                                        <button
                                            key={chat.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedChatId(chat.id);
                                                setMobileSidebarOpen(false);
                                            }}
                                            className={`grid w-full grid-cols-[56px_1fr_auto] gap-3 border-b border-white/6 px-4 py-3 text-left transition ${isActive ? "bg-[#2a3942]" : "hover:bg-[#202c33]"}`}
                                        >
                                            <ChatAvatar chat={chat} sizeClassName="h-12 w-12" />
                                            <div className="min-w-0">
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="truncate text-[15px] font-medium text-[#e9edef]">{chat.name}</p>
                                                </div>
                                                <p className="mt-1 truncate text-sm text-[#8696a0]">{chat.lastMessage}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-2 text-xs text-[#8696a0]">
                                                <span>{formatTime(chat.timestamp)}</span>
                                                {chat.unreadCount > 0 ? (
                                                    <span className="flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#00a884] px-1 text-[11px] font-semibold text-[#111b21]">
                                                        {chat.unreadCount}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </button>
                                    );
                                })}
                                {hasMoreChats && (
                                    <div className="flex justify-center py-2">
                                        <button
                                            type="button"
                                            onClick={loadMoreChats}
                                            className="rounded-lg bg-[#202c33] px-4 py-2 text-sm text-[#00a884] hover:bg-[#2a3942]"
                                        >
                                            Load more chats
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </aside>

                <section className={`${mobileSidebarOpen ? "hidden" : "flex"} min-w-0 flex-1 flex-col bg-[#0b141a] md:flex`}>
                    {selectedChat ? (
                        <>
                            <header className="flex items-center justify-between bg-[#202c33] px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setMobileSidebarOpen(true)}
                                        className="rounded-full p-2 text-[#aebac1] transition hover:bg-white/8 hover:text-white md:hidden"
                                    >
                                        <ArrowLeft className="h-5 w-5" />
                                    </button>
                                    <ChatAvatar chat={selectedChat} sizeClassName="h-10 w-10" />
                                    <div>
                                        <p className="text-sm font-medium">{selectedChat.name}</p>
                                        <p className="text-xs text-[#8696a0]">{selectedChat.isGroup ? "Group" : "Click here for contact info"}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 text-[#aebac1]">
                                    <button type="button" className="rounded-full p-2 transition hover:bg-white/8 hover:text-white"><Video className="h-5 w-5" /></button>
                                    <button type="button" className="rounded-full p-2 transition hover:bg-white/8 hover:text-white"><Phone className="h-5 w-5" /></button>
                                    <button type="button" className="rounded-full p-2 transition hover:bg-white/8 hover:text-white"><Search className="h-5 w-5" /></button>
                                    <button type="button" className="rounded-full p-2 transition hover:bg-white/8 hover:text-white"><MoreVertical className="h-5 w-5" /></button>
                                </div>
                            </header>

                            <div className="relative flex-1 overflow-hidden bg-[#efeae2] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.45),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.12))]">
                                <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22 viewBox=%220 0 200 200%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22 opacity=%220.08%22%3E%3Ccircle fill=%22%2325d366%22 cx=%2225%22 cy=%2225%22 r=%222%22/%3E%3Ccircle fill=%22%23075e54%22 cx=%22130%22 cy=%2250%22 r=%222%22/%3E%3Ccircle fill=%22%2325d366%22 cx=%2290%22 cy=%22140%22 r=%222%22/%3E%3Cpath fill=%22%23075e54%22 d=%22M165 136l11 11-11 11-11-11z%22/%3E%3C/g%3E%3C/svg%3E')] opacity-40" />
                                <div ref={messagesContainerRef} className="no-scrollbar relative z-10 flex h-full flex-col gap-6 overflow-y-auto px-4 py-6 md:px-12">
                                    {canLoadMore && (
                                        <div className="flex justify-center pt-1">
                                            <button
                                                type="button"
                                                onClick={handleLoadMore}
                                                disabled={isLoadingMore}
                                                className="flex items-center gap-2 rounded-full bg-white/80 px-4 py-1.5 text-xs font-medium text-[#54656f] shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {isLoadingMore ? (
                                                    <><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Loading…</>
                                                ) : (
                                                    "Load older messages"
                                                )}
                                            </button>
                                        </div>
                                    )}
                                    {groupedMessages.map((group) => (
                                        <div key={group.label}>
                                            <div className="mb-4 flex justify-center">
                                                <span className="rounded-lg bg-[rgba(255,255,255,0.78)] px-3 py-1 text-xs text-[#54656f] shadow-sm">
                                                    {group.label}
                                                </span>
                                            </div>
                                            <div className="space-y-2.5">
                                                {group.items.map((message) => (
                                                    <div
                                                        key={message.id}
                                                        className={`flex ${message.fromMe ? "justify-end" : "justify-start"}`}
                                                    >
                                                        <div
                                                            className={`group max-w-[85%] rounded-xl px-3 py-2 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] md:max-w-[70%] ${message.fromMe ? "rounded-tr-sm bg-[#d9fdd3] text-[#111b21]" : "rounded-tl-sm bg-white text-[#111b21]"}`}
                                                        >
                                                            {message.author && !message.fromMe ? (
                                                                <p className="mb-1 text-xs font-medium text-[#667781]">{message.author}</p>
                                                            ) : null}

                                                            {editingMessageId === message.id ? (
                                                                <div className="space-y-2">
                                                                    <textarea
                                                                        value={editingDraft}
                                                                        onChange={(event) => setEditingDraft(event.target.value)}
                                                                        rows={2}
                                                                        className="w-full resize-y rounded-md border border-[#b8c4cc] bg-white/70 px-2 py-1 text-sm outline-none focus:border-[#00a884]"
                                                                    />
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={cancelEdit}
                                                                            className="rounded-md px-2 py-1 text-xs text-[#54656f] hover:bg-black/10"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={saveEdit}
                                                                            className="rounded-md bg-[#00a884] px-2 py-1 text-xs font-medium text-[#111b21] hover:bg-[#06b48f]"
                                                                        >
                                                                            Save
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : message.hasMedia ? (
                                                                <MessageMedia message={message} />
                                                            ) : (
                                                                <p className="wrap-break-word whitespace-pre-wrap text-[14px] leading-6">{message.body || "Unsupported message"}</p>
                                                            )}

                                                            {/* Temporarily disabled: Edit/Delete actions */}
                                                            {false && message.fromMe && editingMessageId !== message.id ? (
                                                                <div className="mt-1 flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => startEdit(message)}
                                                                        disabled={!canEditMessage(message)}
                                                                        className="rounded p-1 text-[#54656f] hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                                                                        title="Edit message"
                                                                    >
                                                                        <Pencil className="h-3.5 w-3.5" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDelete(message.id)}
                                                                        className="rounded p-1 text-[#54656f] hover:bg-black/10"
                                                                        title="Delete message"
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </button>
                                                                </div>
                                                            ) : null}

                                                            <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-[#667781]">
                                                                <span>{formatTime(message.timestamp)}</span>
                                                                {message.fromMe ? (
                                                                    message.ack && message.ack > 1 ? (
                                                                        <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
                                                                    ) : (
                                                                        <Check className="h-3.5 w-3.5" />
                                                                    )
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <footer className="bg-[#202c33] px-3 py-3 md:px-4">
                                <MessageComposer isSending={isSending} onSend={sendMessage} />
                            </footer>
                        </>
                    ) : (
                        <div className="flex flex-1 items-center justify-center bg-[#222e35] px-6 text-center text-[#d1d7db]">
                            <div>
                                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/10">
                                    <MessageSquare className="h-10 w-10 text-[#00a884]" />
                                </div>
                                <h2 className="text-3xl font-light">WhatsApp for Admin</h2>
                                <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[#8696a0]">
                                    Choose a chat from the conversation list to start reading and replying in real time.
                                </p>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}

export default WhatsAppDesktop;