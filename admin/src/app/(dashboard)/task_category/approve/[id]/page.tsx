"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "react-toastify"
import { Loader2, TimerIcon } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { useTablePage } from "@/hooks/useTablePage"

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
    timePeriod?: number
}


// Define user type for assignedTo and assignedBy
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



export default function ApproveCategory({ params }: { params: Promise<{ id: string }> | { id: string } }) {
    // Unwrap params using React.use() to future-proof the code
    const resolvedParams = params instanceof Promise ? use(params) : params
    const router = useRouter()
    const [category, setCategory] = useState<TaskCategory | null>(null)
    const [tasks, setTasks] = useState<Task[]>([])
    const [sortBy, setSortBy] = useState("a-z")
    const [sortByDate, setSortByDate] = useState("newest")
    const { currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, clampToTotalPages } =
        useTablePage("admin-dashboard-task_category-approve-id-page")
    const [loading, setLoading] = useState(true)
    const [approving, setApproving] = useState(false)
    const [rejecting, setRejecting] = useState(false)
    const [rejectionReason, setRejectionReason] = useState("")
    const [showRejectDialog, setShowRejectDialog] = useState(false)
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("")
    const [timePeriod, setTimePeriod] = useState("")
    const [processFlow, setProccessFlow] = useState("");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async () => {

        if (!title?.trim()) {
            toast.error("Title is required");
            return;
        }

        if (!description?.trim()) {
            toast.error("Description is required");
            return;
        }

        try {
            setIsSubmitting(true);

            const payload = {
                name: title.trim(),
                description: description.trim(),
                timePeriod: parseInt(timePeriod, 10),
                processFlow: processFlow.trim(),
                notes: notes.trim()
            };

            const response = await fetch(
                `/api/task-categories/${resolvedParams?.id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to update category");
            }

            toast.success("Category updated successfully!");
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : "Failed to update category";
            toast.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };


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
                setTitle(categoryData.name);
                setDescription(categoryData.description);
                setTimePeriod(categoryData.timePeriod ? String(categoryData.timePeriod) : "");
                setProccessFlow(categoryData.processFlow)
                setNotes(categoryData.notes)

                // Fetch tasks associated with this category
                const tasksResponse = await fetch(`/api/tasks?categoryId=${categoryId}`)

                if (tasksResponse.ok) {
                    const tasksData = await tasksResponse.json()
                    setTasks(tasksData)
                } else {
                    console.error("Error fetching tasks:", await tasksResponse.text())
                    setTasks([])
                }
            } catch (error) {
                console.error("Error fetching data:", error)
                const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
                toast.error(`Failed to load category: ${errorMessage}`)
                // Don't set mock data in production
                setCategory(null)
                setTasks([])
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [resolvedParams.id])

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

    useEffect(() => {
        clampToTotalPages(totalPages)
    }, [totalPages, clampToTotalPages])
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
            // Call API to approve category
            const response = await fetch(`/api/task-categories/${resolvedParams.id}/approve`, {
                method: 'PUT',
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || 'Failed to approve category')
            }

            await response.json()

            // Show success message and redirect
            toast.success("Category approved successfully")
            // Redirect to the category detail page to show the updated status
            router.push(`/task_category/${resolvedParams.id}`)
        } catch (error) {
            console.error("Error approving category:", error)
            const errorMessage = error instanceof Error ? error.message : "Failed to approve category"
            toast.error(errorMessage)
        } finally {
            setApproving(false)
        }
    }

    const handleReject = async () => {
        if (!category || !rejectionReason.trim()) return
        setRejecting(true)
        try {
            // Call API to reject category
            const response = await fetch(`/api/task-categories/${resolvedParams.id}/reject`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ rejectionReason }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || 'Failed to reject category')
            }

            await response.json()

            // Show success message and redirect
            toast.success("Category rejected successfully")
            setShowRejectDialog(false)
            // Redirect to the category detail page to show the updated status
            router.push(`/task_category`)
        } catch (error) {
            console.error("Error rejecting category:", error)
            const errorMessage = error instanceof Error ? error.message : "Failed to reject category"
            toast.error(errorMessage)
        } finally {
            setRejecting(false)
        }
    }

    // Badge components
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
                <div className="flex flex-col justify-center items-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Loading category data...</p>
                </div>
            </div>
        )
    }

    if (!category) {
        return (
            <div className="container mx-auto p-6 max-w-7xl">
                <div className="text-center py-20">
                    <p className="text-muted-foreground text-xl mb-4">Category not found</p>
                    <Button
                        onClick={() => router.push('/task_category')}
                        variant="outline"
                    >
                        Return to Categories
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-[28px] md:text-3xl font-bold">Approve Service</h1>
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
                                    Service Details
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
                                            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
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
                                        <Input className="mb-1" value={timePeriod} onChange={(e) => setTimePeriod(e.target.value)} />
                                        <Input className="mb-1" placeholder="Process Flow" value={processFlow} onChange={(e) => setProccessFlow(e.target.value)} />
                                        <Input className="mb-1" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                                        <Textarea className="mb-2" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                                        <div className="flex justify-end mb-5">
                                            <Button
                                                className="cursor-pointer shadow-none hover:shadow-lg transition-shadow duration-300"
                                                type="submit"
                                                disabled={isSubmitting}
                                                onClick={handleSubmit}
                                            >
                                                {isSubmitting ? "Updating..." : "Update Service Details"}
                                            </Button>
                                        </div>

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
                                                <span>Tasks: {tasks?.length || 0}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <TimerIcon className="h-4 w-4 text-muted-foreground" />
                                                <span>Time Periods: {category.timePeriod || 0} days</span>
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
                                <CardDescription>Approve or reject this service</CardDescription>
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
                                            Approve Service
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
                                    Reject Service
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
                                Service Tasks ({tasks?.length || 0})
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
                                <div className="rounded-md border overflow-x-auto">
                                    <Table className="min-w-[700px]">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Task</TableHead>
                                                <TableHead>Ownership to</TableHead>
                                                <TableHead>Priority</TableHead>
                                                <TableHead>Due Date</TableHead>
                                                <TableHead>Progress</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {!currentTasks || currentTasks.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                        No tasks found in this service.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                currentTasks.map((task) => (
                                                    <TableRow key={task.id}>
                                                        <TableCell className="max-w-[220px] align-middle">
                                                            <div className="space-y-1">
                                                                <div className="font-medium truncate" style={{ maxWidth: '200px' }} title={task.title}>{task.title}</div>
                                                                <div
                                                                    className="text-sm text-muted-foreground truncate"
                                                                    style={{ maxWidth: '200px' }}
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

                <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Reject Service</AlertDialogTitle>
                            <AlertDialogDescription>
                                Please provide a reason for rejecting this service. This will help the creator understand what needs to
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
                                    "Reject Service"
                                )}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div >
    )
}
