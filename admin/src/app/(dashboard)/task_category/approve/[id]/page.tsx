"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    ArrowLeft,
    CheckCircle,
    X,
    MoreHorizontal,
    Edit,
    Trash2,
    Eye,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    ArrowUpDown,
    Calendar,
    User,
    Clock,
    Tag,
    FileText,
} from "lucide-react"
import Link from "next/link"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export interface TaskCategory {
    id: number
    name: string
    description: string
    color: string
    status: "approved" | "pending"
    taskCount: number
    createdAt: string
    updatedAt: string
    createdBy: string
    photo?: string
}


export interface Task {
    id: number
    title: string
    description: string
    status: "pending" | "in_progress" | "completed" | "cancelled"
    priority: "low" | "medium" | "high" | "urgent"
    assignedTo: string
    assignedBy: string
    dueDate: string
    createdAt: string
    updatedAt: string
    categoryId: number
    estimatedHours: number
    actualHours?: number
    tags: string[]
    attachments?: string[]
}


// Mock category data
const mockCategory: TaskCategory = {
    id: 3,
    name: "Marketing",
    description:
        "Marketing campaigns and promotional activities including social media management, content creation, advertising campaigns, and brand development initiatives.",
    color: "green",
    status: "pending",
    taskCount: 0,
    createdAt: "2024-01-20",
    updatedAt: "2024-01-28",
    createdBy: "Mike Wilson",
    photo: "/placeholder.svg?height=80&width=80",
}

// Mock tasks data
const mockTasks: Task[] = [
    {
        id: 1,
        title: "Social Media Campaign Q1",
        description: "Create and execute social media campaign for Q1 product launch",
        status: "in_progress",
        priority: "high",
        assignedTo: "Sarah Johnson",
        assignedBy: "Mike Wilson",
        dueDate: "2024-02-15",
        createdAt: "2024-01-20",
        updatedAt: "2024-01-25",
        categoryId: 3,
        estimatedHours: 40,
        actualHours: 25,
        tags: ["social-media", "campaign", "q1"],
        attachments: ["campaign-brief.pdf", "assets.zip"],
    },
    {
        id: 2,
        title: "Brand Guidelines Update",
        description: "Update brand guidelines to reflect new visual identity",
        status: "pending",
        priority: "medium",
        assignedTo: "Alex Rodriguez",
        assignedBy: "Mike Wilson",
        dueDate: "2024-02-20",
        createdAt: "2024-01-22",
        updatedAt: "2024-01-22",
        categoryId: 3,
        estimatedHours: 20,
        tags: ["branding", "guidelines"],
    },
    {
        id: 3,
        title: "Email Marketing Automation",
        description: "Set up automated email sequences for new customer onboarding",
        status: "completed",
        priority: "medium",
        assignedTo: "Lisa Chen",
        assignedBy: "Mike Wilson",
        dueDate: "2024-01-30",
        createdAt: "2024-01-15",
        updatedAt: "2024-01-28",
        categoryId: 3,
        estimatedHours: 15,
        actualHours: 18,
        tags: ["email", "automation", "onboarding"],
    },
    {
        id: 4,
        title: "Market Research Analysis",
        description: "Analyze competitor strategies and market trends for Q2 planning",
        status: "in_progress",
        priority: "high",
        assignedTo: "David Brown",
        assignedBy: "Mike Wilson",
        dueDate: "2024-02-10",
        createdAt: "2024-01-25",
        updatedAt: "2024-01-27",
        categoryId: 3,
        estimatedHours: 30,
        actualHours: 12,
        tags: ["research", "analysis", "competitors"],
        attachments: ["research-data.xlsx"],
    },
    {
        id: 5,
        title: "Content Calendar Creation",
        description: "Develop content calendar for social media and blog posts for Q1",
        status: "pending",
        priority: "low",
        assignedTo: "Emma Davis",
        assignedBy: "Mike Wilson",
        dueDate: "2024-02-25",
        createdAt: "2024-01-28",
        updatedAt: "2024-01-28",
        categoryId: 3,
        estimatedHours: 12,
        tags: ["content", "calendar", "planning"],
    },
    {
        id: 6,
        title: "Website Analytics Setup",
        description: "Configure Google Analytics 4 and set up conversion tracking",
        status: "completed",
        priority: "urgent",
        assignedTo: "Nina Patel",
        assignedBy: "Mike Wilson",
        dueDate: "2024-01-25",
        createdAt: "2024-01-18",
        updatedAt: "2024-01-24",
        categoryId: 3,
        estimatedHours: 8,
        actualHours: 10,
        tags: ["analytics", "tracking", "website"],
    },
    {
        id: 7,
        title: "Influencer Partnership Program",
        description: "Develop and launch influencer partnership program for brand awareness",
        status: "pending",
        priority: "medium",
        assignedTo: "John Smith",
        assignedBy: "Mike Wilson",
        dueDate: "2024-03-01",
        createdAt: "2024-01-30",
        updatedAt: "2024-01-30",
        categoryId: 3,
        estimatedHours: 25,
        tags: ["influencer", "partnership", "awareness"],
    },
    {
        id: 8,
        title: "Customer Feedback Survey",
        description: "Create and distribute customer satisfaction survey",
        status: "cancelled",
        priority: "low",
        assignedTo: "Sarah Johnson",
        assignedBy: "Mike Wilson",
        dueDate: "2024-02-05",
        createdAt: "2024-01-20",
        updatedAt: "2024-01-26",
        categoryId: 3,
        estimatedHours: 6,
        tags: ["survey", "feedback", "customer"],
    },
]

export default function ApproveCategory() {
    const [category, setCategory] = useState<TaskCategory | null>(null)
    const [tasks, setTasks] = useState<Task[]>([])
    const [sortBy, setSortBy] = useState("a-z")
    const [sortByDate, setSortByDate] = useState("newest")
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(5)
    const [loading, setLoading] = useState(true)
    const [approving, setApproving] = useState(false)
    const [rejecting, setRejecting] = useState(false)
    const [rejectionReason, setRejectionReason] = useState("")
    const [showRejectDialog, setShowRejectDialog] = useState(false)

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Simulate API calls
                await new Promise((resolve) => setTimeout(resolve, 1000))
                setCategory(mockCategory)
                setTasks(mockTasks)
            } catch (error) {
                console.error("Error fetching data:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    // Sort function
    const sortTasks = (tasks: Task[], sortBy: string, sortByDate: string) => {
        return [...tasks].sort((a, b) => {
            if (sortBy === "a-z") {
                return a.title.localeCompare(b.title)
            } else if (sortBy === "z-a") {
                return b.title.localeCompare(a.title)
            }

            if (sortByDate === "newest") {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            } else if (sortByDate === "oldest") {
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            }

            return 0
        })
    }

    // Apply sorting to tasks
    const sortedTasks = sortTasks(tasks, sortBy, sortByDate)

    // Pagination logic
    const totalPages = Math.ceil(sortedTasks.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentTasks = sortedTasks.slice(startIndex, endIndex)

    const handlePageChange = (page: number) => {
        setCurrentPage(page)
    }

    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(Number.parseInt(value))
        setCurrentPage(1)
    }

    const handleApprove = async () => {
        if (!category) return
        setApproving(true)
        try {
            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 1500))
            alert("Category approved successfully!")
            // Redirect back to category management
            window.history.back()
        } catch (error) {
            console.error("Error approving category:", error)
            alert("Failed to approve category")
        } finally {
            setApproving(false)
        }
    }

    const handleReject = async () => {
        if (!category || !rejectionReason.trim()) return
        setRejecting(true)
        try {
            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 1500))
            alert("Category rejected successfully!")
            setShowRejectDialog(false)
            // Redirect back to category management
            window.history.back()
        } catch (error) {
            console.error("Error rejecting category:", error)
            alert("Failed to reject category")
        } finally {
            setRejecting(false)
        }
    }

    const getStatusBadge = (status: string) => {
        const colors = {
            pending: "bg-yellow-100 text-yellow-800",
            in_progress: "bg-blue-100 text-blue-800",
            completed: "bg-green-100 text-green-800",
            cancelled: "bg-red-100 text-red-800",
        }
        return <Badge className={colors[status as keyof typeof colors]}>{status.replace("_", " ")}</Badge>
    }

    const getPriorityBadge = (priority: string) => {
        const colors = {
            low: "bg-gray-100 text-gray-800",
            medium: "bg-blue-100 text-blue-800",
            high: "bg-orange-100 text-orange-800",
            urgent: "bg-red-100 text-red-800",
        }
        return <Badge className={colors[priority as keyof typeof colors]}>{priority}</Badge>
    }

    const getColorBadge = (color: string) => {
        const colorClasses = {
            blue: "bg-blue-500",
            green: "bg-green-500",
            red: "bg-red-500",
            yellow: "bg-yellow-500",
            purple: "bg-purple-500",
            pink: "bg-pink-500",
            indigo: "bg-indigo-500",
            orange: "bg-orange-500",
        }
        return (
            <div className={`w-6 h-6 rounded-full ${colorClasses[color as keyof typeof colorClasses] || "bg-gray-500"}`} />
        )
    }

    if (loading) {
        return (
            <div className="container mx-auto p-6 max-w-7xl">
                <div className="flex justify-center items-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </div>
        )
    }

    if (!category) {
        return (
            <div className="container mx-auto p-6 max-w-7xl">
                <div className="text-center py-20">
                    <p className="text-muted-foreground">Category not found</p>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-[28px] md:text-3xl font-bold">Approve Category</h1>
                        <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
                            Review category details and associated tasks before approval
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    Category Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <Avatar className="h-16 w-16">
                                        <AvatarImage src={category.photo || ""} />
                                        <AvatarFallback className="text-lg">
                                            {category.name
                                                .toUpperCase()
                                                .split(" ")
                                                .map((n) => n[0])
                                                .join("")}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h2 className="text-2xl font-semibold">{category.name}</h2>
                                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                                Pending Approval
                                            </Badge>
                                        </div>
                                        <p className="text-muted-foreground mb-4">{category.description}</p>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                <span>Created by: {category.createdBy}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                <span>Created: {new Date(category.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-muted-foreground" />
                                                <span>Updated: {new Date(category.updatedAt).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Tag className="h-4 w-4 text-muted-foreground" />
                                                <span>Tasks: {tasks.length}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div>
                        <Card>
                            <CardHeader>
                                <CardTitle>Actions</CardTitle>
                                <CardDescription>Approve or reject this category</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button onClick={handleApprove} disabled={approving} className="w-full bg-green-600 hover:bg-green-700">
                                    {approving ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            Approving...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="h-4 w-4 mr-2" />
                                            Approve Category
                                        </>
                                    )}
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => setShowRejectDialog(true)}
                                    disabled={rejecting}
                                    className="w-full"
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    Reject Category
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Category Tasks ({tasks.length})
                            </CardTitle>
                            <div className="flex items-center gap-2">
                                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                                <Select value={sortBy} onValueChange={setSortBy}>
                                    <SelectTrigger className="w-32">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="a-z">A-Z</SelectItem>
                                        <SelectItem value="z-a">Z-A</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select>
                                    <SelectTrigger className="w-28">
                                        <SelectValue className="text-black" placeholder="Priority" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={sortByDate} onValueChange={setSortByDate}>
                                    <SelectTrigger className="w-32">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="newest">Newest</SelectItem>
                                        <SelectItem value="oldest">Oldest</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    {loading ? (
                        <div className="flex justify-center items-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <>
                            <CardContent>
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Task</TableHead>
                                                <TableHead>Assigned To</TableHead>
                                                <TableHead>Priority</TableHead>
                                                <TableHead>Due Date</TableHead>
                                                <TableHead>Progress</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {currentTasks.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                        No tasks found in this category.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                currentTasks.map((task) => (
                                                    <TableRow key={task.id}>
                                                        <TableCell>
                                                            <div className="space-y-1">
                                                                <div className="font-medium">{task.title}</div>
                                                                <div
                                                                    className="text-sm text-muted-foreground max-w-xs truncate"
                                                                    title={task.description}
                                                                >
                                                                    {task.description}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center space-x-2">
                                                                <Avatar className="h-8 w-8">
                                                                    <AvatarFallback className="text-xs">
                                                                        {task.assignedTo
                                                                            .toUpperCase()
                                                                            .split(" ")
                                                                            .map((n) => n[0])
                                                                            .join("")}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <div className="font-medium text-sm">{task.assignedTo}</div>
                                                                    <div className="text-xs text-muted-foreground">by {task.assignedBy}</div>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-1">
                                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                                <span>
                                                                    {new Date(task.dueDate).toLocaleDateString("en-US", {
                                                                        month: "short",
                                                                        day: "numeric",
                                                                        year: "numeric",
                                                                    })}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-sm font-medium">{task.status.replace("_", " ")}</span>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                                        <span className="sr-only">Open menu</span>
                                                                        <MoreHorizontal className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                    <DropdownMenuItem asChild>
                                                                        <Link href={`/task/${task.id}`}>
                                                                            <Eye className="mr-2 h-4 w-4" />
                                                                            View Details
                                                                        </Link>
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem asChild>
                                                                        <Link href={`/task/${task.id}/edit`}>
                                                                            <Edit className="mr-2 h-4 w-4" />
                                                                            Edit Task
                                                                        </Link>
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem className="text-destructive">
                                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                                        Delete Task
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between space-x-2 py-4">
                                        <div className="text-sm text-muted-foreground">
                                            Page {currentPage} of {totalPages}
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                                                <SelectTrigger className="w-24">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {[5, 10, 20, 50].map((value) => (
                                                        <SelectItem key={value} value={value.toString()}>
                                                            {value} / page
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handlePageChange(1)}
                                                disabled={currentPage === 1}
                                            >
                                                <ChevronsLeft className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handlePageChange(currentPage - 1)}
                                                disabled={currentPage === 1}
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                const pageNumber = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
                                                if (pageNumber <= totalPages) {
                                                    return (
                                                        <Button
                                                            key={pageNumber}
                                                            variant={currentPage === pageNumber ? "default" : "outline"}
                                                            size="sm"
                                                            onClick={() => handlePageChange(pageNumber)}
                                                        >
                                                            {pageNumber}
                                                        </Button>
                                                    )
                                                }
                                                return null
                                            })}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handlePageChange(currentPage + 1)}
                                                disabled={currentPage === totalPages}
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handlePageChange(totalPages)}
                                                disabled={currentPage === totalPages}
                                            >
                                                <ChevronsRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </>
                    )}
                </Card>

                <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Reject Category</AlertDialogTitle>
                            <AlertDialogDescription>
                                Please provide a reason for rejecting this category. This will help the creator understand what needs to
                                be improved.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="py-4">
                            <Label htmlFor="rejection-reason">Rejection Reason *</Label>
                            <Textarea
                                id="rejection-reason"
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Enter reason for rejection..."
                                rows={4}
                                className="mt-2"
                            />
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleReject}
                                disabled={!rejectionReason.trim() || rejecting}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                {rejecting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Rejecting...
                                    </>
                                ) : (
                                    "Reject Category"
                                )}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    )
}
