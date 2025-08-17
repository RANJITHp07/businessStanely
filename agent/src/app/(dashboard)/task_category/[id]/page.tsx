"use client"

import { useState, useEffect } from "react"
import { use } from "react"
import { toast } from "react-toastify"
import Link from "next/link"

// UI Components
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton";

// Icons
import {
    Loader2,
    MoreHorizontal,
    Edit,
    Trash2,
    Eye,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Calendar,
    User,
    Clock,
    Tag,
    FileText,
} from "lucide-react"

export interface TaskCategory {
    id: string
    name: string
    description: string
    color: string
    status: "approved" | "pending"
    taskCount: number
    createdAt: string
    updatedAt: string
    createdBy: string
    createdById: string
    approvedBy?: string | null
    approvedById?: string | null
    approvedAt?: string | null
    rejectedBy?: string | null
    rejectedById?: string | null
    rejectedAt?: string | null
    rejectionReason?: string | null
    photo?: string
}


export interface Task {
    id: string
    title: string
    description: string
    status: "pending" | "in_progress" | "completed" | "cancelled"
    priority: "low" | "medium" | "high" | "urgent"
    assignedTo: string | UserInfo
    assignedToId: string
    assignedBy: string | UserInfo
    assignedById: string
    dueDate: string
    createdAt: string
    updatedAt: string
    categoryId: string
    categoryName?: string
    estimatedHours: number
    actualHours?: number
    completionPercent?: number
    tags: string[]
    attachments?: string[]
}


// User type definition for assignedTo and assignedBy
interface UserInfo {
    id: string
    name: string
    email: string
    phoneNumber?: string
    secondaryPhoneNumber?: string
    agentType?: string
    barAssociationId?: string
    jurisdiction?: string
    specializations?: string[]
    photo?: string
    createdAt?: string
    updatedAt?: string
    superiorId?: string
}


export default function CategoryDetail({ params }: { params: Promise<{ id: string }> | { id: string } }) {
    // Unwrap params using React.use() to future-proof the code
    const resolvedParams = params instanceof Promise ? use(params) : params
    const [category, setCategory] = useState<TaskCategory | null>(null)
    const [tasks, setTasks] = useState<Task[]>([])
    const [sortBy] = useState("a-z")
    const [sortByDate] = useState("newest")
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(5)
    const [loading, setLoading] = useState(true)
    // We only need the loading state for this view page
    // Other states were needed for approve page but not here

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch category from API
                const categoryId = resolvedParams.id
                const categoryResponse = await fetch(`/api/task-categories/${categoryId}`)

                if (!categoryResponse.ok) {
                    throw new Error('Failed to fetch category')
                }

                const categoryData = await categoryResponse.json()
                setCategory(categoryData)

                // Fetch tasks associated with this category
                const tasksResponse = await fetch(`/api/tasks?categoryId=${categoryId}`)

                if (tasksResponse.ok) {
                    const tasksData = await tasksResponse.json();
                    setTasks(tasksData.tasks || []);
                } else {
                    console.error("Error fetching tasks:", await tasksResponse.text());
                    setTasks([]);
                }
            } catch (error) {
                console.error("Error fetching data:", error)
                const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
                toast.error(`Failed to load category: ${errorMessage}`)
                setCategory(null)
                setTasks([])
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [resolvedParams.id])

    // Sort function
    const sortTasks = (tasks: Task[] | undefined, sortBy: string, sortByDate: string) => {
        const safeTasks = Array.isArray(tasks) ? tasks : [];
        return [...safeTasks].sort((a, b) => {
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
    const sortedTasks = tasks

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

    // These functions were for approval/rejection and aren't needed in the detail view page

    // Only keeping the priority badge function that's actually used
    const getPriorityBadge = (priority: string) => {
        const colors = {
            low: "bg-gray-100 text-gray-800",
            medium: "bg-blue-100 text-blue-800",
            high: "bg-orange-100 text-orange-800",
            urgent: "bg-red-100 text-red-800",
        }
        return <Badge className={colors[priority as keyof typeof colors]}>{priority}</Badge>
    }

    if (loading) {
        return (
            <div className="container mx-auto p-6 max-w-7xl">
                {/* Header Skeleton */}
                <div className="mb-8">
                    <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
                        <div>
                            <Skeleton className="h-8 w-40 mb-2" />
                            <Skeleton className="h-5 w-80" />
                        </div>
                        <Skeleton className="h-10 w-32 mt-[20px] md:mt-0" />
                    </div>
                    <Card>
                        <CardContent className="p-6">
                            <div className="space-y-4">
                                <Skeleton className="h-6 w-1/2 mb-2" />
                                <Skeleton className="h-4 w-full mb-4" />
                                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 p-0 md:p-4 bg-muted/30 rounded-lg">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-4 w-40 md:ml-auto" />
                                </div>
                            </div>

                        </CardContent>

                    </Card>

                    <Card className="mt-[20px]">
                        <CardContent className="p-6 mt-[30px]">
                            <div className="space-y-4">
                                <Skeleton className="h-6 w-1/2 mb-2" />
                                <Skeleton className="h-4 w-full mb-4" />
                                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 p-0 md:p-4 bg-muted/30 rounded-lg">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-4 w-40 md:ml-auto" />
                                </div>
                            </div>

                        </CardContent>

                    </Card>
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
                        <h1 className="text-[28px] md:text-3xl font-bold">Task Category Details</h1>
                        <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
                            Comprehensive view of task category details and associated tasks
                        </p>
                    </div>
                </div>

                <div className=" mb-8">
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
                                            <Badge
                                                variant="secondary"
                                                className={category.status === "approved"
                                                    ? "bg-green-100 text-green-800"
                                                    : "bg-yellow-100 text-yellow-800"
                                                }
                                            >
                                                {category.status === "approved" ? "Approved" : "Pending Approval"}
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
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Category Tasks ({tasks.length})
                            </CardTitle>
                            {/* <div className="flex items-center gap-2">
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
                            </div> */}
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
                                                                        {typeof task.assignedTo === 'string'
                                                                            ? task.assignedTo
                                                                                .toUpperCase()
                                                                                .split(" ")
                                                                                .map((n) => n[0])
                                                                                .join("")
                                                                            : "U"}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <div className="font-medium text-sm">
                                                                        {typeof task.assignedTo === 'string'
                                                                            ? task.assignedTo
                                                                            : task.assignedTo?.name || 'Unassigned'}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground">
                                                                        by {typeof task.assignedBy === 'string'
                                                                            ? task.assignedBy
                                                                            : task.assignedBy?.name || 'System'}
                                                                    </div>
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

                {/* No AlertDialog needed for the detail view */}
            </div>
        </div>
    )
}
