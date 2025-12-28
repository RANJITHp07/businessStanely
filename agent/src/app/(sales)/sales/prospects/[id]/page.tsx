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
import { cn } from "@/lib/utils"

interface Prospect {
    id: string
    name: string
    phoneNumber: string
    address?: string
    email: string
    leadSource: string
    description: string
    nextFollowUp?: string
    lastFollowUp?: string
    status: "New" | "In Progress"
    createdAt: string
    updatedAt: string
    assignedTo?: string
    createdBy?: string
}

interface Interaction {
    id: string
    message: string
    createdAt: string
    createdBy: string
    attachments?: { name: string; url: string }[]
}

export default function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params)
    const router = useRouter()
    const [prospect, setProspect] = useState<Prospect | null>(null)
    const [interactions, setInteractions] = useState<Interaction[]>([])
    const [loading, setLoading] = useState(true)
    const [newComment, setNewComment] = useState("")
    const [attachments, setAttachments] = useState<File[]>([])
    const [submitting, setSubmitting] = useState(false)
    const [nextFollowUpDate, setNextFollowUpDate] = useState<Date | undefined>(undefined)

    useEffect(() => {
        setTimeout(() => {
            const mockProspect: Prospect = {
                id: resolvedParams.id,
                name: "John Doe",
                phoneNumber: "+1 234-567-8900",
                address: "123 Main Street, New York, NY 10001",
                email: "john.doe@example.com",
                leadSource: "Website",
                description: "Interested in legal consultation for business setup",
                nextFollowUp: "2025-01-20",
                lastFollowUp: "2025-01-15",
                status: "New",
                createdAt: "2025-01-15T10:00:00Z",
                updatedAt: "2025-01-15T10:00:00Z",
                assignedTo: "Sarah Johnson",
                createdBy: "Michael Smith",
            }

            const mockInteractions: Interaction[] = [
                {
                    id: "1",
                    message: "Initial contact made via website form. Client is interested in business setup consultation.",
                    createdAt: "2025-01-15T10:30:00Z",
                    createdBy: "Sarah Johnson",
                },
                {
                    id: "2",
                    message: "Follow-up call scheduled for next week. Client requested information about pricing.",
                    createdAt: "2025-01-15T14:00:00Z",
                    createdBy: "Sarah Johnson",
                    attachments: [{ name: "pricing-document.pdf", url: "#" }],
                },
            ]

            setProspect(mockProspect)
            setInteractions(mockInteractions)
            if (mockProspect.nextFollowUp) {
                setNextFollowUpDate(new Date(mockProspect.nextFollowUp))
            }
            setLoading(false)
        }, 500)
    }, [resolvedParams.id])

    const handleNextFollowUpChange = (date: Date | undefined) => {
        setNextFollowUpDate(date)
        if (prospect && date) {
            setProspect({ ...prospect, nextFollowUp: date.toISOString().split("T")[0] })
            console.log("Next follow-up updated to:", date.toISOString().split("T")[0])
        }
    }

    const handleStatusChange = (newStatus: "New" | "In Progress") => {
        if (prospect) {
            setProspect({ ...prospect, status: newStatus })
            console.log("Status updated to:", newStatus)
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
        if (!newComment.trim() && attachments.length === 0) return

        setSubmitting(true)
        setTimeout(() => {
            const newInteraction: Interaction = {
                id: Date.now().toString(),
                message: newComment,
                createdAt: new Date().toISOString(),
                createdBy: "Current User",
                attachments: attachments.map((file) => ({
                    name: file.name,
                    url: "#",
                })),
            }

            setInteractions([...interactions, newInteraction])
            setNewComment("")
            setAttachments([])
            setSubmitting(false)
        }, 500)
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
                    <h2 className="text-2xl font-bold">Prospect not found</h2>
                    <Link href="/prospects">
                        <Button className="mt-4">Back to Prospects</Button>
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-6">
                <div className="mb-7">
                    <h1 className="text-[28px] md:text-3xl font-bold">Prospect Details</h1>
                    <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
                        Detailed overview of prospect information, engagement, and current status
                    </p>
                </div>
                <Card>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-bold">{prospect.name}</h1>
                                <p className="text-muted-foreground mt-1">Prospect Details</p>
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
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col gap-1">
                                        <p className="text-sm text-muted-foreground mb-1">Status</p>
                                        <Select value={prospect.status} onValueChange={handleStatusChange}>
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
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquare className="h-5 w-5" />
                                Interactions
                            </CardTitle>
                            <CardDescription>Add notes, comments, and track all interactions with this prospect</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                {interactions.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-8">No interactions yet</p>
                                ) : (
                                    interactions.map((interaction) => (
                                        <div key={interaction.id} className="border rounded-lg p-4 space-y-3">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                        <User className="h-4 w-4 text-primary" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm">{interaction.createdBy}</p>
                                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {formatDate(interaction.createdAt)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-sm leading-relaxed">{interaction.message}</p>
                                            {interaction.attachments && interaction.attachments.length > 0 && (
                                                <div className="flex flex-wrap gap-2 pt-2">
                                                    {interaction.attachments.map((file, idx) => (
                                                        <a
                                                            key={idx}
                                                            href={file.url}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-sm hover:bg-muted/80 transition-colors"
                                                        >
                                                            <Paperclip className="h-3 w-3" />
                                                            {file.name}
                                                        </a>
                                                    ))}
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
                                    className={`mt-1 ${prospect.status === "New" ? "bg-green-100 text-green-800" : "bg-sky-100 text-sky-800"}`}
                                >
                                    {prospect.status}
                                </Badge>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-sm text-muted-foreground">Lead Source</p>
                                <p className="font-medium mt-1">{prospect.leadSource}</p>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-sm text-muted-foreground">Created By</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center">
                                        <User className="h-3 w-3 text-emerald-700" />
                                    </div>
                                    <p className="font-medium">{prospect.createdBy || "Unknown"}</p>
                                </div>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-sm text-muted-foreground">Assigned To</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                        <User className="h-3 w-3 text-primary" />
                                    </div>
                                    <p className="font-medium">{prospect.assignedTo || "Unassigned"}</p>
                                </div>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-sm text-muted-foreground">Last Follow Up</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <p className="font-medium">
                                        {prospect.lastFollowUp
                                            ? new Date(prospect.lastFollowUp).toLocaleDateString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                            })
                                            : "No follow-up yet"}
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
