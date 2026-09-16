"use client"

import type React from "react"

import { use, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import {
    ArrowLeft,
    ArrowRight,
    Ban,
    ThumbsUp,
    Building2,
    Calendar,
    CheckCircle2,
    Clock,
    CreditCard,
    Eye,
    EyeOff,
    Loader2,
    Mail,
    MessageSquare,
    Paperclip,
    Phone,
    Send,
    User,
    X,
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "react-toastify"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import { uploadFileToS3Direct } from "@/lib/directUpload"

/* Detail view for a single website enquiry, built to match the lead detail
   screen: contact block, the submission itself, and an interaction feed an
   agent can add to while deciding whether this becomes a lead. */

type Comment = {
    id: string
    content: string
    createdAt: string
    authorType?: string
    visibleToClient?: boolean
    agent?: { name?: string } | null
    user?: { username?: string } | null
    attachmentName?: string | null
    attachmentUrl?: string | null
    attachmentType?: string | null
    attachments?: Array<{ name: string; url: string; size: number; type: string }> | null
}

type Enquiry = {
    id: string
    name: string
    email: string
    phone?: string | null
    company?: string | null
    services: string[]
    payment?: string | null
    notes?: string | null
    source: string
    status: string
    convertedProspectId?: string | null
    convertedAt?: string | null
    convertedByAgent?: { id: string; name: string } | null
    assignedAgent?: { id: string; name: string } | null
    createdAt: string
    updatedAt: string
    comments?: Comment[]
}


const MANAGEMENT_BASE_URL = "https://management.legalstanley.com"

/**
 * Attachments are stored three ways: an absolute URL on the oldest rows, a
 * path served by the management host, and — for anything uploaded to S3,
 * including every file a client attaches in the portal — a bare bucket key.
 * A key is resolved through /api/attachments, which signs it; the bucket is
 * private, so a key is not reachable on its own.
 */
function getAttachmentUrl(url?: string | null) {
    if (!url) return ""
    if (url.startsWith("http://") || url.startsWith("https://")) return url
    if (url.startsWith("uploads/")) {
        return `/api/attachments?key=${encodeURIComponent(url)}`
    }
    return `${MANAGEMENT_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`
}

function isAudioAttachment(type?: string | null, name?: string | null) {
    return Boolean(
        type?.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(name || ""),
    )
}

function statusBadge(status: string) {
    const s = status.toLowerCase()
    if (s === "new")
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">New</Badge>
    if (s === "reviewed")
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Reviewed</Badge>
    if (s === "converted")
        return <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">Converted</Badge>
    return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">Spam</Badge>
}

function formatDate(dateString?: string | null) {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return "N/A"
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

export default function EnquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)

    const [enquiry, setEnquiry] = useState<Enquiry | null>(null)
    const [comments, setComments] = useState<Comment[]>([])
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)

    const [newComment, setNewComment] = useState("")
    const [attachments, setAttachments] = useState<File[]>([])
    const [submitting, setSubmitting] = useState(false)
    const [uploadPercent, setUploadPercent] = useState(0)
    const [uploadMessage, setUploadMessage] = useState("")
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [keepInternal, setKeepInternal] = useState(false)

    /* Accepting an enquiry creates the lead, so it needs the same agent and
       lead-source choice the enquiries list asks for. */
    const [acceptOpen, setAcceptOpen] = useState(false)
    const [agents, setAgents] = useState<{ id: string; name: string }[]>([])
    const [leadSources, setLeadSources] = useState<{ id: string; name: string }[]>([])
    const [assignedAgentId, setAssignedAgentId] = useState("")
    const [leadSourceId, setLeadSourceId] = useState("")

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetchWithAuth(`/api/enquiries/${id}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to load enquiry")
            setEnquiry(data.enquiry || null)
            setComments(data.enquiry?.comments || [])
        } catch (error: any) {
            toast.error(error.message || "Failed to load enquiry")
            setEnquiry(null)
        } finally {
            setLoading(false)
        }
    }, [id])

    useEffect(() => {
        load()
    }, [load])

    async function setStatus(status: string) {
        if (!enquiry) return
        setBusy(true)
        try {
            const res = await fetchWithAuth(`/api/enquiries/${enquiry.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to update")
            toast.success(`Marked as ${status}`)
            setEnquiry((prev) => (prev ? { ...prev, status: data.enquiry?.status ?? status } : prev))
        } catch (error: any) {
            toast.error(error.message || "Failed to update enquiry")
        } finally {
            setBusy(false)
        }
    }

    /* Agents and lead sources are only needed once Accept is opened, so they
       are fetched on demand rather than on every page load. */
    async function openAccept() {
        setAssignedAgentId(enquiry?.assignedAgent?.id ?? "")
        setLeadSourceId("")
        setAcceptOpen(true)
        try {
            const [agentsRes, sourcesRes] = await Promise.all([
                fetchWithAuth("/api/agents"),
                fetchWithAuth("/api/lead_source"),
            ])
            const agentsData = await agentsRes.json()
            const sourcesData = await sourcesRes.json()
            setAgents(Array.isArray(agentsData) ? agentsData : agentsData?.agents ?? [])
            setLeadSources(Array.isArray(sourcesData) ? sourcesData : sourcesData?.leadSources ?? [])
        } catch {
            toast.error("Could not load agents and lead sources")
        }
    }

    async function accept() {
        if (!enquiry) return
        if (!assignedAgentId) {
            toast.error("Select an agent to assign this lead to")
            return
        }
        setBusy(true)
        try {
            const res = await fetchWithAuth(`/api/enquiries/${enquiry.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "convert",
                    assignedAgentId,
                    leadSourceId: leadSourceId || undefined,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to accept enquiry")
            toast.success("Enquiry accepted")
            setAcceptOpen(false)
            load()
        } catch (error: any) {
            toast.error(error.message || "Failed to accept enquiry")
        } finally {
            setBusy(false)
        }
    }

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.files) {
            setAttachments([...attachments, ...Array.from(e.target.files)])
        }
    }

    function removeAttachment(index: number) {
        setAttachments(attachments.filter((_, i) => i !== index))
    }

    async function handleSubmitComment() {
        if (!newComment.trim() && attachments.length === 0) return
        setSubmitting(true)
        setUploadError(null)
        try {
            let attachmentData: object = {}
            if (attachments.length > 0) {
                try {
                    const uploaded: Array<{ name: string; url: string; size: number; type: string }> = []
                    for (let i = 0; i < attachments.length; i++) {
                        const file = attachments[i]
                        const uploadResult = await uploadFileToS3Direct(file, {
                            onProgress: (progress) => {
                                setUploadPercent(
                                    Math.round(((i / attachments.length) + progress.percent / 100 / attachments.length) * 100),
                                )
                                setUploadMessage(`Uploading ${file.name}: ${progress.message}`)
                            },
                        })
                        uploaded.push({
                            name: uploadResult.originalName,
                            size: uploadResult.size,
                            type: uploadResult.type,
                            url: uploadResult.url,
                        })
                    }
                    attachmentData = { attachments: uploaded }
                } catch (error) {
                    setUploadError(error instanceof Error ? error.message : "Upload failed. Please retry.")
                    setSubmitting(false)
                    return
                }
            }

            const res = await fetchWithAuth(`/api/enquiries/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: newComment,
                    visibleToClient: !keepInternal,
                    ...attachmentData,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to add interaction")

            setComments((prev) => [data.comment, ...prev])
            setNewComment("")
            setKeepInternal(false)
            setAttachments([])
            setUploadPercent(0)
            setUploadMessage("")
            setUploadError(null)
        } catch (error: any) {
            toast.error(error.message || "Failed to add interaction")
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    if (!enquiry) {
        return (
            <div className="container mx-auto p-6 max-w-7xl">
                <div className="text-center py-12">
                    <h2 className="text-2xl font-bold">Enquiry not found</h2>
                    <Link href="/dashboard/enquiries">
                        <Button className="mt-4">Back to Enquiries</Button>
                    </Link>
                </div>
            </div>
        )
    }

    const isConverted = enquiry.status === "Converted"

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-6">
                <div className="mb-7">
                    <Link
                        href="/dashboard/enquiries"
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Enquiries
                    </Link>
                    <h1 className="text-[28px] md:text-3xl font-bold mt-3">Enquiry Details</h1>
                    <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
                        Website submission awaiting review, with the full interaction history
                    </p>
                </div>

                <Card>
                    <CardContent className="space-y-4 pt-6">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <h2 className="text-3xl font-bold">{enquiry.name}</h2>
                                <div className="flex items-center gap-2 mt-2">
                                    {statusBadge(enquiry.status)}
                                    <span className="text-sm text-muted-foreground">
                                        Received {formatDate(enquiry.createdAt)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {isConverted ? (
                                    <>
                                        {/* Disabled on purpose: this states that the enquiry is
                                            already converted. Converting is irreversible, so there
                                            is nothing left to click. */}
                                        <Button
                                            disabled
                                            className="bg-violet-600 hover:bg-violet-600 disabled:opacity-100"
                                        >
                                            <CheckCircle2 className="mr-2 h-4 w-4" />
                                            Converted
                                        </Button>
                                        {enquiry.convertedProspectId && (
                                            <Link href={`/dashboard/prospects/${enquiry.convertedProspectId}`}>
                                                <Button variant="outline">
                                                    <ArrowRight className="mr-2 h-4 w-4" />
                                                    Open lead
                                                </Button>
                                            </Link>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {enquiry.status !== "Reviewed" && (
                                            <Button variant="outline" disabled={busy} onClick={() => setStatus("Reviewed")}>
                                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                                Mark Reviewed
                                            </Button>
                                        )}
                                        <Button disabled={busy} onClick={openAccept}>
                                            <ThumbsUp className="mr-2 h-4 w-4" />
                                            Accept
                                        </Button>
                                        {enquiry.status !== "Spam" && (
                                            <Button variant="outline" disabled={busy} onClick={() => setStatus("Spam")}>
                                                <Ban className="mr-2 h-4 w-4" />
                                                Mark Spam
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Contact Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-green-100 text-green-700">
                                        <Mail className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-muted-foreground">Email</p>
                                        <p className="font-medium truncate">{enquiry.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                                        <Phone className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-muted-foreground">Phone Number</p>
                                        <p className="font-medium truncate">{enquiry.phone || "Not provided"}</p>
                                    </div>
                                </div>
                            </div>
                            {enquiry.company && (
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                                        <Building2 className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-muted-foreground">Company</p>
                                        <p className="font-medium">{enquiry.company}</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Services Requested</CardTitle>
                            <CardDescription>Ticked on the website form by the visitor</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {enquiry.services.length === 0 ? (
                                <p className="text-muted-foreground">No services were selected.</p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {enquiry.services.map((service) => (
                                        <Badge key={service} variant="secondary" className="text-sm font-normal">
                                            {service}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Notes from the Visitor</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {enquiry.notes || "No additional notes were submitted."}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquare className="h-5 w-5" />
                                Interactions
                            </CardTitle>
                            <CardDescription>
                                Internal notes, messages shared with the client, and their replies
                                from the portal
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                {comments.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-8">No interactions yet</p>
                                ) : (
                                    comments.map((comment) => (
                                        <div
                                            key={comment.id}
                                            className={`border rounded-lg p-4 space-y-3 ${comment.authorType === "CLIENT" ? "bg-blue-50/60 border-blue-200" : ""}`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-2">
                                                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${comment.authorType === "CLIENT" ? "bg-blue-100" : "bg-primary/10"}`}>
                                                        <User className={`h-4 w-4 ${comment.authorType === "CLIENT" ? "text-blue-700" : "text-primary"}`} />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm">
                                                            {comment.authorType === "CLIENT"
                                                                ? `${enquiry.name} (client)`
                                                                : comment.agent?.name || comment.user?.username || "Unknown"}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {formatDate(comment.createdAt)}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Whether the client can see this. A reply they wrote is
                                                    theirs already, so it is not labelled. */}
                                                {comment.authorType !== "CLIENT" && (
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            comment.visibleToClient
                                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                : "bg-slate-50 text-slate-600 border-slate-200"
                                                        }
                                                    >
                                                        {comment.visibleToClient ? (
                                                            <><Eye className="mr-1 h-3 w-3" />Shared with client</>
                                                        ) : (
                                                            <><EyeOff className="mr-1 h-3 w-3" />Internal note</>
                                                        )}
                                                    </Badge>
                                                )}
                                            </div>

                                            {comment.content && (
                                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                                            )}

                                            {comment.attachments && comment.attachments.length > 0 && (
                                                <div className="flex flex-wrap gap-2 pt-2">
                                                    {comment.attachments.map((att, idx) =>
                                                        isAudioAttachment(att.type, att.name || att.url) ? (
                                                            <div
                                                                key={idx}
                                                                className="flex w-full flex-col gap-1 bg-muted px-2 py-1.5 rounded border"
                                                            >
                                                                <span className="text-xs text-muted-foreground font-medium truncate">
                                                                    {att.name}
                                                                </span>
                                                                <audio controls className="w-full">
                                                                    <source src={getAttachmentUrl(att.url)} />
                                                                    Your browser does not support the audio element.
                                                                </audio>
                                                            </div>
                                                        ) : (
                                                            <a
                                                                key={idx}
                                                                href={getAttachmentUrl(att.url)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-sm hover:bg-muted/80 transition-colors"
                                                            >
                                                                <Paperclip className="h-3 w-3 shrink-0" />
                                                                <span className="max-w-[150px] truncate">{att.name}</span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    ({(att.size / 1024).toFixed(1)} KB)
                                                                </span>
                                                            </a>
                                                        ),
                                                    )}
                                                </div>
                                            )}

                                            {!comment.attachments && comment.attachmentUrl && (
                                                <div className="flex flex-wrap gap-2 pt-2">
                                                    {isAudioAttachment(comment.attachmentType, comment.attachmentName || comment.attachmentUrl) ? (
                                                        <div className="flex w-full flex-col gap-1 bg-muted px-2 py-1.5 rounded border">
                                                            <span className="text-xs text-muted-foreground font-medium truncate">
                                                                {comment.attachmentName}
                                                            </span>
                                                            <audio controls className="w-full">
                                                                <source src={getAttachmentUrl(comment.attachmentUrl)} />
                                                                Your browser does not support the audio element.
                                                            </audio>
                                                        </div>
                                                    ) : (
                                                        <a
                                                            href={getAttachmentUrl(comment.attachmentUrl)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-sm hover:bg-muted/80 transition-colors"
                                                        >
                                                            <Paperclip className="h-3 w-3" />
                                                            {comment.attachmentName}
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <Label htmlFor="new-interaction">Add Interaction</Label>
                                <Textarea
                                    id="new-interaction"
                                    placeholder="Write a message to the client, or tick Keep internal for a private note..."
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    rows={4}
                                />

                                {attachments.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {attachments.map((file, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-sm"
                                            >
                                                <Paperclip className="h-3 w-3" />
                                                <span className="max-w-[200px] truncate">{file.name}</span>
                                                <button
                                                    onClick={() => removeAttachment(index)}
                                                    className="ml-1 hover:text-destructive transition-colors"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Unticked by default: a message written here is meant for
                                    the client, so it goes to their portal unless the agent
                                    deliberately holds it back. */}
                                <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
                                    <input
                                        type="checkbox"
                                        checked={keepInternal}
                                        onChange={(e) => setKeepInternal(e.target.checked)}
                                        className="h-4 w-4 rounded border-input"
                                    />
                                    <span className="flex items-center gap-1.5">
                                        <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                                        Keep internal
                                    </span>
                                    <span className="text-muted-foreground text-xs">
                                        (the client will not see this)
                                    </span>
                                </label>

                                <div className="flex items-center gap-2">
                                    <Button onClick={handleSubmitComment} disabled={submitting} className="gap-2">
                                        {submitting ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="h-4 w-4" />
                                                {keepInternal ? "Save Internal Note" : "Send to Client"}
                                            </>
                                        )}
                                    </Button>
                                    <div>
                                        <input
                                            type="file"
                                            id="file-upload"
                                            multiple
                                            className="hidden"
                                            onChange={handleFileSelect}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => document.getElementById("file-upload")?.click()}
                                            className="gap-2"
                                        >
                                            <Paperclip className="h-4 w-4" />
                                            Attach Files
                                        </Button>
                                    </div>
                                </div>

                                {attachments.length > 0 && (submitting || uploadPercent > 0 || uploadError) && (
                                    <div className="space-y-2">
                                        <Progress value={uploadPercent} className="h-2" />
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>{uploadError || uploadMessage || "Ready to upload"}</span>
                                            <span>{uploadPercent}%</span>
                                        </div>
                                        {uploadError && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={handleSubmitComment}
                                                disabled={submitting}
                                            >
                                                Retry Upload
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Status</p>
                                <div className="mt-1">{statusBadge(enquiry.status)}</div>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-sm text-muted-foreground">Payment Preference</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                                    <p className="font-medium capitalize">{enquiry.payment || "Not specified"}</p>
                                </div>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-sm text-muted-foreground">Source</p>
                                <p className="font-medium mt-1">{enquiry.source}</p>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-sm text-muted-foreground">Assigned To</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                        <User className="h-3 w-3 text-primary" />
                                    </div>
                                    <p className="font-medium">
                                        {enquiry.assignedAgent?.name || "Unassigned"}
                                    </p>
                                </div>
                            </div>
                            {isConverted && (
                                <>
                                    <Separator />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Converted By</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                                <User className="h-3 w-3 text-primary" />
                                            </div>
                                            <p className="font-medium">{enquiry.convertedByAgent?.name || "Unknown"}</p>
                                        </div>
                                    </div>
                                    <Separator />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Converted On</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                            <p className="font-medium">{formatDate(enquiry.convertedAt)}</p>
                                        </div>
                                    </div>
                                </>
                            )}
                            <Separator />
                            <div>
                                <p className="text-sm text-muted-foreground">Received</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <p className="font-medium">{formatDate(enquiry.createdAt)}</p>
                                </div>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-sm text-muted-foreground">Last Updated</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <p className="font-medium">{formatDate(enquiry.updatedAt)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ---------------- Accept ---------------- */}
            <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Accept</DialogTitle>
                        <DialogDescription>
                            Accepting creates a lead from {enquiry.name}&apos;s enquiry and assigns
                            it to an agent. The enquiry is marked as converted and the client sees
                            it as accepted. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Assign to agent</Label>
                            <Select value={assignedAgentId} onValueChange={setAssignedAgentId}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select an agent" />
                                </SelectTrigger>
                                <SelectContent>
                                    {agents.map((agent) => (
                                        <SelectItem key={agent.id} value={agent.id}>
                                            {agent.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Lead source (optional)</Label>
                            <Select value={leadSourceId} onValueChange={setLeadSourceId}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a lead source" />
                                </SelectTrigger>
                                <SelectContent>
                                    {leadSources.map((source) => (
                                        <SelectItem key={source.id} value={source.id}>
                                            {source.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAcceptOpen(false)} disabled={busy}>
                            Cancel
                        </Button>
                        <Button onClick={accept} disabled={busy || !assignedAgentId}>
                            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Accept
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}
