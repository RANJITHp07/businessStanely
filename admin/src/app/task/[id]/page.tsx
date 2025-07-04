"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    ArrowLeft,
    Edit,
    FileText,
    Calendar,
    Clock,
    MessageSquare,
    Plus,
    Play,
    Pause,
    AlertTriangle,
    CheckCircle,
    Phone,
    Mail,
    Building2,
    Timer,
    Send,
    Paperclip,
} from "lucide-react"
import { format } from "date-fns"

// Mock task data
const taskData = {
    id: "1",
    taskName: "Contract Review - Acme Corp Merger Agreement",
    description:
        "Comprehensive review and analysis of the merger agreement between Acme Corporation and TechStart Inc. This includes due diligence review, risk assessment, and preparation of legal recommendations for the client.",
    clientName: "Acme Corporation",
    clientType: "Corporate",
    clientPhone: "+1 (555) 123-4567",
    clientEmail: "john.anderson@acme.com",
    contactPerson: "John Anderson",
    assignedAgent: {
        id: "1",
        name: "John Smith",
        type: "Senior Partner",
        email: "john.smith@lawfirm.com",
        avatar: null,
    },
    priority: "high",
    status: "In Progress",
    category: "Contract Review",
    createdDate: "2024-01-15T09:00:00Z",
    dueDate: "2024-02-15T17:00:00Z",
    completedDate: null,
    percentageCompleted: 65,
    estimatedHours: 40,
    actualHours: 26.5,
    billableRate: 450,
    tags: ["Merger", "Due Diligence", "Corporate Law", "High Priority"],
}

// Mock comments data
const taskComments = [
    {
        id: "1",
        author: {
            name: "John Smith",
            type: "Senior Partner",
            avatar: null,
        },
        content:
            "Started initial review of the merger agreement. Identified several key areas that need detailed analysis, particularly around intellectual property transfers and liability clauses.",
        timestamp: "2024-01-15T10:30:00Z",
        type: "update",
    },
    {
        id: "2",
        author: {
            name: "Sarah Johnson",
            type: "Associate",
            avatar: null,
        },
        content:
            "Completed research on similar merger cases. Found three relevant precedents that could impact our recommendations. Will prepare summary by EOD.",
        timestamp: "2024-01-16T14:15:00Z",
        type: "progress",
    },
    {
        id: "3",
        author: {
            name: "John Anderson",
            type: "Client",
            avatar: null,
        },
        content:
            "Quick question about the timeline - do we need to have the preliminary review completed before the board meeting on Jan 25th?",
        timestamp: "2024-01-17T11:45:00Z",
        type: "question",
    },
    {
        id: "4",
        author: {
            name: "John Smith",
            type: "Senior Partner",
            avatar: null,
        },
        content:
            "@John Anderson Yes, we'll have the preliminary findings ready by Jan 24th. I'll schedule a call to discuss the key points before your board meeting.",
        timestamp: "2024-01-17T13:20:00Z",
        type: "response",
    },
    {
        id: "5",
        author: {
            name: "Michael Brown",
            type: "Junior Associate",
            avatar: null,
        },
        content:
            "Updated progress to 65%. Completed sections 1-4 of the agreement review. Working on the financial terms analysis now.",
        timestamp: "2024-01-18T16:30:00Z",
        type: "progress",
    },
]

// Mock time log data
const timeLogEntries = [
    {
        id: "1",
        date: "2024-01-15",
        startTime: "09:00",
        endTime: "12:30",
        duration: 3.5,
        description: "Initial contract review and document analysis",
        billable: true,
        rate: 450,
        status: "completed",
    },
    {
        id: "2",
        date: "2024-01-15",
        startTime: "14:00",
        endTime: "17:00",
        duration: 3.0,
        description: "Legal research on merger precedents",
        billable: true,
        rate: 450,
        status: "completed",
    },
    {
        id: "3",
        date: "2024-01-16",
        startTime: "10:00",
        endTime: "13:00",
        duration: 3.0,
        description: "Due diligence checklist preparation",
        billable: true,
        rate: 450,
        status: "completed",
    },
    {
        id: "4",
        date: "2024-01-16",
        startTime: "15:30",
        endTime: "18:00",
        duration: 2.5,
        description: "Client consultation and requirement gathering",
        billable: true,
        rate: 450,
        status: "completed",
    },
    {
        id: "5",
        date: "2024-01-17",
        startTime: "09:30",
        endTime: "12:00",
        duration: 2.5,
        description: "Risk assessment documentation",
        billable: true,
        rate: 450,
        status: "completed",
    },
    {
        id: "6",
        date: "2024-01-18",
        startTime: "10:00",
        endTime: "15:00",
        duration: 5.0,
        description: "Financial terms analysis and compliance review",
        billable: true,
        rate: 450,
        status: "completed",
    },
    {
        id: "7",
        date: "2024-01-19",
        startTime: "14:00",
        endTime: "17:30",
        duration: 3.5,
        description: "Draft preliminary findings report",
        billable: true,
        rate: 450,
        status: "completed",
    },
    {
        id: "8",
        date: "2024-01-22",
        startTime: "09:00",
        endTime: "12:30",
        duration: 3.5,
        description: "Review and revise contract clauses",
        billable: true,
        rate: 450,
        status: "completed",
    },
]

export default function TaskDetails() {
    const [activeTab, setActiveTab] = useState("details")
    const [newComment, setNewComment] = useState("")
    const [isTimerRunning, setIsTimerRunning] = useState(false)
    const [currentTimer, setCurrentTimer] = useState("00:00:00")
    const [showTimeLogDialog, setShowTimeLogDialog] = useState(false)
    const [newTimeLog, setNewTimeLog] = useState({
        date: format(new Date(), "yyyy-MM-dd"),
        startTime: "",
        endTime: "",
        description: "",
        billable: true,
    })

    const getPriorityBadge = (priority: string) => {
        const colors = {
            low: "bg-green-100 text-green-800 border-green-200",
            medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
            high: "bg-red-100 text-red-800 border-red-200",
        }

        return (
            <Badge className={`${colors[priority as keyof typeof colors]} border`}>
                <AlertTriangle className="w-3 h-3 mr-1" />
                {priority.charAt(0).toUpperCase() + priority.slice(1)}
            </Badge>
        )
    }

    const getStatusBadge = (status: string) => {
        const colors = {
            Pending: "bg-gray-100 text-gray-800 border-gray-200",
            "In Progress": "bg-blue-100 text-blue-800 border-blue-200",
            Completed: "bg-green-100 text-green-800 border-green-200",
            Overdue: "bg-red-100 text-red-800 border-red-200",
        }

        const icons = {
            Pending: <Clock className="w-3 h-3 mr-1" />,
            "In Progress": <Play className="w-3 h-3 mr-1" />,
            Completed: <CheckCircle className="w-3 h-3 mr-1" />,
            Overdue: <AlertTriangle className="w-3 h-3 mr-1" />,
        }

        return (
            <Badge className={`${colors[status as keyof typeof colors]} border`}>
                {icons[status as keyof typeof icons]}
                {status}
            </Badge>
        )
    }

    const getCommentTypeIcon = (type: string) => {
        const icons = {
            update: <FileText className="w-4 h-4 text-blue-600" />,
            progress: <CheckCircle className="w-4 h-4 text-green-600" />,
            question: <MessageSquare className="w-4 h-4 text-orange-600" />,
            response: <MessageSquare className="w-4 h-4 text-purple-600" />,
        }
        return icons[type as keyof typeof icons] || <MessageSquare className="w-4 h-4 text-gray-600" />
    }

    const formatDateTime = (dateString: string) => {
        return format(new Date(dateString), "MMM dd, yyyy 'at' h:mm a")
    }

    const formatDate = (dateString: string) => {
        return format(new Date(dateString), "MMM dd, yyyy")
    }

    const calculateDuration = (start: string, end: string) => {
        const startTime = new Date(`2024-01-01 ${start}`)
        const endTime = new Date(`2024-01-01 ${end}`)
        const diff = endTime.getTime() - startTime.getTime()
        return diff / (1000 * 60 * 60) // Convert to hours
    }

    const totalBillableAmount = timeLogEntries.reduce((total, entry) => {
        return total + entry.duration * entry.rate
    }, 0)

    const handleAddComment = () => {
        if (newComment.trim()) {
            // Add comment logic here
            console.log("Adding comment:", newComment)
            setNewComment("")
        }
    }

    const handleAddTimeLog = () => {
        if (newTimeLog.startTime && newTimeLog.endTime && newTimeLog.description) {
            const duration = calculateDuration(newTimeLog.startTime, newTimeLog.endTime)
            console.log("Adding time log:", { ...newTimeLog, duration })
            setShowTimeLogDialog(false)
            setNewTimeLog({
                date: format(new Date(), "yyyy-MM-dd"),
                startTime: "",
                endTime: "",
                description: "",
                billable: true,
            })
        }
    }

    const toggleTimer = () => {
        setIsTimerRunning(!isTimerRunning)
        // Timer logic would be implemented here
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold">Task Details</h1>
                        <p className="text-muted-foreground mt-2">Comprehensive view of task progress and activity</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button className="flex items-center gap-2">
                            <Edit className="h-4 w-4" />
                            Edit Task
                        </Button>
                    </div>
                </div>

                {/* Task Summary Card */}
                <Card>
                    <CardContent className="p-6">
                        <div className="space-y-4">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h2 className="text-2xl font-bold">{taskData.taskName}</h2>
                                        {getStatusBadge(taskData.status)}
                                    </div>
                                    <p className="text-muted-foreground mb-4">{taskData.description}</p>
                                </div>
                            </div>

                            {/* Follow-up and Status Checkboxes */}
                            <div className="flex items-center gap-6 p-4 bg-muted/30 rounded-lg">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="follow-up"
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        defaultChecked={false}
                                    />
                                    <label htmlFor="follow-up" className="text-sm font-medium cursor-pointer">
                                        Follow-up Required
                                    </label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="check-status"
                                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                                        defaultChecked={false}
                                    />
                                    <label htmlFor="check-status" className="text-sm font-medium cursor-pointer">
                                        Status Check Completed
                                    </label>
                                </div>
                                <div className="text-xs text-muted-foreground ml-auto">
                                    Last updated: {formatDateTime(new Date().toISOString())}
                                </div>
                            </div>

                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="details" className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Task Details
                    </TabsTrigger>
                    <TabsTrigger value="comments" className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Comments ({taskComments.length})
                    </TabsTrigger>
                    <TabsTrigger value="timelog" className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Time Log ({timeLogEntries.length})
                    </TabsTrigger>
                </TabsList>

                {/* Task Details Tab */}
                <TabsContent value="details" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Task Information</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label className="text-sm font-medium text-muted-foreground">Task Name</Label>
                                            <p className="font-medium">{taskData.taskName}</p>
                                        </div>
                                        <div>
                                            <Label className="text-sm font-medium text-muted-foreground">Category</Label>
                                            <p className="font-medium">{taskData.category}</p>
                                        </div>
                                        <div>
                                            <Label className="text-sm font-medium text-muted-foreground">Priority</Label>
                                            <div className="mt-1">{getPriorityBadge(taskData.priority)}</div>
                                        </div>
                                        <div>
                                            <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                                            <div className="mt-1">{getStatusBadge(taskData.status)}</div>
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                                        <p className="text-sm text-muted-foreground mt-1">{taskData.description}</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Client Information</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label className="text-sm font-medium text-muted-foreground">Client Name</Label>
                                            <p className="font-medium">{taskData.clientName}</p>
                                        </div>
                                        <div>
                                            <Label className="text-sm font-medium text-muted-foreground">Client Type</Label>
                                            <p className="font-medium">{taskData.clientType}</p>
                                        </div>
                                        <div>
                                            <Label className="text-sm font-medium text-muted-foreground">Contact Person</Label>
                                            <p className="font-medium">{taskData.contactPerson}</p>
                                        </div>
                                        <div>
                                            <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
                                            <p className="font-medium">{taskData.clientPhone}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                                        <p className="font-medium">{taskData.clientEmail}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Progress Tracking</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium">Completion</span>
                                            <span className="text-sm font-bold">{taskData.percentageCompleted}%</span>
                                        </div>
                                        <Progress value={taskData.percentageCompleted} className="h-3" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Timeline</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <div className="text-sm font-medium">Created</div>
                                            <div className="text-sm text-muted-foreground">{formatDateTime(taskData.createdDate)}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <div className="text-sm font-medium">Due Date</div>
                                            <div className="text-sm text-muted-foreground">{formatDateTime(taskData.dueDate)}</div>
                                        </div>
                                    </div>
                                    {taskData.completedDate && (
                                        <div className="flex items-center gap-2">
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                            <div>
                                                <div className="text-sm font-medium">Completed</div>
                                                <div className="text-sm text-muted-foreground">{formatDateTime(taskData.completedDate)}</div>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* Comments Tab */}
                <TabsContent value="comments" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Task Comments</CardTitle>
                            <CardDescription>Communication and updates related to this task</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Add Comment */}
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback className="text-xs">JS</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 space-y-2">
                                        <Textarea
                                            placeholder="Add a comment..."
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            rows={3}
                                        />
                                        <div className="flex items-center justify-between">
                                            <Button variant="outline" size="sm">
                                                <Paperclip className="h-4 w-4 mr-2" />
                                                Attach File
                                            </Button>
                                            <Button onClick={handleAddComment} disabled={!newComment.trim()}>
                                                <Send className="h-4 w-4 mr-2" />
                                                Add Comment
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Comments List */}
                            <div className="space-y-4">
                                {taskComments.map((comment) => (
                                    <div key={comment.id} className="flex items-start gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={comment.author.avatar || ""} />
                                            <AvatarFallback className="text-xs">
                                                {comment.author.name
                                                    .split(" ")
                                                    .map((n) => n[0])
                                                    .join("")}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-2">
                                                {getCommentTypeIcon(comment.type)}
                                                <span className="font-medium text-sm">{comment.author.name}</span>
                                                <Badge variant="outline" className="text-xs">
                                                    {comment.author.type}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">{formatDateTime(comment.timestamp)}</span>
                                            </div>
                                            <div className="bg-muted/50 rounded-lg p-3">
                                                <p className="text-sm">{comment.content}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Time Log Tab */}
                <TabsContent value="timelog" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span>Time Log</span>
                            </CardTitle>
                            <CardDescription>
                                Track time spent on this task. Total: {taskData.actualHours} hours
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {timeLogEntries.map((entry) => (
                                    <div key={entry.id} className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="flex items-center gap-4">
                                            <div className="text-center">
                                                <div className="text-sm font-medium">{formatDate(entry.date)}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {entry.startTime} - {entry.endTime}
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-muted-foreground">{entry.description}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-bold">{entry.duration}h</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Summary */}
                            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                                <div className="grid grid-cols-1 gap-4 text-center">
                                    <div>
                                        <div className="text-2xl font-bold">{taskData.actualHours}h</div>
                                        <div className="text-sm text-muted-foreground">Total Hours</div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
