"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Loader2 } from "lucide-react"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    FileText,
    Plus,
    Search,
    Filter,
    MoreHorizontal,
    Edit,
    Trash2,
    Eye,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    AlertCircle,
    Calendar,
    ArrowUpDown,
} from "lucide-react"
import Link from "next/link"

import { Task } from "@/types"
import { useEffect } from "react"

const priorities = ["All Priorities", "Low", "Medium", "High"]
const statuses = ["All Status", "To Do", "In Progress", "Done"]

export default function TasksTable() {
    const [tasks, setTasks] = useState<Task[] | null>(null)
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedPriority, setSelectedPriority] = useState("All Priorities")
    const [selectedStatus, setSelectedStatus] = useState("All Status")
    const [sortBy, setSortBy] = useState("a-z")
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(5)
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)

    useEffect(() => {
        const fetchTasks = async () => {
            try {
                const response = await fetch('/api/tasks');
                if (response.ok) {
                    const data = await response.json();
                    setTasks(data);
                } else {
                    console.error("Failed to fetch tasks");
                    setTasks([]); // Set to empty array on error
                }
            } catch (error) {
                console.error("Error fetching tasks:", error);
                setTasks([]); // Set to empty array on error
            } finally {
                setLoading(false);
            }
        };

        fetchTasks();
    }, []);

    const handleDelete = async () => {
        if (!taskToDelete) return

        try {
            const response = await fetch(`/api/tasks/${taskToDelete.id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setTasks((tasks || []).filter((task) => task.id !== taskToDelete.id));
                setTaskToDelete(null);
            } else {
                console.error("Failed to delete task");
            }
        } catch (error) {
            console.error("Error deleting task:", error);
        }
    }

    // Sort function
    const sortTasks = (tasks: Task[], sortBy: string) => {
        return [...tasks].sort((a, b) => {
            if (sortBy === "a-z") {
                return a.title.localeCompare(b.title)
            } else if (sortBy === "z-a") {
                return b.title.localeCompare(a.title)
            }
            return 0
        })
    }

    // Filter tasks based on search and filters
    const filteredTasks = (tasks || []).filter((task) => {
        const matchesSearch =
            task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (task.client && (task.client.clientType === 'individual' ? `${task.client.firstName} ${task.client.lastName}` : task.client.organizationName)?.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (task.assignedTo && task.assignedTo.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()))

        const matchesPriority = selectedPriority === "All Priorities" || task.priority.toLowerCase() === selectedPriority.toLowerCase()
        const matchesStatus = selectedStatus === "All Status" || task.status === selectedStatus

        return matchesSearch && matchesPriority && matchesStatus
    })

    // Apply sorting to filtered tasks
    const sortedTasks = sortTasks(filteredTasks, sortBy)

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

    const getPriorityBadge = (priority: string) => {
        const colors = {
            low: "bg-green-100 text-green-800 border-green-200",
            medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
            high: "bg-red-100 text-red-800 border-red-200",
        }

        const icons = {
            low: <AlertCircle className="w-3 h-3 mr-1" />,
            medium: <AlertCircle className="w-3 h-3 mr-1" />,
            high: <AlertCircle className="w-3 h-3 mr-1" />,
        }

        return (
            <Badge className={`${colors[priority as keyof typeof colors]} border`}>
                {icons[priority as keyof typeof icons]}
                {priority.charAt(0).toUpperCase() + priority.slice(1)}
            </Badge>
        )
    }

    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        })
    }

    const resetFilter = () => {
        setSearchTerm("");
        setSelectedPriority("All Priorities")
        setSelectedStatus("All Status")
    }

    const isOverdue = (dueDate: string | undefined, status: string) => {
        if (!dueDate) return false;
        return new Date(dueDate) < new Date() && status !== "Completed"
    }

    // if (loading) {
    //     return <p>Loading...</p>;
    // }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <div className="flex  flex-col md:flex-row  justify-between md:items-center  mb-6 md:mb-4">
                    <div>
                        <h1 className="text-3xl font-bold">Task Management</h1>
                        <p className="text-muted-foreground mt-2">Manage and track all legal tasks and assignments</p>
                    </div>
                    <Link href="/task/create" className="flex justify-end">
                        <Button className=" mt-[20px] md:mt-none   bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300">
                            <Plus className="h-4 w-4" />
                            Create Task
                        </Button>
                    </Link>
                </div>

                {/* Filters */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Filter className="h-5 w-5" />
                            Filters & Search
                        </CardTitle>
                        <CardDescription>Filter and search through your tasks</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">

                    <Card>
  {loading ? (
    <CardContent>
    <div className="h-[200px] w-full bg-gray-200 rounded-2xl mb-4"></div>

<div className="flex justify-between gap-4">
  <div className="h-5 w-1/2 bg-gray-200 rounded-xl mb-3"></div>
  <div className="h-5 w-1/2 bg-gray-200 rounded-xl mb-3"></div>
</div>

    </CardContent>
  ) : (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filters & Search
        </CardTitle>
        <CardDescription>Filter and search through your tasks</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label htmlFor="search">Search Tasks</Label>
            <div className="relative my-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by task name, client, agent, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={selectedPriority} onValueChange={setSelectedPriority}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorities.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {priority}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <Button
            onClick={resetFilter}
            className="cursor-pointer hover:text-white text-white bg-[#f42b03] hover:bg-[#f42b03] rounded-lg px-4 py-2 shadow-none hover:shadow-lg transition-shadow duration-300"
            variant="outline"
          >
            Clear
          </Button>
        </div>
      </CardContent>
    </>
  )}
</Card>



                    
                    </CardContent>
                </Card>
            </div>


       
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Tasks ({sortedTasks.length})
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
                            <Select  >
  <SelectTrigger className="w-28">
    <SelectValue className="text-black" placeholder="Priority" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="low">Low</SelectItem>
    <SelectItem value="medium">Medium</SelectItem>
    <SelectItem value="high">High</SelectItem>
  </SelectContent>
</Select>
                            <Select defaultValue="newest">
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


  {loading ? (<div className="flex justify-center items-center py-8">
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
                                    <TableHead>Client</TableHead>
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
                                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                            No tasks found matching your criteria.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    currentTasks.map((task) => (
                                        <TableRow key={task.id} className={isOverdue(task.dueDate, task.status) ? "bg-red-50" : ""}>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <div className="font-medium">{task.title}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <div className="font-medium">{task.client ? (task.client.clientType === 'individual' ? `${task.client.firstName} ${task.client.lastName}` : task.client.organizationName) : 'N/A'}</div>
                                                    <div className="text-sm text-muted-foreground">{task.client?.email}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center space-x-2">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarFallback className="text-xs">
                                                            {task.assignedTo?.name
                                                                .toUpperCase()
                                                                .split(" ")
                                                                .map((n) => n[0])
                                                                .join("")}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium text-sm">{task.assignedTo?.name}</div>
                                                        <div className="text-xs text-muted-foreground">{task.assignedTo?.agentType}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                                    <span className={isOverdue(task.dueDate, task.status) ? "text-red-600 font-medium" : ""}>
                                                        {task.dueDate ? formatDate(task.dueDate) : 'N/A'}
                                                    </span>
                                                </div>
                                                {task.dueDate && isOverdue(task.dueDate, task.status) && (
                                                    <Badge variant="destructive" className="text-xs mt-1">
                                                        Overdue
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-medium">{task.status}</span>
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
                                                        <DropdownMenuItem
                                                            className="text-destructive"
                                                            onClick={() => setTaskToDelete(task)}
                                                        >
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

                    {/* Pagination */}
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
                                <Button variant="outline" size="sm" onClick={() => handlePageChange(1)} disabled={currentPage === 1}>
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

                                {/* Page Numbers */}
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
  </> ) }



             
            </Card>
            <AlertDialog open={!!taskToDelete} onOpenChange={() => setTaskToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the task and remove its data from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}