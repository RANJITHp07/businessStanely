"use client"

import { useParams } from "next/navigation"
import { useState, useEffect } from "react"
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
import { cn } from "@/lib/utils"

interface oppurtunities {
    id: string
    name: string
    phoneNumber: string
    description: string
    amount?: number
    nextFollowUp?: string
    status: "Proposal Issued" | "Closed as Won" | "Closed as Loss"
    createdAt: string
    updatedAt: string
    prospect?: {
        name: string;
        email?: string;
        leadSource?: string;
        createdByAgent?: { name?: string };
        address?: string;
        assignedAgent?: {
            id?: string;
            name?: string;
            email?: string;
        };
    };
}

export default function OppurtunitiesDetailPage() {
    const [oppurtunities, setoppurtunities] = useState<oppurtunities | null>(null)
    interface Comment {
        id: string;
        content: string;
        createdAt: string;
        agent?: { name?: string };
        user?: { username?: string };
        attachmentName?: string;
        attachmentUrl?: string;
    }

    const [comments, setComments] = useState<Comment[]>([])
    const [loading, setLoading] = useState(true)
    const [newComment, setNewComment] = useState("")
    const [attachments, setAttachments] = useState<File[]>([])
    const [submitting, setSubmitting] = useState(false)
    const [nextFollowUpDate, setNextFollowUpDate] = useState<Date | undefined>(undefined)


    // Use useParams from next/navigation for dynamic route params in client components
    const params = useParams();
    const opportunityId = params.id;

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const res = await fetch(`/api/opportunities/${opportunityId}`);
                const data = await res.json();
                setoppurtunities(data.opportunity || null);
                setComments(data.opportunity?.comments || []);
                if (data.opportunity && data.opportunity.nextFollowUp) {
                    setNextFollowUpDate(new Date(data.opportunity.nextFollowUp));
                }
            } catch {
                // ignore
            }
            setLoading(false);
        }
        fetchData();
    }, [opportunityId]);

    const handleNextFollowUpChange = async (date: Date | undefined) => {
        setNextFollowUpDate(date)
        if (oppurtunities && date) {
            setoppurtunities({ ...oppurtunities, nextFollowUp: date.toISOString().split("T")[0] })
            const res = await fetch(`/api/opportunities/${oppurtunities.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...oppurtunities, nextFollowUp: date }),
            });
            if (!res.ok) {
                console.error("Failed to update status");
                return;
            }
        }
    }

    const handleStatusChange = async (newStatus: "Proposal Issued" | "Closed as Won" | "Closed as Loss") => {
        if (oppurtunities) {
            setoppurtunities({ ...oppurtunities, status: newStatus })
            const res = await fetch(`/api/opportunities/${oppurtunities.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...oppurtunities, status: newStatus }),
            });
            if (!res.ok) {
                console.error("Failed to update status");
                return;
            }
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

    const handleSubmitComment = async () => {
        if (!newComment.trim() && attachments.length === 0) return;
        setSubmitting(true);
        try {
            // TODO: Replace with actual user context
            const res = await fetch(`/api/opportunities/${opportunityId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: newComment,
                    // Attachments logic can be expanded here
                }),
            });
            if (res.ok) {
                const { comment } = await res.json();
                setComments([comment, ...comments]);
                setNewComment("");
                setAttachments([]);
            }
        } catch {
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

    if (!oppurtunities) {
        return (
            <div className="container mx-auto p-6 max-w-7xl">
                <div className="text-center py-12">
                    <h2 className="text-2xl font-bold">oppurtunities not found</h2>
                    <Link href="/oppurtunitiess">
                        <Button className="mt-4">Back to oppurtunitiess</Button>
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-6">
                <div className="mb-7">
                    <h1 className="text-[28px] md:text-3xl font-bold"></h1>
                    <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
                        Detailed overview of oppurtunities information, engagement, and current status
                    </p>
                </div>
                <Card>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-bold">{oppurtunities?.prospect?.name}</h1>
                                <p className="text-muted-foreground mt-1">{oppurtunities?.prospect?.email}</p>
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
                                                disabled={true}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col gap-1">
                                        <p className="text-sm text-muted-foreground mb-1">Status</p>
                                        <Select
                                            disabled={true}
                                            value={oppurtunities.status} onValueChange={handleStatusChange}>
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="New Opportunity">New Opportunity</SelectItem>
                                                <SelectItem value="Proposal Issued">Proposal Issued</SelectItem>
                                                <SelectItem value="Closed as Won">Closed as Won</SelectItem>
                                                <SelectItem value="Closed as Loss">Closed as Loss</SelectItem>

                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 space-y-6">
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
                                        <p className="font-medium truncate">{oppurtunities.phoneNumber}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-green-100 text-green-700">
                                        <Mail className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-muted-foreground">Email</p>
                                        <p className="font-medium truncate">{oppurtunities.prospect?.email || '-'}</p>
                                    </div>
                                </div>
                            </div>
                            {oppurtunities.prospect?.address && (
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                                        <MapPin className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-muted-foreground">Address</p>
                                        <p className="font-medium">{oppurtunities.prospect.address}</p>
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
                            <p className="text-muted-foreground leading-relaxed">{oppurtunities.description}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Amount</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground leading-relaxed">{oppurtunities.amount !== undefined ? `$${oppurtunities.amount}` : '—'}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquare className="h-5 w-5" />
                                Interactions
                            </CardTitle>
                            <CardDescription>Add notes, comments, and track all interactions with this oppurtunities</CardDescription>
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
                                            {comment.attachmentUrl && (
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
                                    placeholder="Add a note or comment about this oppurtunities..."
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
                                    <Button onClick={handleSubmitComment} disabled={submitting} className="gap-2">
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
                                        <input type="file" id="file-upload" multiple className="hidden" onChange={handleFileSelect} />
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
                                    className={`mt-1 ${oppurtunities.status === "Proposal Issued"
                                        ? "bg-amber-100 text-amber-800"
                                        : oppurtunities.status === "Closed as Won"
                                            ? "bg-green-100 text-green-800"
                                            : "bg-red-100 text-red-800"}`}
                                >
                                    {oppurtunities.status}
                                </Badge>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-sm text-muted-foreground">Lead Source</p>
                                <p className="font-medium mt-1">{oppurtunities.prospect?.leadSource?.name || 'N/A'}</p>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-sm text-muted-foreground">Created By</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center">
                                        <User className="h-3 w-3 text-emerald-700" />
                                    </div>
                                    <p className="font-medium">{oppurtunities.prospect?.createdByAgent?.name || "Unknown"}</p>
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
                                        {oppurtunities.prospect?.assignedAgent?.name
                                            ? oppurtunities.prospect?.assignedAgent.name
                                            : oppurtunities.prospect?.assignedTo || "Unassigned"}
                                    </p>
                                </div>
                            </div>
                            <Separator />
                            {/*
                            <div>
                                <p className="text-sm text-muted-foreground">Assigned To</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                        <User className="h-3 w-3 text-primary" />
                                    </div>
                                    <p className="font-medium">{oppurtunities.assignedTo || "Unassigned"}</p>
                                </div>
                            </div>
                            <Separator />
                            */}
                            {/*
                            <div>
                                <p className="text-sm text-muted-foreground">Last Follow Up</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <p className="font-medium">
                                        {oppurtunities.lastFollowUp
                                            ? new Date(oppurtunities.lastFollowUp).toLocaleDateString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                            })
                                            : "No follow-up yet"}
                                    </p>
                                </div>
                            </div>
                            <Separator />
                            */}

                            <div>
                                <p className="text-sm text-muted-foreground">Created</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <p className="font-medium">{formatDate(oppurtunities.createdAt)}</p>
                                </div>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-sm text-muted-foreground">Last Updated</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <p className="font-medium">{formatDate(oppurtunities.updatedAt)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div >
    )
}
