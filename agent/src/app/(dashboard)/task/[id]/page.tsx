"use client"

import type React from "react"

import { useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Edit,
    FileText,
    Calendar,
    Clock,
    MessageSquare,
    Play,
    AlertTriangle,
    CheckCircle,
    Send,
    Paperclip,
    Plus,
    Search,
    Users,
    User,
    Building2,
    Phone,
    Mail,
    Timer,
} from "lucide-react"

// Mock data
const taskData = {
    id: "TSK-001",
    title: "Website Redesign Project",
    description:
        "Complete redesign of the company website including new branding, improved user experience, and mobile responsiveness. This project involves multiple stakeholders and requires careful coordination.",
    priority: "high",
    status: "In Progress",
    progress: 65,
    createdAt: "2024-01-15T10:00:00Z",
    dueDate: "2024-02-28T17:00:00Z",
    updatedAt: "2024-01-20T14:30:00Z",
    followUpRequired: true,
    completed: false,
    assignedTo: {
        id: "1",
        name: "John Smith",
        avatar: "/placeholder.svg?height=32&width=32",
    },
    client: {
        clientType: "organization",
        organizationName: "TechCorp Solutions",
        firstName: "",
        lastName: "",
        email: "contact@techcorp.com",
        phoneNumber: "+1 (555) 123-4567",
        authorizedPersonName: "Sarah Johnson",
    },
}

const comments = [
    {
        id: 1,
        authorType: "USER",
        user: { username: "johnsmith" },
        agent: null,
        content: "Started working on the initial wireframes. Will have the first draft ready by end of week.",
        createdAt: "2024-01-20T10:30:00Z",
        attachmentName: "wireframe-v1.pdf",
        attachmentSize: 2048000,
        attachmentType: "application/pdf",
        attachmentUrl: "/uploads/wireframe-v1.pdf",
    },
    {
        id: 2,
        authorType: "USER",
        user: { username: "sarahjohnson" },
        agent: null,
        content: "Great! Please make sure to include the new brand colors we discussed.",
        createdAt: "2024-01-20T14:15:00Z",
        attachmentName: null,
        attachmentSize: null,
        attachmentType: null,
        attachmentUrl: null,
    },
]

const timeLogs = [
    {
        id: 1,
        date: "2024-01-20",
        hours: 4.5,
        description: "Initial research and wireframe creation",
    },
    {
        id: 2,
        date: "2024-01-22",
        hours: 6.0,
        description: "Design mockups and client feedback incorporation",
    },
]

const teamMembers = [
    { id: "1", name: "John Smith", role: "Designer" },
    { id: "2", name: "Emily Davis", role: "Developer" },
    { id: "3", name: "Michael Brown", role: "Project Manager" },
    { id: "4", name: "Lisa Wilson", role: "Developer" },
]

export default function TaskDetails() {
    const [task, setTask] = useState(taskData)
    const [commentsData, setCommentsData] = useState(comments)
    const [timeLogsData, setTimeLogsData] = useState(timeLogs)
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState("details")
    const [newComment, setNewComment] = useState("")
    const [submittingComment, setSubmittingComment] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [currentUser] = useState({ username: "currentuser", id: "current" })

    // Time log form states
    const [timeLogDate, setTimeLogDate] = useState("")
    const [timeLogHours, setTimeLogHours] = useState("")
    const [timeLogDescription, setTimeLogDescription] = useState("")

    // Assignment states
    const [searchQuery, setSearchQuery] = useState("")
    const [showAssignSearch, setShowAssignSearch] = useState(false)

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
            "To Do": "bg-gray-100 text-gray-800 border-gray-200",
            "In Progress": "bg-blue-100 text-blue-800 border-blue-200",
            Done: "bg-green-100 text-green-800 border-green-200",
            Completed: "bg-green-100 text-green-800 border-green-200",
            Overdue: "bg-red-100 text-red-800 border-red-200",
        }
        const icons = {
            "To Do": <Clock className="w-3 h-3 mr-1" />,
            "In Progress": <Play className="w-3 h-3 mr-1" />,
            Done: <CheckCircle className="w-3 h-3 mr-1" />,
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

    const formatDateTime = (dateString: string | undefined) => {
        if (!dateString) return "N/A"
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })
    }

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file) {
            setSelectedFile(file)
        }
    }

    const handleAddComment = async () => {
        if (!newComment.trim()) return
        setSubmittingComment(true)

        // Simulate API call
        setTimeout(() => {
            const comment = {
                id: commentsData.length + 1,
                authorType: "USER" as const,
                user: { username: currentUser.username },
                agent: null,
                content: newComment,
                createdAt: new Date().toISOString(),
                attachmentName: selectedFile?.name || null,
                attachmentSize: selectedFile?.size || null,
                attachmentType: selectedFile?.type || null,
                attachmentUrl: selectedFile ? `/uploads/${selectedFile.name}` : null,
            }
            setCommentsData((prev) => [comment, ...prev])
            setNewComment("")
            setSelectedFile(null)
            setSubmittingComment(false)
        }, 1000)
    }

    const handleAddTimeLog = () => {
        if (!timeLogDate || !timeLogHours || !timeLogDescription) return

        const log = {
            id: timeLogsData.length + 1,
            date: timeLogDate,
            hours: Number.parseFloat(timeLogHours),
            description: timeLogDescription,
        }
        setTimeLogsData((prev) => [log, ...prev])
        setTimeLogDate("")
        setTimeLogHours("")
        setTimeLogDescription("")
    }

    const handleStatusChange = (newStatus: string) => {
        setTask((prev) => ({
            ...prev,
            status: newStatus,
            completed: newStatus === "Completed",
        }))
    }

    const handleProgressChange = (newProgress: number) => {
        setTask((prev) => ({ ...prev, progress: newProgress }))
    }

    const handleFollowUpChange = (checked: boolean) => {
        setTask((prev) => ({ ...prev, followUpRequired: checked }))
    }

    const handleCompletedChange = (checked: boolean) => {
        setTask((prev) => ({
            ...prev,
            completed: checked,
            status: checked ? "Completed" : "In Progress",
        }))
    }

    const assignTask = (memberId: string) => {
        const member = teamMembers.find((m) => m.id === memberId)
        if (member) {
            setTask((prev) => ({
                ...prev,
                assignedTo: {
                    id: member.id,
                    name: member.name,
                    avatar: "/placeholder.svg?height=32&width=32",
                },
            }))
            setShowAssignSearch(false)
            setSearchQuery("")
        }
    }

    const filteredMembers = teamMembers.filter(
        (member) =>
            member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            member.role.toLowerCase().includes(searchQuery.toLowerCase()),
    )

    const totalTimeLogged = timeLogsData.reduce((total, log) => total + log.hours, 0)
    const daysRemaining = Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))

    if (loading) {
        return (
            <div className="container mx-auto p-6 max-w-7xl">
                <Skeleton className="h-10 w-1/2 mb-6" />
                <Card>
                    <CardContent className="p-6">
                        <Skeleton className="h-6 w-1/3 mb-2" />
                        <Skeleton className="h-4 w-full mb-4" />
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            {/* Header */}
            <div className="mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
                    <div>
                        <h1 className="text-[28px] md:text-3xl font-bold">Task Details</h1>
                        <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
                            Comprehensive view of task progress and activity
                        </p>
                    </div>
                </div>

                {/* Task Summary Card */}
                <Card>
                    <CardContent className="p-6">
                        <div className="space-y-4">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex flex-col md:flex-row items-start md:items-center gap-3 mb-2">
                                        <h2 className="text-[18px] md:text-2xl font-bold">{task.title}</h2>
                                        {getStatusBadge(task.status)}
                                    </div>
                                    <p className="text-[16px] md:[18px] text-muted-foreground mb-4">{task.description}</p>
                                </div>
                            </div>

                            {/* Quick Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                                <div className="flex items-center gap-2 text-sm">
                                    <Calendar className="h-4 w-4 text-gray-500" />
                                    <span className="text-gray-600">Due in {daysRemaining} days</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <Timer className="h-4 w-4 text-gray-500" />
                                    <span className="text-gray-600">{totalTimeLogged}h logged</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <User className="h-4 w-4 text-gray-500" />
                                    <span className="text-gray-600">Assigned to {task.assignedTo.name}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <CheckCircle className="h-4 w-4 text-gray-500" />
                                    <span className="text-gray-600">{task.progress}% complete</span>
                                </div>
                            </div>

                            {/* Follow-up and Status Checkboxes */}
                            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 p-0 md:p-4 bg-muted/30 rounded-lg">
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="follow-up" checked={task.followUpRequired} onCheckedChange={handleFollowUpChange} />
                                    <Label htmlFor="follow-up" className="text-sm font-medium cursor-pointer">
                                        Follow-up Required
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="check-status" checked={task.completed} onCheckedChange={handleCompletedChange} />
                                    <Label htmlFor="check-status" className="text-sm font-medium cursor-pointer">
                                        Status Check Completed
                                    </Label>
                                </div>
                                <div className="text-xs text-muted-foreground md:ml-auto">
                                    Last updated: {formatDateTime(task.updatedAt)}
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
                        <FileText className="h-4 w-4 hidden md:block" />
                        <p className="text-[12px] md:text-[14px]">Task Details</p>
                    </TabsTrigger>
                    <TabsTrigger value="comments" className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 hidden md:block" />
                        <p className="text-[12px] md:text-[14px]">Comments ({commentsData.length})</p>
                    </TabsTrigger>
                    <TabsTrigger value="timelog" className="flex items-center gap-2">
                        <Clock className="h-4 w-4 hidden md:block" />
                        <p className="text-[12px] md:text-[14px]">Time Log ({timeLogsData.length})</p>
                    </TabsTrigger>
                </TabsList>

                {/* Task Details Tab */}
                <TabsContent value="details" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            {/* Task Management */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Task Management</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Status and Progress */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="status">Status</Label>
                                            <Select value={task.status} onValueChange={handleStatusChange}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="To Do">To Do</SelectItem>
                                                    <SelectItem value="In Progress">In Progress</SelectItem>
                                                    <SelectItem value="Done">Done</SelectItem>
                                                    <SelectItem value="Completed">Completed</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="progress">Progress ({task.progress}%)</Label>
                                            <div className="space-y-2">
                                                <Progress value={task.progress} className="w-full" />
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={task.progress}
                                                    onChange={(e) => handleProgressChange(Number.parseInt(e.target.value) || 0)}
                                                    className="w-full"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Assignment */}
                                    <div className="space-y-2">
                                        <Label>Assigned To</Label>
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarImage src={task.assignedTo.avatar || "/placeholder.svg"} />
                                                <AvatarFallback>
                                                    {task.assignedTo.name
                                                        .split(" ")
                                                        .map((n) => n[0])
                                                        .join("")}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="font-medium">{task.assignedTo.name}</span>
                                            <Button variant="outline" size="sm" onClick={() => setShowAssignSearch(!showAssignSearch)}>
                                                <Users className="h-4 w-4 mr-2" />
                                                Reassign
                                            </Button>
                                        </div>

                                        {showAssignSearch && (
                                            <div className="mt-3 p-3 border rounded-lg bg-gray-50">
                                                <div className="relative mb-3">
                                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                    <Input
                                                        placeholder="Search team members..."
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                        className="pl-10"
                                                    />
                                                </div>
                                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                                    {filteredMembers.map((member) => (
                                                        <div
                                                            key={member.id}
                                                            className="flex items-center justify-between p-2 hover:bg-white rounded cursor-pointer"
                                                            onClick={() => assignTask(member.id)}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <Avatar className="h-6 w-6">
                                                                    <AvatarFallback className="text-xs">
                                                                        {member.name
                                                                            .split(" ")
                                                                            .map((n) => n[0])
                                                                            .join("")}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <div className="text-sm font-medium">{member.name}</div>
                                                                    <div className="text-xs text-gray-500">{member.role}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Task Information</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label className="text-sm font-medium text-muted-foreground">Task Name</Label>
                                            <p className="font-medium">{task.title}</p>
                                        </div>
                                        <div>
                                            <Label className="text-sm font-medium text-muted-foreground">Priority</Label>
                                            <div className="mt-1">{getPriorityBadge(task.priority)}</div>
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                                        <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
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
                                            <p className="font-medium">
                                                {task.client.clientType === "individual"
                                                    ? `${task.client.firstName} ${task.client.lastName}`
                                                    : task.client.organizationName}
                                            </p>
                                        </div>
                                        <div>
                                            <Label className="text-sm font-medium text-muted-foreground">Client Type</Label>
                                            <div className="flex items-center gap-2">
                                                {task.client.clientType === "organization" ? (
                                                    <Building2 className="h-4 w-4 text-gray-500" />
                                                ) : (
                                                    <User className="h-4 w-4 text-gray-500" />
                                                )}
                                                <span className="text-sm capitalize">{task.client.clientType}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <Label className="text-sm font-medium text-muted-foreground">Contact Person</Label>
                                            <p className="font-medium">{task.client.authorizedPersonName}</p>
                                        </div>
                                        <div>
                                            <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
                                            <div className="flex items-center gap-2">
                                                <Phone className="h-4 w-4 text-gray-500" />
                                                <a href={`tel:${task.client.phoneNumber}`} className="text-blue-600 hover:underline text-sm">
                                                    {task.client.phoneNumber}
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-4 w-4 text-gray-500" />
                                            <a href={`mailto:${task.client.email}`} className="text-blue-600 hover:underline text-sm">
                                                {task.client.email}
                                            </a>
                                        </div>
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
                                            <span className="text-sm font-bold">{task.progress}%</span>
                                        </div>
                                        <Progress value={task.progress} className="h-3" />
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
                                            <div className="text-sm text-muted-foreground">{formatDateTime(task.createdAt)}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <div className="text-sm font-medium">Due Date</div>
                                            <div className="text-sm text-muted-foreground">{formatDateTime(task.dueDate)}</div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Days Remaining</span>
                                        <Badge variant={daysRemaining < 7 ? "destructive" : "secondary"}>{daysRemaining} days</Badge>
                                    </div>
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
                                        <AvatarFallback className="text-xs">{currentUser.username[0].toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 space-y-2">
                                        <Textarea
                                            placeholder="Add a comment..."
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            rows={3}
                                        />
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="file"
                                                    id="file-upload"
                                                    className="hidden"
                                                    onChange={handleFileSelect}
                                                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => document.getElementById("file-upload")?.click()}
                                                >
                                                    <Paperclip className="h-4 w-4 mr-2" />
                                                    Attach File
                                                </Button>
                                                {selectedFile && (
                                                    <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                                        {selectedFile.name}
                                                        <button
                                                            onClick={() => setSelectedFile(null)}
                                                            className="ml-2 text-red-500 hover:text-red-700"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <Button onClick={handleAddComment} disabled={!newComment.trim() || submittingComment}>
                                                <Send className="h-4 w-4 mr-2" />
                                                {submittingComment ? "Adding..." : "Add Comment"}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Comments List */}
                            <div className="space-y-4">
                                {commentsData.length === 0 ? (
                                    <p className="text-muted-foreground">No comments yet.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {commentsData.map((comment) => (
                                            <div key={comment.id} className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarFallback className="text-xs">
                                                        {comment.authorType === "USER"
                                                            ? comment.user?.username?.charAt(0).toUpperCase() || "U"
                                                            : comment.agent?.name
                                                                ?.split(" ")
                                                                .map((n) => n[0])
                                                                .join("") || "A"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-sm">
                                                            {comment.authorType === "USER" ? comment.user?.username : comment.agent?.name}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">{formatDateTime(comment.createdAt)}</span>
                                                    </div>
                                                    <p className="text-sm">{comment.content}</p>
                                                    {comment.attachmentName && (
                                                        <div className="mt-2">
                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-2 rounded border">
                                                                <Paperclip className="h-3 w-3" />
                                                                <span className="font-medium">{comment.attachmentName}</span>
                                                                <span>({(comment.attachmentSize! / 1024).toFixed(1)} KB)</span>
                                                                {comment.attachmentUrl && (
                                                                    <a
                                                                        href={comment.attachmentUrl}
                                                                        className="text-blue-600 hover:text-blue-800 underline ml-auto"
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                    >
                                                                        Download
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Time Log Tab */}
                <TabsContent value="timelog" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span>Time Log (Total: {totalTimeLogged}h)</span>
                            </CardTitle>
                            <CardDescription>Track time spent on this task.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Add Time Log */}
                            <div className="space-y-3">
                                <Label className="text-sm font-medium">Log New Time Entry</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <Input
                                        type="date"
                                        value={timeLogDate}
                                        onChange={(e) => setTimeLogDate(e.target.value)}
                                        placeholder="Date"
                                    />
                                    <Input
                                        type="number"
                                        step="0.5"
                                        value={timeLogHours}
                                        onChange={(e) => setTimeLogHours(e.target.value)}
                                        placeholder="Hours"
                                    />
                                </div>
                                <Textarea
                                    value={timeLogDescription}
                                    onChange={(e) => setTimeLogDescription(e.target.value)}
                                    placeholder="Description"
                                />
                                <Button
                                    onClick={handleAddTimeLog}
                                    disabled={!timeLogDate || !timeLogHours || !timeLogDescription}
                                    className="w-full"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Log Time
                                </Button>
                            </div>

                            <Separator />

                            {/* Time Logs List */}
                            <div className="space-y-3">
                                {timeLogsData.length === 0 ? (
                                    <p className="text-muted-foreground">No time log entries yet.</p>
                                ) : (
                                    timeLogsData.map((log) => (
                                        <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div>
                                                <div className="font-medium text-sm">{log.description}</div>
                                                <div className="text-xs text-gray-500">By Ranjith on {log.date}</div>
                                                <div className="text-sm text-gray-500"></div>
                                            </div>
                                            <Badge variant="secondary">{log.hours}h</Badge>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
