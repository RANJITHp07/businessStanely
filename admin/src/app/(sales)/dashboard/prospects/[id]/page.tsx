"use client"

import type React from "react"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
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
    X,
    MessageSquare,
    Clock,
    CalendarIcon,
} from "lucide-react"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { uploadFileToS3Direct } from "@/lib/directUpload"
import { cn } from "@/lib/utils"


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
    attachments?: Array<{ name: string; url: string; size: number; type: string }>;
}

export default function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params)
    const router = useRouter()
    const [prospect, setProspect] = useState<Prospect | null>(null)
    const [comments, setComments] = useState<Comment[]>([])
    const [loading, setLoading] = useState(true)
    const [newComment, setNewComment] = useState("")
    const [attachments, setAttachments] = useState<File[]>([])
    const [submitting, setSubmitting] = useState(false)
    const [uploadPercent, setUploadPercent] = useState(0)
    const [uploadMessage, setUploadMessage] = useState("")
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [nextFollowUpDate, setNextFollowUpDate] = useState<Date | undefined>(undefined)

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
        if (e.target.files) {
            setAttachments([...attachments, ...Array.from(e.target.files)])
        }
    }

    const removeAttachment = (index: number) => {
        setAttachments(attachments.filter((_, i) => i !== index))
    }

    const isCommentDisabled = prospect?.archived || prospect?.status === "Converted" || prospect?.status === "Opportunity";

    const handleSubmitComment = async () => {
        if (isCommentDisabled) return;
        if (!newComment.trim() && attachments.length === 0) return;
        setSubmitting(true);
        setUploadError(null);
        try {
            let attachmentData: object = {}
            if (attachments.length > 0) {
                try {
                    const uploaded: Array<{ name: string; url: string; size: number; type: string }> = []
                    for (let i = 0; i < attachments.length; i++) {
                        const file = attachments[i]
                        const uploadResult = await uploadFileToS3Direct(file, {
                            onProgress: (progress) => {
                                setUploadPercent(Math.round(((i / attachments.length) + progress.percent / 100 / attachments.length) * 100))
                                setUploadMessage(`Uploading ${file.name}: ${progress.message}`)
                            },
                        });
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
                    return;
                }
            }
            const res = await fetch(`/api/prospects/${resolvedParams.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: newComment,
                    ...attachmentData
                }),
            });
            if (res.ok) {
                const { comment, prospectStatus } = await res.json();
                setComments((prev) => [comment, ...prev]);
                if (prospectStatus && prospect) {
                    setProspect({ ...prospect, status: prospectStatus });
                }
                setNewComment("");
                setAttachments([]);
                setUploadPercent(0);
                setUploadMessage("");
                setUploadError(null);
            }
        } catch (err) {
            // Handle error
        }
        setSubmitting(false);
    }

    const formatDate = (dateString: string) => {
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
                            <div className="gap-2 flex">
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
                                                disabled={true}
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
                                            disabled={true}
                                            value={prospect.status} onValueChange={handleStatusChange}>
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="New">New</SelectItem>
                                                <SelectItem value="In Progress">In Progress</SelectItem>
                                                <SelectItem value="Opportunity">Opportunity</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
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
                                        <p className="font-medium truncate">{prospect.phoneNumber}</p>
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
                                            {comment.attachments && comment.attachments.length > 0 && (
                                                <div className="flex flex-wrap gap-2 pt-2">
                                                    {comment.attachments.map((att, idx) => (
                                                        <a
                                                            key={idx}
                                                            href={att.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-sm hover:bg-muted/80 transition-colors"
                                                        >
                                                            <Paperclip className="h-3 w-3 shrink-0" />
                                                            <span className="max-w-[150px] truncate">{att.name}</span>
                                                            <span className="text-xs text-muted-foreground">({(att.size / 1024).toFixed(1)} KB)</span>
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                            {!comment.attachments && comment.attachmentUrl && (
                                                <div className="flex flex-wrap gap-2 pt-2">
                                                    <a
                                                        href={comment.attachmentUrl}
                                                        className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-sm hover:bg-muted/80 transition-colors"
                                                    >
                                                        <Paperclip className="h-3 w-3" />
                                                        {comment.attachmentName}
                                                    </a>
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

                                {attachments.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {attachments.map((file, index) => (
                                            <div key={index} className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-sm">
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

                                <div className="flex items-center gap-2">
                                    <Button onClick={handleSubmitComment} disabled={submitting || isCommentDisabled} className="gap-2">
                                        {submitting ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="h-4 w-4" />
                                                Add Interaction
                                            </>
                                        )}
                                    </Button>
                                    <div>
                                        <input type="file" id="file-upload" multiple className="hidden" onChange={handleFileSelect} disabled={isCommentDisabled} />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => !isCommentDisabled && document.getElementById("file-upload")?.click()}
                                            className="gap-2"
                                            disabled={isCommentDisabled}
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
                                                disabled={submitting || isCommentDisabled}
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
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div >
    )
}
