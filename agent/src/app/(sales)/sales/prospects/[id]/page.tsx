"use client"

import type React from "react"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import {
    Phone,
    Mail,
    MapPin,
    Calendar,
    User,
    Loader2,
    Send,
    Paperclip,
    MessageSquare,
    Clock,
    CalendarIcon,
} from "lucide-react"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { useAgentContext } from "@/lib/agent-context"
import { normalizePhoneNumber } from "@/lib/normalizePhoneNumber"
import { uploadFileToS3Direct } from "@/lib/directUpload"
import { hasAdvisorRole } from "@/lib/agentRole"
import { isLeadMaker } from "@/lib/agentType"

interface Prospect {
    id: string;
    name: string;
    phoneNumber: string;
    address?: string;
    email: string;
    leadSource: string;
    description: string;
    amount?: number | null;
    nextFollowUp?: string;
    lastFollowUp?: string;
    status: "New" | "In Progress" | "Opportunity" | "Converted";
    archived: boolean;
    createdAt: string;
    updatedAt: string;
    assignedTo?: string;
    prevFollowup?: string;
    assignedAgent?: {
        id: string;
        name: string;
        email: string;
    };
    createdByAgentId?: string;
    createdByAgent?: {
        id: string;
        name: string;
        email: string;
    };
}


interface Comment {
    id: string;
    content: string;
    createdAt: string;
    agent?: { name?: string };
    user?: { username?: string };
    attachmentName?: string;
    attachmentUrl?: string;
    attachmentType?: string;
    attachmentSize?: number;
}

export default function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const MANAGEMENT_BASE_URL = "https://management.legalstanley.com";

    const getAttachmentUrl = (url?: string) => {
        if (!url) return "";
        if (url.startsWith("http://") || url.startsWith("https://")) return url;
        return `${MANAGEMENT_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`;
    };

    const resolvedParams = use(params)
    const router = useRouter()
    const agent = useAgentContext()
    const [prospect, setProspect] = useState<Prospect | null>(null)
    const [comments, setComments] = useState<Comment[]>([])
    const [loading, setLoading] = useState(true)
    const [newComment, setNewComment] = useState("")
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [uploadPercent, setUploadPercent] = useState(0)
    const [uploadMessage, setUploadMessage] = useState("")
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [nextFollowUpDate, setNextFollowUpDate] = useState<Date | undefined>(undefined)
    const [opprunity, setOppurtunity] = useState(false)

    useEffect(() => {
        setLoading(true)
        fetch(`/api/prospects/${resolvedParams.id}`)
            .then(res => res.json())
            .then(data => {
                setProspect(data.prospect || null)
                setComments(data.prospect?.comments || [])
                if (data.prospect && data.prospect.nextFollowUp) {
                    setNextFollowUpDate(new Date(data.prospect.nextFollowUp))
                }
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [resolvedParams.id])

    const handleNextFollowUpChange = async (date: Date | undefined) => {
        setNextFollowUpDate(date)
        if (prospect && date) {
            const res = await fetch(`/api/prospects/${prospect.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...prospect, nextFollowUp: date }),
            });
            if (!res.ok) {
                return;
            }
            setProspect({ ...prospect, nextFollowUp: date.toISOString().split("T")[0] })
        }
    }

    const handleStatusChange = async (newStatus: Prospect["status"]) => {
        if (!prospect) return;
        // If status is Opportunity, create and redirect immediately
        if (newStatus === "Opportunity") {
            try {
                setOppurtunity(true)
                const res = await fetch(`/api/prospects/${prospect.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...prospect, status: newStatus }),
                });
                if (!res.ok) {
                    console.error("Failed to update status");
                    return;
                }
                const data = await res.json();
                if (data.opportunity && data.opportunity.id) {
                    // Redirect to new opportunity and prevent rendering deleted prospect
                    router.replace(`/sales/opportunites/${data.opportunity.id}`);
                } else {
                    router.replace(`/sales/opportunites/table`);
                }
            } catch (err) {
                console.error("Error updating status:", err);
            } finally {
                setOppurtunity(false)
            }
            return;
        }
        // Otherwise, update prospect as usual
        setProspect({ ...prospect, status: newStatus });
        try {
            const res = await fetch(`/api/prospects/${prospect.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...prospect, status: newStatus }),
            });
            if (!res.ok) {
                console.error("Failed to update status");
            }
        } catch (err) {
            console.error("Error updating status:", err);
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setSelectedFile(file)
            setUploadPercent(0)
            setUploadMessage("")
            setUploadError(null)
        }
    }

    const isCommentDisabled = prospect?.archived || prospect?.status === "Converted" || prospect?.status === "Opportunity";
    const handleSubmitComment = async () => {
        if (!newComment.trim() && !selectedFile) return;
        setSubmitting(true);
        setUploadError(null);
        try {
            let attachmentData = {}
            if (selectedFile) {
                try {
                    const uploadResult = await uploadFileToS3Direct(selectedFile, {
                        onProgress: (progress) => {
                            setUploadPercent(progress.percent)
                            setUploadMessage(progress.message)
                        },
                    });
                    attachmentData = {
                        attachmentName: uploadResult.originalName,
                        attachmentSize: uploadResult.size,
                        attachmentType: uploadResult.type,
                        attachmentUrl: uploadResult.url,
                    };
                } catch (error) {
                    console.error("Failed to upload file", error)
                    setUploadError(
                        error instanceof Error ? error.message : "Upload failed. Please retry.",
                    )
                    setSubmitting(false)
                    return;
                }
            }
            // TODO: Replace with actual user context
            const authorId = agent?.id;
            const authorType = "AGENT";
            const res = await fetch(`/api/prospects/${resolvedParams.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: newComment,
                    authorId,
                    authorType,
                    ...attachmentData
                    // Attachments logic can be expanded here
                }),
            });
            if (res.ok) {
                const { comment, prospectStatus } = await res.json();
                setComments((prev) => [comment, ...prev]);
                if (prospectStatus && prospect) {
                    setProspect({ ...prospect, status: prospectStatus });
                }
                setNewComment("");
                setSelectedFile(null);
                setUploadPercent(0)
                setUploadMessage("")
                setUploadError(null)
            }
        } catch {
            // Handle error
        }
        setSubmitting(false);
    }

    const formatDate = (dateString: string) => {
        if (!dateString) return "N/A"
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    if (!prospect) {
        return (
            <div className="container mx-auto p-6 max-w-7xl">
                <div className="text-center py-12">
                    <h2 className="text-2xl font-bold">Lead not found</h2>
                    <Link href="/prospects">
                        <Button className="mt-4">Back to Leads</Button>
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-6">
                <div className="mb-7">
                    <h1 className="text-[28px] md:text-3xl font-bold">Lead Details</h1>
                    <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
                        Detailed overview of lead information, engagement, and current status
                    </p>
                </div>
                <Card>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-bold">{prospect.name}</h1>
                                <p className="text-muted-foreground mt-1">Lead Details</p>
                            </div>
                            <div className="gap-2 flex items-center">
                                <div>
                                    <p className="text-sm text-muted-foreground mb-2">Next Follow Up</p>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-full justify-start text-left font-normal",
                                                    !nextFollowUpDate && "text-muted-foreground",
                                                )}
                                                disabled={Boolean(agent && hasAdvisorRole(agent.agentRole) && isLeadMaker(agent))}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {nextFollowUpDate ? (
                                                    new Date(nextFollowUpDate).toLocaleDateString("en-US", {
                                                        month: "short",
                                                        day: "numeric",
                                                        year: "numeric",
                                                    })
                                                ) : (
                                                    <span>Pick a date</span>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <CalendarComponent
                                                mode="single"
                                                selected={nextFollowUpDate}
                                                onSelect={handleNextFollowUpChange}
                                                initialFocus
                                                disabled={(date: Date) => {
                                                    const today = new Date();
                                                    today.setHours(0, 0, 0, 0); // Reset to midnight for accurate comparison
                                                    return date < today; // disable all dates before today
                                                }}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col gap-1">
                                        <p className="text-sm text-muted-foreground mb-1">Status</p>
                                        <Select
                                            disabled={Boolean(agent && hasAdvisorRole(agent.agentRole) && isLeadMaker(agent))}
                                            value={prospect.status} onValueChange={handleStatusChange}>
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="New">New</SelectItem>
                                                <SelectItem value="In Progress">In Progress</SelectItem>
                                                <SelectItem value="Relevant but not Now">Relevant but not Now</SelectItem>
                                                <SelectItem value="Career">Career</SelectItem>
                                                <SelectItem value="Not Relevant">Not Relevant
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <Button className="mt-6" disabled={opprunity} onClick={() => router.push(`/sales/prospects/${prospect.id}/edit?opportunity=true`)}>Convert to Oppurtunity</Button>
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
                                    <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                                        <Phone className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-muted-foreground">Phone Number</p>
                                        <p className="font-medium truncate">{normalizePhoneNumber(prospect.phoneNumber!, prospect.dialCode).internationalNumber}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-green-100 text-green-700">
                                        <Mail className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-muted-foreground">Email</p>
                                        <p className="font-medium truncate">{prospect.email}</p>
                                    </div>
                                </div>
                            </div>
                            {prospect.address && (
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                                        <MapPin className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-muted-foreground">Address</p>
                                        <p className="font-medium">{prospect.address}</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Description</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground leading-relaxed">{prospect.description}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Amount</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground  leading-relaxed">
                                {prospect.amount !== null && prospect.amount !== undefined
                                    ? `The amount for this prospect is ₹${prospect.amount}`
                                    : 'No amount has been set for this prospect.'}
                            </p>
                        </CardContent>
                    </Card>


                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquare className="h-5 w-5" />
                                Interactions
                            </CardTitle>
                            <CardDescription>Add notes, comments, and track all interactions with this prospect</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                {comments.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-8">No interactions yet</p>
                                ) : (
                                    comments.map((comment) => (
                                        <div key={comment.id} className="border rounded-lg p-4 space-y-3">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                        <User className="h-4 w-4 text-primary" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm">{comment.agent?.name || comment.user?.username || "Unknown"}</p>
                                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {formatDate(comment.createdAt)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-sm leading-relaxed">{comment.content}</p>
                                            {comment.attachmentName && (
                                                <div className="mt-2">
                                                    {/* Check if attachment is an image */}
                                                    {comment.attachmentType?.startsWith("image/") &&
                                                        comment.attachmentUrl ? (
                                                        <div className="space-y-2">
                                                            {/* Image preview */}
                                                            <div className="relative inline-block">
                                                                {/* Use regular img for local URLs, Image for external URLs */}
                                                                {comment.attachmentUrl.startsWith(
                                                                    "http"
                                                                ) ? (
                                                                    <Image
                                                                        src={getAttachmentUrl(comment.attachmentUrl)}
                                                                        alt={comment.attachmentName}
                                                                        width={300}
                                                                        height={200}
                                                                        className="max-w-xs max-h-48 rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition-shadow object-cover"
                                                                        onClick={() =>
                                                                            window.open(
                                                                                getAttachmentUrl(comment.attachmentUrl),
                                                                                "_blank"
                                                                            )
                                                                        }
                                                                    />
                                                                ) : (
                                                                    <Image
                                                                        src={getAttachmentUrl(comment.attachmentUrl)}
                                                                        alt={comment.attachmentName}
                                                                        width={300}
                                                                        height={200}
                                                                        className="max-w-xs max-h-48 rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition-shadow object-cover"
                                                                        onClick={() =>
                                                                            window.open(
                                                                                getAttachmentUrl(comment.attachmentUrl),
                                                                                "_blank"
                                                                            )
                                                                        }
                                                                        unoptimized={true}
                                                                    />
                                                                )}
                                                            </div>
                                                            {/* Image file info */}
                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-2 rounded border">
                                                                <Paperclip className="h-3 w-3" />
                                                                <span className="font-medium">
                                                                    {comment.attachmentName}
                                                                </span>
                                                                <span>
                                                                    (
                                                                    {(comment.attachmentSize! / 1024).toFixed(
                                                                        1
                                                                    )}{" "}
                                                                    KB)
                                                                </span>
                                                                <a
                                                                    href={getAttachmentUrl(comment.attachmentUrl)}
                                                                    className="text-blue-600 hover:text-blue-800 underline ml-auto"
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                >
                                                                    Download
                                                                </a>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        /* Non-image file attachment */
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-2 rounded border">
                                                            <Paperclip className="h-3 w-3" />
                                                            <span className="font-medium">
                                                                {comment.attachmentName}
                                                            </span>
                                                            <span>
                                                                (
                                                                {(comment.attachmentSize! / 1024).toFixed(
                                                                    1
                                                                )}{" "}
                                                                KB)
                                                            </span>
                                                            {comment.attachmentUrl && (
                                                                <a
                                                                    href={getAttachmentUrl(comment.attachmentUrl)}
                                                                    className="text-blue-600 hover:text-blue-800 underline ml-auto"
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                >
                                                                    Download
                                                                </a>
                                                            )}
                                                        </div>
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
                                    placeholder="Add a note or comment about this prospect..."
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    rows={4}
                                />

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="file"
                                            id="file-upload"
                                            className="hidden"
                                            onChange={handleFileSelect}
                                            disabled={isCommentDisabled}
                                            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => !isCommentDisabled && document.getElementById("file-upload")?.click()}
                                            disabled={isCommentDisabled}
                                        >
                                            <Paperclip className="h-4 w-4 mr-2" />
                                            Attach File
                                        </Button>
                                        {selectedFile && (
                                            <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                                {selectedFile.name}
                                                <button
                                                    onClick={() => {
                                                        setSelectedFile(null)
                                                        setUploadPercent(0)
                                                        setUploadMessage("")
                                                        setUploadError(null)
                                                    }}
                                                    className="ml-2 text-red-500 hover:text-red-700"
                                                    disabled={isCommentDisabled}
                                                >
                                                    x
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <Button
                                        type="button"
                                        onClick={handleSubmitComment}
                                        disabled={submitting || isCommentDisabled || (!newComment.trim() && !selectedFile)}
                                    >
                                        <Send className="h-4 w-4 mr-2" />
                                        {submitting ? "Submitting..." : "Add Interaction"}
                                    </Button>
                                </div>
                                {selectedFile && (submitting || uploadPercent > 0 || uploadError) && (
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
                                                disabled={submitting || isCommentDisabled || (!newComment.trim() && !selectedFile)}
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
                                <Badge
                                    className={`mt-1 ${prospect.status === "New" ? "bg-green-100 text-green-800" : "bg-sky-100 text-sky-800"}`}
                                >
                                    {prospect.status}
                                </Badge>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-sm text-muted-foreground">Lead Source</p>
                                <p className="font-medium mt-1">{prospect.leadSource?.name}</p>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-sm text-muted-foreground">Created By</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center">
                                        <User className="h-3 w-3 text-emerald-700" />
                                    </div>
                                    <p className="font-medium">{prospect.createdByAgent?.name || "Unknown"}</p>
                                </div>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-sm text-muted-foreground">Assigned To</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                        <User className="h-3 w-3 text-primary" />
                                    </div>
                                    <p className="font-medium">
                                        {prospect.assignedAgent?.name
                                            ? prospect.assignedAgent.name
                                            : prospect.assignedTo || "Unassigned"}
                                    </p>
                                </div>
                            </div>
                            <Separator />

                            <div>
                                <p className="text-sm text-muted-foreground">Created</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <p className="font-medium">{formatDate(prospect.createdAt)}</p>
                                </div>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-sm text-muted-foreground">Last Updated</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <p className="font-medium">{formatDate(prospect.updatedAt)}</p>
                                </div>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-sm text-muted-foreground">Last FollowUp</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <p className="font-medium">{formatDate(prospect.prevFollowup || "")}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div >
    )
}
