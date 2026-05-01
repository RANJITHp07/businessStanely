"use client"

import { useParams } from "next/navigation"
import React, { useState, useEffect } from "react"
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
import { cn } from "@/lib/utils"
import { useAgentContext } from "@/lib/agent-context"
import { normalizePhoneNumber } from "@/lib/normalizePhoneNumber"
import { Input } from "@/components/ui/input"
import { uploadFileToS3Direct } from "@/lib/directUpload"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { hasAdvisorRole } from "@/lib/agentRole"
import { isLeadMaker } from "@/lib/agentType"

interface oppurtunities {
    id: string
    name: string
    phoneNumber: string
    description: string
    amount?: number
    nextFollowUp?: string
    status: "Proposal Issued" | "Closed as Won" | "Closed as Loss" | "New Opportunity"
    createdAt: string
    updatedAt: string
    quote: string;
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

const MANAGEMENT_BASE_URL = "https://management.legalstanley.com"

const getAttachmentUrl = (url?: string) => {
    if (!url) return ""
    if (url.startsWith("http://") || url.startsWith("https://")) return url
    return `${MANAGEMENT_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`
}

export default function OppurtunitiesDetailPage() {
    const agent = useAgentContext()
    const [oppurtunities, setoppurtunities] = useState<oppurtunities | null>(null)
    interface Comment {
        id: string;
        content: string;
        createdAt: string;
        agent?: { name?: string };
        user?: { username?: string };
        commentDate?: string;
        startTime?: string;
        endTime?: string;
        attachmentType?: string;
        attachmentSize?: number;
        attachmentName?: string;
        attachmentUrl?: string;
        attachments?: Array<{ name: string; url: string; size: number; type: string }>;
    }

    const [comments, setComments] = useState<Comment[]>([])
    const [loading, setLoading] = useState(true)
    const [newComment, setNewComment] = useState("")
    const [selectedFiles, setSelectedFiles] = useState<File[]>([])
    const [uploadPercent, setUploadPercent] = useState(0)
    const [uploadMessage, setUploadMessage] = useState("")
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [nextFollowUpDate, setNextFollowUpDate] = useState<Date | undefined>(undefined)
    const [commentDate, setCommentDate] = useState<Date | undefined>(new Date())
    const [startTime, setStartTime] = useState("")
    const [endTime, setEndTime] = useState("")
    const [duration, setDuration] = useState(0)
    const fileRef = React.useRef<HTMLInputElement | null>(null)


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

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            setSelectedFiles(prev => [...prev, ...Array.from(event.target.files!)])
            setUploadPercent(0)
            setUploadMessage("")
            setUploadError(null)
            event.target.value = ""
        }
    }

    const removeSelectedFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) {
            try {
                const uploadResult = await uploadFileToS3Direct(e.target.files[0]);
                console.log("hiii", uploadResult)
                setoppurtunities({ ...oppurtunities, status: "Proposal Issued", quote: uploadResult.url! })
                const res = await fetch(`/api/opportunities/${oppurtunities?.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...oppurtunities, status: "Proposal Issued", quote: uploadResult.url! }),
                });
                if (!res.ok) {
                    console.error("Failed to update status");
                    return;
                }
            } catch (error) {
                console.error("Failed to upload file", error)
                return;
            }
        }
    }

    const getNowTime = () => {
        const d = new Date()
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    }

    const timeToMinutes = (time: string) => {
        const [h, m] = time.split(":").map(Number)
        return h * 60 + m
    }

    const addMinutes = (time: string, mins: number) => {
        const [h, m] = time.split(":").map(Number)
        const d = new Date()
        d.setHours(h, m + mins)
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    }

    const get12HourFormat = (isoDateTime?: string): string => {
        if (!isoDateTime) return ""
        const date = new Date(isoDateTime)
        if (isNaN(date.getTime())) return ""
        return date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        })
    }

    const handleSubmitComment = async () => {
        if (!newComment.trim() || !commentDate || !startTime || !endTime) return;
        setSubmitting(true);
        setUploadError(null)
        try {
            let attachmentData: object = {}
            if (selectedFiles.length > 0) {
                try {
                    const uploaded: Array<{ name: string; url: string; size: number; type: string }> = []
                    for (let i = 0; i < selectedFiles.length; i++) {
                        const file = selectedFiles[i]
                        const uploadResult = await uploadFileToS3Direct(file, {
                            onProgress: (progress) => {
                                setUploadPercent(Math.round(((i / selectedFiles.length) + progress.percent / 100 / selectedFiles.length) * 100))
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
                    console.error("Failed to upload file", error)
                    setUploadError(error instanceof Error ? error.message : "Upload failed. Please retry.")
                    setSubmitting(false)
                    return;
                }
            }

            const startDateTime = new Date(commentDate)
            const [startHour, startMinute] = startTime.split(":").map(Number)
            startDateTime.setHours(startHour, startMinute, 0)

            const endDateTime = new Date(commentDate)
            const [endHour, endMinute] = endTime.split(":").map(Number)
            endDateTime.setHours(endHour, endMinute, 0)

            const res = await fetch(`/api/opportunities/${opportunityId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: newComment,
                    commentDate: commentDate.toISOString(),
                    startTime: startDateTime.toISOString(),
                    endTime: endDateTime.toISOString(),
                    ...attachmentData
                }),
            });
            if (res.ok) {
                const { comment } = await res.json();
                setComments([comment, ...comments]);
                setNewComment("");
                setSelectedFiles([])
                setUploadPercent(0)
                setUploadMessage("")
                setUploadError(null)
                setCommentDate(new Date())
                setStartTime("")
                setEndTime("")
                setDuration(0)
            }
        } catch {
            // Handle error
        }
        setSubmitting(false);
    }

    const formatDate = (dateString?: string) => {
        if (!dateString) return "N/A"

        const parsedDate = new Date(dateString)
        if (Number.isNaN(parsedDate.getTime())) {
            return "N/A"
        }

        return parsedDate.toLocaleDateString("en-US", {
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
                    <h1 className="text-[28px] md:text-3xl font-bold">Opportunity Details</h1>
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
                                        <p className="font-medium truncate">{normalizePhoneNumber(oppurtunities?.prospect?.phoneNumber!, oppurtunities?.prospect?.dialCode!).internationalNumber || "N/A"}</p>
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
                                            {(comment.commentDate || comment.startTime || comment.endTime) && (
                                                <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 p-3 rounded-lg mt-3 mb-3">
                                                    <div className="flex flex-wrap items-center gap-6 text-blue-900">
                                                        {comment.commentDate && (
                                                            <div className="flex items-center gap-3">
                                                                <div className="bg-blue-500 rounded-full p-1.5">
                                                                    <Calendar className="h-3.5 w-3.5 text-white" />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-medium uppercase tracking-wide text-blue-700">Work Date</span>
                                                                    <span className="text-sm font-semibold">{formatDate(comment.commentDate)}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {comment.startTime && comment.endTime && (
                                                            <div className="flex items-center gap-3">
                                                                <div className="bg-blue-500 rounded-full p-1.5">
                                                                    <Clock className="h-3.5 w-3.5 text-white" />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-medium uppercase tracking-wide text-blue-700">Duration</span>
                                                                    <span className="text-sm font-semibold">
                                                                        {get12HourFormat(comment.startTime)} - {get12HourFormat(comment.endTime)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            {comment.attachments && comment.attachments.length > 0 && (
                                                <div className="flex flex-wrap gap-2 pt-2">
                                                    {comment.attachments.map((att, idx) => (
                                                        <a
                                                            key={idx}
                                                            href={getAttachmentUrl(att.url)}
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
                                                    {comment.attachmentType?.startsWith("image/") ? (
                                                        <a
                                                            href={getAttachmentUrl(comment.attachmentUrl)}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-sm hover:bg-muted/80 transition-colors"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            <Paperclip className="h-3 w-3" />
                                                            {comment.attachmentName}
                                                        </a>
                                                    ) : comment.attachmentUrl.match(/\.(mp3|wav|ogg)$/i) ? (
                                                        <div className="flex flex-col gap-1 px-2 py-1 bg-muted rounded-md text-sm w-full">
                                                            <audio controls className="w-full">
                                                                <source src={getAttachmentUrl(comment.attachmentUrl)} />
                                                                Your browser does not support the audio element.
                                                            </audio>
                                                        </div>
                                                    ) : (
                                                        <a
                                                            href={getAttachmentUrl(comment.attachmentUrl)}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-sm hover:bg-muted/80 transition-colors"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
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
                                    placeholder="Add a note or comment about this oppurtunities..."
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    rows={4}
                                />

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/50 p-4 rounded-lg">
                                    <div className="space-y-2">
                                        <Label className="text-sm">Work Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-start text-left font-normal">
                                                    <Calendar className="mr-2 h-4 w-4" />
                                                    {commentDate ? commentDate.toLocaleDateString("en-US", {
                                                        month: "short",
                                                        day: "2-digit",
                                                        year: "numeric",
                                                    }) : "Pick a date"}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <CalendarComponent
                                                    mode="single"
                                                    selected={commentDate}
                                                    onSelect={setCommentDate}
                                                    disabled={(date) => date > new Date()}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-sm">Start Time</Label>
                                        <div className="flex gap-2 items-center">
                                            <Input
                                                type="time"
                                                value={startTime}
                                                onChange={(e) => {
                                                    const value = e.target.value
                                                    setStartTime(value)
                                                    if (duration > 0 && value) {
                                                        setEndTime(addMinutes(value, duration))
                                                    }
                                                }}
                                            />
                                            <div className="flex items-center gap-1">
                                                <Checkbox onCheckedChange={(v) => v && setStartTime(getNowTime())} />
                                                <span className="text-xs">Now</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-sm">Duration (minutes)</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            value={duration}
                                            onChange={(e) => {
                                                const mins = Number(e.target.value)
                                                setDuration(mins)
                                                if (startTime && mins) {
                                                    setEndTime(addMinutes(startTime, mins))
                                                }
                                            }}
                                        />
                                    </div>

                                    <div className="space-y-2 md:col-span-3">
                                        <Label className="text-sm">End Time</Label>
                                        <Input type="text" value={endTime} readOnly />
                                        {startTime && endTime && timeToMinutes(endTime) <= timeToMinutes(startTime) && (
                                            <p className="text-xs text-destructive">End time must be greater than start time</p>
                                        )}
                                    </div>
                                </div>

                                {selectedFiles.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {selectedFiles.map((file, index) => (
                                            <div key={index} className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded flex items-center gap-1">
                                                <span className="max-w-[150px] truncate">{file.name}</span>
                                                <button
                                                    onClick={() => removeSelectedFile(index)}
                                                    className="ml-1 text-red-500 hover:text-red-700"
                                                >
                                                    x
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={handleSubmitComment}
                                        disabled={!newComment.trim() || submitting || !commentDate || !startTime || !endTime}
                                        className="gap-2"
                                    >
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
                                        <input
                                            type="file"
                                            id="file-upload"
                                            className="hidden"
                                            onChange={handleFileSelect}
                                            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                                            multiple
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
                                {selectedFiles.length > 0 && (submitting || uploadPercent > 0 || uploadError) && (
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
                                                disabled={submitting || !newComment.trim() || !commentDate || !startTime || !endTime}
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
                            <Separator />
                            <div>
                                <p className="text-sm text-muted-foreground">Last FollowUp</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <p className="font-medium">{formatDate(oppurtunities.prevFollowup)}</p>
                                </div>
                            </div>
                            <Separator />
                            <div className="flex flex-col w-full space-y-2">

                                <>
                                    <Label className="flex items-center gap-2">
                                        <Paperclip className="h-4 w-4" />
                                        Attach the quote
                                    </Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="text"
                                            placeholder="No file chosen"
                                            readOnly
                                            value={fileRef.current?.files?.[0]?.name || ""}
                                            className="flex-1"
                                        />

                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => fileRef.current?.click()}
                                        >
                                            Browse
                                        </Button>
                                    </div>

                                    <input
                                        type="file"
                                        ref={fileRef}
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                </>
                                {
                                    oppurtunities.quote &&
                                    <a
                                        href={getAttachmentUrl(oppurtunities.quote)} // URL of the already uploaded quote
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-sm hover:bg-muted/80 transition-colors"
                                    >
                                        <Paperclip className="h-3 w-3" />
                                        View Quote
                                    </a>
                                }
                            </div>

                        </CardContent>
                    </Card>
                </div>
            </div>
        </div >
    )
}
