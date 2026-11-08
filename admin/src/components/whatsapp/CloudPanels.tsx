"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Clock, LoaderCircle, MessageSquare, RefreshCw, SendHorizonal } from "lucide-react";

import type { WhatsAppState, WhatsAppTemplate } from "@/lib/whatsapp/types";

// ---------------------------------------------------------------------------
// Meta Embedded Signup (WhatsApp Business app "coexistence" onboarding)
// https://developers.facebook.com/docs/whatsapp/embedded-signup/custom-flows/onboarding-business-app-users
// ---------------------------------------------------------------------------

type FacebookSdk = {
    init(options: Record<string, unknown>): void;
    login(
        callback: (response: { authResponse?: { code?: string } | null }) => void,
        options: Record<string, unknown>,
    ): void;
};

declare global {
    interface Window {
        FB?: FacebookSdk;
        fbAsyncInit?: () => void;
    }
}

let sdkPromise: Promise<FacebookSdk> | null = null;

function loadFacebookSdk(appId: string, version: string) {
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise<FacebookSdk>((resolve, reject) => {
        window.fbAsyncInit = () => {
            window.FB!.init({ appId, autoLogAppEvents: true, xfbml: false, version });
            resolve(window.FB!);
        };
        const script = document.createElement("script");
        script.src = "https://connect.facebook.net/en_US/sdk.js";
        script.async = true;
        script.defer = true;
        script.crossOrigin = "anonymous";
        script.onerror = () => {
            sdkPromise = null;
            reject(new Error("Could not load the Facebook SDK. Check ad blockers and try again."));
        };
        document.body.appendChild(script);
    });
    return sdkPromise;
}

type SignupSession = { phoneNumberId: string; wabaId: string };

// Embedded Signup reports the selected number/WABA through postMessage; the
// FB.login callback only carries the auth code. Wait for both.
function runEmbeddedSignup(onboarding: NonNullable<WhatsAppState["onboarding"]>) {
    return new Promise<SignupSession & { code: string }>((resolve, reject) => {
        let session: SignupSession | null = null;
        let code: string | null = null;
        let settled = false;

        const finish = (error?: Error) => {
            if (settled) return;
            if (error) {
                settled = true;
                cleanup();
                reject(error);
                return;
            }
            if (session && code) {
                settled = true;
                cleanup();
                resolve({ ...session, code });
            }
        };

        const onMessage = (event: MessageEvent) => {
            if (!event.origin.endsWith("facebook.com")) return;
            try {
                const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
                if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
                console.info("[WhatsApp signup] Meta event:", data.event, data.data);
                if (String(data.event).startsWith("FINISH")) {
                    const phoneNumberId = data.data?.phone_number_id;
                    const wabaId = data.data?.waba_id;
                    if (phoneNumberId && wabaId) {
                        session = { phoneNumberId, wabaId };
                        finish();
                    }
                } else if (data.event === "CANCEL") {
                    finish(new Error(data.data?.error_message || "WhatsApp setup was cancelled."));
                }
            } catch {
                // Not an Embedded Signup message.
            }
        };

        let timeout: ReturnType<typeof setTimeout> | null = null;
        // If the Facebook window is closed without finishing, FB.login may never
        // call back. Give up after a while so the button does not spin forever.
        const overall = setTimeout(
            () => finish(new Error("WhatsApp setup did not finish. If the Facebook window closed or was blocked, allow pop-ups and try again.")),
            10 * 60 * 1000,
        );
        const cleanup = () => {
            window.removeEventListener("message", onMessage);
            if (timeout) clearTimeout(timeout);
            clearTimeout(overall);
        };
        window.addEventListener("message", onMessage);

        loadFacebookSdk(onboarding.appId, onboarding.graphApiVersion)
            .then((FB) => {
                FB.login(
                    (response) => {
                        console.info("[WhatsApp signup] login response:", response?.authResponse ? "code received" : response);
                        code = response.authResponse?.code ?? null;
                        if (!code) {
                            finish(new Error("WhatsApp setup was not completed."));
                            return;
                        }
                        // The session message normally arrives first; give it a moment.
                        // If it never comes, send the code alone: the WhatsApp service
                        // finds the account and number from the token.
                        timeout = setTimeout(() => {
                            console.info("[WhatsApp signup] no session message; the server will look up the number.");
                            session = { phoneNumberId: "", wabaId: "" };
                            finish();
                        }, 8000);
                        finish();
                    },
                    {
                        config_id: onboarding.configId,
                        response_type: "code",
                        override_default_response_type: true,
                        extras: {
                            setup: {},
                            featureType: "whatsapp_business_app_onboarding",
                            sessionInfoVersion: "3",
                        },
                    },
                );
            })
            .catch((error: Error) => finish(error));
    });
}

export function CloudConnectPanel({
    state,
    theme,
    onComplete,
}: {
    state: WhatsAppState;
    theme: "dark" | "light";
    // Omitted in the agent panel: only admins can connect the number.
    onComplete?: (input: { code: string; phoneNumberId: string; wabaId: string }) => Promise<unknown>;
}) {
    const [isConnecting, setIsConnecting] = useState(false);
    const [showGroupsLink, setShowGroupsLink] = useState(false);

    // Load the Facebook SDK up front, so clicking Connect opens the login
    // window straight away; browsers block pop-ups opened after a slow load.
    const onboarding = state.onboarding;
    useEffect(() => {
        if (!onboarding || !onComplete) return;
        loadFacebookSdk(onboarding.appId, onboarding.graphApiVersion).catch(() => undefined);
    }, [onboarding, onComplete]);

    const connect = async () => {
        if (!state.onboarding || !onComplete) return;
        setIsConnecting(true);
        try {
            const result = await runEmbeddedSignup(state.onboarding);
            await onComplete(result);
            toast.success("WhatsApp connected. Chats and history will appear as Meta syncs them.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to connect WhatsApp.");
        } finally {
            setIsConnecting(false);
        }
    };

    return (
        <div className="wa-root relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[var(--wa-bg)] px-6 py-12 text-white" data-wa-theme={theme}>
            <div className="absolute inset-x-0 top-0 h-56 bg-[#00a884]" />
            <div className="relative z-10 w-full max-w-2xl rounded-[28px] border border-white/10 bg-[var(--wa-panel)] p-10 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
                <div className="mb-8 flex items-center gap-3 text-[var(--wa-text)]">
                    <div className="rounded-2xl bg-white/8 p-3">
                        <MessageSquare className="h-7 w-7 text-[#00a884]" />
                    </div>
                    <div>
                        <p className="text-sm uppercase tracking-[0.3em] text-[var(--wa-muted)]">Admin only</p>
                        <h1 className="text-3xl font-semibold">Connect WhatsApp</h1>
                    </div>
                </div>

                {!onComplete && state.status !== "initializing" && state.status !== "idle" ? (
                    <p className="text-base leading-7 text-[#d1d7db]">
                        WhatsApp is not connected right now. Ask an admin to connect it from the admin panel.
                        {state.error ? <span className="mt-4 block text-sm text-red-400">{state.error}</span> : null}
                    </p>
                ) : state.status === "initializing" || state.status === "idle" ? (
                    <div className="flex items-center gap-3 text-sm text-[var(--wa-muted2)]">
                        <LoaderCircle className="h-5 w-5 animate-spin text-[#00a884]" />
                        Checking the WhatsApp Cloud API connection…
                    </div>
                ) : (
                    <>
                        <p className="text-base leading-7 text-[#d1d7db]">
                            Connect the firm&apos;s WhatsApp Business app number through Meta. The phone keeps working
                            as before, and messages sent from either place show up in both.
                        </p>
                        <ol className="mt-6 space-y-3 text-sm text-[var(--wa-muted2)]">
                            <li className="flex gap-4"><span className="text-[#00a884]">1</span><span>Keep the phone with the WhatsApp Business app nearby.</span></li>
                            <li className="flex gap-4"><span className="text-[#00a884]">2</span><span>Click Connect and log in to Facebook with the business account.</span></li>
                            <li className="flex gap-4"><span className="text-[#00a884]">3</span><span>Choose &quot;Connect your existing WhatsApp Business app&quot;, then scan the QR code shown with the phone.</span></li>
                            <li className="flex gap-4"><span className="text-[#00a884]">4</span><span>On the phone, allow sharing chat history.</span></li>
                        </ol>

                        {state.error ? (
                            <div className="mt-6 rounded-lg border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-400">
                                {state.error}
                            </div>
                        ) : null}

                        {state.onboarding ? (
                            <button
                                type="button"
                                onClick={connect}
                                disabled={isConnecting}
                                className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-[#00a884] px-4 py-3 text-sm font-semibold text-[#111b21] transition hover:bg-[#06b48f] disabled:cursor-not-allowed disabled:bg-[#8696a0]"
                            >
                                {isConnecting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                                {isConnecting ? "Connecting…" : "Connect WhatsApp Business app"}
                            </button>
                        ) : null}
                    </>
                )}

                {onComplete && state.channels?.groups ? (
                    <button
                        type="button"
                        onClick={() => setShowGroupsLink(true)}
                        className="mt-3 w-full rounded-lg border border-[#00a884]/50 px-4 py-3 text-sm font-semibold text-[#00a884] transition hover:bg-[#00a884]/10"
                    >
                        Link WhatsApp groups (QR)
                    </button>
                ) : null}
            </div>
            {showGroupsLink ? <GroupsLinkDialog onClose={() => setShowGroupsLink(false)} /> : null}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Groups: link the WhatsApp Web linked device (QR) from the admin panel
// ---------------------------------------------------------------------------

type GroupsLink = {
    status: string;
    linkedAs: string | null;
    groups?: number;
    error: string | null;
    qrCodeDataUrl: string | null;
};

async function groupsLinkRequest(method: "GET" | "POST", action?: "link" | "unlink") {
    const response = await fetch("/api/whatsapp/groups-link", {
        method,
        cache: "no-store",
        headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
        body: method === "POST" ? JSON.stringify({ action }) : undefined,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Could not reach the WhatsApp groups service.");
    return data as GroupsLink;
}

export function GroupsLinkDialog({ onClose }: { onClose: () => void }) {
    const [link, setLink] = useState<GroupsLink | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let stopped = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const poll = async () => {
            try {
                const next = await groupsLinkRequest("GET");
                if (stopped) return;
                setLink(next);
                setError(null);
            } catch (err) {
                if (!stopped) setError(err instanceof Error ? err.message : String(err));
            }
            if (!stopped) timer = setTimeout(poll, 3000);
        };
        // Ask for a fresh QR first, then keep polling until linked.
        groupsLinkRequest("POST", "link")
            .then((next) => !stopped && setLink(next))
            .catch((err) => !stopped && setError(err instanceof Error ? err.message : String(err)))
            .finally(() => {
                if (!stopped) timer = setTimeout(poll, 3000);
            });
        return () => {
            stopped = true;
            if (timer) clearTimeout(timer);
        };
    }, []);

    const unlink = async () => {
        if (!window.confirm("Unlink WhatsApp groups? Group chats stop until a phone scans the QR again.")) return;
        setBusy(true);
        try {
            setLink(await groupsLinkRequest("POST", "unlink"));
            toast.success("Groups unlinked.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to unlink.");
        } finally {
            setBusy(false);
        }
    };

    const linked = link?.status === "ready";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
            <div
                className="w-full max-w-md rounded-2xl border border-white/10 bg-[var(--wa-panel)] p-6 text-[var(--wa-text)] shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold">WhatsApp groups</h2>
                        <p className="mt-1 text-sm text-[var(--wa-muted2)]">
                            Groups come through WhatsApp Web, linked to a phone like a laptop would be.
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="text-sm text-[var(--wa-muted)] hover:text-[var(--wa-text)]">
                        Close
                    </button>
                </div>

                {error ? (
                    <div className="mb-4 rounded-lg border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-400">{error}</div>
                ) : null}

                {linked ? (
                    <div className="space-y-4">
                        <div className="rounded-lg bg-[#00a884]/10 px-4 py-3 text-sm text-[#00a884]">
                            Linked as {link?.linkedAs?.split(":")[0]?.split("@")[0] ?? "this phone"}
                            {typeof link?.groups === "number" ? ` · ${link.groups} groups` : ""}
                        </div>
                        <button
                            type="button"
                            onClick={unlink}
                            disabled={busy}
                            className="w-full rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 disabled:opacity-50"
                        >
                            {busy ? "Unlinking…" : "Unlink groups"}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <ol className="space-y-2 text-sm text-[var(--wa-muted2)]">
                            <li>1. On the phone, open WhatsApp Business (or WhatsApp).</li>
                            <li>2. Go to Settings → Linked devices → Link a device.</li>
                            <li>3. Scan this code.</li>
                        </ol>
                        <div className="flex min-h-[18rem] items-center justify-center rounded-xl bg-white p-4">
                            {link?.qrCodeDataUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={link.qrCodeDataUrl} alt="WhatsApp groups QR code" className="h-64 w-64" />
                            ) : (
                                <div className="flex items-center gap-2 text-sm text-[#54656f]">
                                    <LoaderCircle className="h-5 w-5 animate-spin text-[#00a884]" />
                                    {link?.status === "connecting" ? "Scan detected, linking…" : "Getting a QR code…"}
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-[var(--wa-muted)]">
                            The code refreshes by itself. Use a number that is on the WhatsApp app; a number moved fully to the
                            Meta API cannot link devices.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// 24-hour window helpers and the template composer
// ---------------------------------------------------------------------------

export function isReplyWindowOpen(windowExpiresAt: number | null | undefined, now: number) {
    return Boolean(windowExpiresAt && windowExpiresAt > now);
}

export function formatWindowRemaining(windowExpiresAt: number, now: number) {
    const minutes = Math.max(0, Math.floor((windowExpiresAt - now) / 60000));
    return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}

function fillTemplate(text: string, names: string[], values: string[]) {
    return names.reduce(
        (result, name, index) => result.split(new RegExp(`\\{\\{\\s*${name.replace(/\./g, "\\.")}\\s*\\}\\}`)).join(values[index] || `{{${name}}}`),
        text,
    );
}

export function TemplateComposer({
    templates,
    isSending,
    onLoad,
    onSend,
}: {
    templates: WhatsAppTemplate[] | null;
    isSending: boolean;
    onLoad: (refresh?: boolean) => Promise<unknown>;
    onSend: (template: WhatsAppTemplate, headerValues: string[], bodyValues: string[]) => Promise<void>;
}) {
    const [selectedKey, setSelectedKey] = useState("");
    const [headerValues, setHeaderValues] = useState<string[]>([]);
    const [bodyValues, setBodyValues] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const load = async (refresh = false) => {
        setIsLoading(true);
        try {
            await onLoad(refresh);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to load templates.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (templates === null) void load();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const template = useMemo(
        () => templates?.find((t) => `${t.name}|${t.language}` === selectedKey) ?? null,
        [templates, selectedKey],
    );

    useEffect(() => {
        setHeaderValues(template ? template.headerParams.map(() => "") : []);
        setBodyValues(template ? template.bodyParams.map(() => "") : []);
    }, [template]);

    const preview = template
        ? [
              template.headerText ? fillTemplate(template.headerText, template.headerParams, headerValues) : null,
              fillTemplate(template.bodyText, template.bodyParams, bodyValues),
              template.footerText,
          ]
              .filter(Boolean)
              .join("\n\n")
        : "";
    const isComplete =
        template !== null && headerValues.every((v) => v.trim()) && bodyValues.every((v) => v.trim());

    const submit = async () => {
        if (!template || !isComplete) return;
        try {
            await onSend(template, headerValues, bodyValues);
            setSelectedKey("");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to send template.");
        }
    };

    const field = (label: string, value: string, onChange: (next: string) => void) => (
        <label key={label} className="flex flex-col gap-1 text-xs text-[var(--wa-muted)]">
            {label}
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="rounded-md bg-[var(--wa-input)] px-3 py-2 text-sm text-[var(--wa-text)] outline-none focus:ring-1 focus:ring-[#00a884]"
            />
        </label>
    );

    return (
        <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg bg-[#3b2f12] px-3 py-2 text-xs leading-5 text-[#f5d58a]">
                <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                    The customer hasn&apos;t messaged in the last 24 hours, so WhatsApp only allows an approved
                    template here. Normal replies unlock as soon as they reply.
                </span>
            </div>
            <div className="flex items-center gap-2">
                <select
                    value={selectedKey}
                    onChange={(event) => setSelectedKey(event.target.value)}
                    disabled={isLoading}
                    className="min-w-0 flex-1 rounded-lg bg-[var(--wa-input)] px-3 py-2.5 text-sm text-[var(--wa-text)] outline-none"
                >
                    <option value="">
                        {isLoading ? "Loading templates…" : templates?.length ? "Choose a template" : "No approved templates"}
                    </option>
                    {templates?.map((t) => (
                        <option key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>
                            {t.name} ({t.language}) · {t.category.toLowerCase()}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={() => load(true)}
                    disabled={isLoading}
                    title="Reload templates"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--wa-muted2)] hover:bg-[var(--wa-hover)] hover:text-white"
                >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </button>
            </div>
            {template ? (
                <>
                    {template.headerParams.length + template.bodyParams.length > 0 ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                            {template.headerParams.map((name, index) =>
                                field(`Header {{${name}}}`, headerValues[index] ?? "", (next) =>
                                    setHeaderValues((current) => current.map((v, i) => (i === index ? next : v))),
                                ),
                            )}
                            {template.bodyParams.map((name, index) =>
                                field(`{{${name}}}`, bodyValues[index] ?? "", (next) =>
                                    setBodyValues((current) => current.map((v, i) => (i === index ? next : v))),
                                ),
                            )}
                        </div>
                    ) : null}
                    <div className="flex items-end gap-3">
                        <p className="max-h-40 flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg bg-[#d9fdd3] px-3 py-2 text-sm text-[#111b21]">
                            {preview}
                        </p>
                        <button
                            type="button"
                            onClick={submit}
                            disabled={isSending || !isComplete}
                            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#00a884] text-[#111b21] transition hover:bg-[#06b48f] disabled:cursor-not-allowed disabled:bg-[#8696a0]"
                            title="Send template"
                        >
                            {isSending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <SendHorizonal className="h-5 w-5" />}
                        </button>
                    </div>
                </>
            ) : null}
        </div>
    );
}
