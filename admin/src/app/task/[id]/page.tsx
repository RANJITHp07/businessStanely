"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
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
} from "lucide-react"
import { format } from "date-fns"
import { Task } from "@/types"
import { useParams } from "next/navigation"

export default function TaskDetails() {
    const [taskData, setTaskData] = useState<Task | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("details")
    const [newComment, setNewComment] = useState("")
    const params = useParams()
    const { id } = params

    useEffect(() => {
        const fetchTask = async () => {
            if (id) {
                try {
                    const response = await fetch(`/api/tasks/${id}`)
                    if (response.ok) {
                        const data = await response.json()
                        setTaskData(data)
                    } else {
                        console.error("Failed to fetch task")
                    }
                } catch (error) {
                    console.error("Error fetching task:", error)
                } finally {
                    setLoading(false)
                }
            }
        }

        fetchTask()
    }, [id])

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
            Overdue: "bg-red-100 text-red-800 border-red-200",
        }

        const icons = {
            "To Do": <Clock className="w-3 h-3 mr-1" />,
            "In Progress": <Play className="w-3 h-3 mr-1" />,
            Done: <CheckCircle className="w-3 h-3 mr-1" />,
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
        return format(new Date(dateString), "MMM dd, yyyy 'at' h:mm a")
    }

    const handleAddComment = () => {
        if (newComment.trim()) {
            console.log("Adding comment:", newComment)
            setNewComment("")
        }
    }

    if (loading) {
        return <p>Loading...</p>
    }

    if (!taskData) {
        return <p>Task not found.</p>
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            {/* Header */}
            <div className="mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
                    <div>
                        <h1 className="text-[28px] md:text-3xl font-bold">Task Details</h1>
                        <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">Comprehensive view of task progress and activity</p>

                    </div>
                    <div className="flex justify-end">
                        <Button className="mt-[20px] md:mt-0 w-fit bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300">
                            <a href={`/task/${id}/edit`}>
                                <Edit className="h-4 w-4" />
                                Edit Task
                            </a>
                        </Button>
                    </div>

                </div>

                {/* Task Summary Card */}
                <Card>
                    <CardContent className="p-6">
                        <div className="space-y-4">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex flex-col  md:flex-row  items-start md:items-center gap-3 mb-2">
                                        <h2 className="text-[18px] md:text-2xl font-bold">{taskData.title}</h2>
                                        {getStatusBadge(taskData.status)}
                                    </div>
                                    <p className=" text-[16px] md:[18px] text-muted-foreground mb-4">{taskData.description}</p>
                                </div>
                            </div >

                            {/* Follow-up and Status Checkboxes */}
                            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 p-0 md:p-4 bg-muted/30 rounded-lg">
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
                                <div className="text-xs text-muted-foreground md:ml-auto">
                                    Last updated: {formatDateTime(taskData.updatedAt)}
                                </div>
                            </div>


                        </div >
                    </CardContent >
                </Card >
            </div >

            {/* Tabs */}
            < Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6" >
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="details" className="flex items-center gap-2">
                        <FileText className="h-4 w-4 hidden md:block" />
                        <p className="text-[12px] md:text-[14px]">           Task Details </p>
                    </TabsTrigger>
                    <TabsTrigger value="comments" className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 hidden md:block" />
                        <p className="text-[12px] md:text-[14px]">                  Comments ({0}) </p>
                    </TabsTrigger>
                    <TabsTrigger value="timelog" className="flex items-center gap-2">
                        <Clock className="h-4 w-4 hidden md:block" />
                        <p className="text-[12px] md:text-[14px]">           Time Log ({0}) </p>
                    </TabsTrigger>
                </TabsList >

                {/* Task Details Tab */}
                < TabsContent value="details" className="space-y-6" >
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
                                            <p className="font-medium">{taskData.title}</p>
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
                                            <p className="font-medium">{taskData.client ? (taskData.client.clientType === 'individual' ? `${taskData.client.firstName} ${taskData.client.lastName}` : taskData.client.organizationName) : 'N/A'}</p>
                                        </div>
                                        <div>
                                            <Label className="text-sm font-medium text-muted-foreground">Client Type</Label>
                                            <p className="font-medium">{taskData.client?.clientType}</p>
                                        </div>
                                        <div>
                                            <Label className="text-sm font-medium text-muted-foreground">Contact Person</Label>
                                            <p className="font-medium">{taskData.client?.authorizedPersonName}</p>
                                        </div>
                                        <div>
                                            <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
                                            <p className="font-medium">{taskData.client?.phoneNumber}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                                        <p className="font-medium">{taskData.client?.email}</p>
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
                                            <span className="text-sm font-bold">0%</span>
                                        </div>
                                        <Progress value={0} className="h-3" />
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
                                            <div className="text-sm text-muted-foreground">{formatDateTime(taskData.createdAt)}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <div className="text-sm font-medium">Due Date</div>
                                            <div className="text-sm text-muted-foreground">{formatDateTime(taskData.dueDate)}</div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent >

                {/* Comments Tab */}
                < TabsContent value="comments" className="space-y-6" >
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
                                <p className="text-muted-foreground">No comments yet.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent >

                {/* Time Log Tab */}
                < TabsContent value="timelog" className="space-y-6" >
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span>Time Log</span>
                            </CardTitle>
                            <CardDescription>
                                Track time spent on this task.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <p className="text-muted-foreground">No time log entries yet.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent >
            </Tabs >
        </div >
    )
}
