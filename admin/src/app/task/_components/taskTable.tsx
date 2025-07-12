"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
    Clock,
    AlertCircle,
    Calendar,
    CheckCircle,
    XCircle,
    Pause,
} from "lucide-react"
import Link from "next/link"

// Mock data for tasks
const mockTasks = [
    {
        id: "1",
        taskName: "Contract Review - Acme Corp",
        description: "Review and analyze the service agreement contract for Acme Corporation",
        clientName: "Acme Corporation",
        clientPhone: "+1 (555) 123-4567",
        clientEmail: "john.anderson@acme.com",
        assignedAgent: "John Smith",
        agentType: "Senior Partner",
        priority: "high",
        status: "In Progress",
        createdDate: "2024-01-15",
        dueDate: "2024-01-25",
        percentageCompleted: 65,
        category: "Contract Review",
    },
    {
        id: "2",
        taskName: "Legal Research - Patent Law",
        description: "Research patent infringement case precedents for TechStart Inc.",
        clientName: "TechStart Inc.",
        clientPhone: "+1 (555) 345-6789",
        clientEmail: "michael.chen@techstart.com",
        assignedAgent: "Sarah Johnson",
        agentType: "Partner",
        priority: "medium",
        status: "Pending",
        createdDate: "2024-01-18",
        dueDate: "2024-01-30",
        percentageCompleted: 0,
        category: "Legal Research",
    },
    {
        id: "3",
        taskName: "Client Consultation - Family Law",
        description: "Initial consultation for divorce proceedings",
        clientName: "Sarah Mitchell",
        clientPhone: "+1 (555) 234-5678",
        clientEmail: "sarah.mitchell@email.com",
        assignedAgent: "Michael Brown",
        agentType: "Associate",
        priority: "low",
        status: "Completed",
        createdDate: "2024-01-10",
        dueDate: "2024-01-20",
        percentageCompleted: 100,
        category: "Consultation",
    },
    {
        id: "4",
        taskName: "Document Preparation - Will & Testament",
        description: "Prepare last will and testament documents for Robert Williams",
        clientName: "Robert Williams",
        clientPhone: "+1 (555) 456-7890",
        clientEmail: "robert.williams@email.com",
        assignedAgent: "Emily Davis",
        agentType: "Junior Associate",
        priority: "medium",
        status: "In Progress",
        createdDate: "2024-01-20",
        dueDate: "2024-02-05",
        percentageCompleted: 45,
        category: "Document Drafting",
    },
    {
        id: "5",
        taskName: "Court Filing - Corporate Merger",
        description: "File merger documents with state regulatory authorities",
        clientName: "Global Enterprises",
        clientPhone: "+1 (555) 567-8901",
        clientEmail: "lisa.thompson@global.com",
        assignedAgent: "John Smith",
        agentType: "Senior Partner",
        priority: "high",
        status: "Overdue",
        createdDate: "2024-01-05",
        dueDate: "2024-01-22",
        percentageCompleted: 80,
        category: "Filing",
    },
    {
        id: "6",
        taskName: "Case Preparation - Personal Injury",
        description: "Prepare case files and evidence for personal injury lawsuit",
        clientName: "Jennifer Martinez",
        clientPhone: "+1 (555) 678-9012",
        clientEmail: "jennifer.martinez@email.com",
        assignedAgent: "Sarah Johnson",
        agentType: "Partner",
        priority: "high",
        status: "In Progress",
        createdDate: "2024-01-22",
        dueDate: "2024-02-10",
        percentageCompleted: 30,
        category: "Case Preparation",
    },
    {
        id: "7",
        taskName: "Contract Negotiation - Employment Agreement",
        description: "Negotiate terms for executive employment contract",
        clientName: "TechStart Inc.",
        clientPhone: "+1 (555) 345-6789",
        clientEmail: "michael.chen@techstart.com",
        assignedAgent: "Michael Brown",
        agentType: "Associate",
        priority: "medium",
        status: "Pending",
        createdDate: "2024-01-25",
        dueDate: "2024-02-15",
        percentageCompleted: 0,
        category: "Contract Negotiation",
    },
    {
        id: "8",
        taskName: "Compliance Review - Healthcare Regulations",
        description: "Review healthcare compliance policies and procedures",
        clientName: "MedCare Solutions",
        clientPhone: "+1 (555) 789-0123",
        clientEmail: "compliance@medcare.com",
        assignedAgent: "Emily Davis",
        agentType: "Junior Associate",
        priority: "low",
        status: "Completed",
        createdDate: "2024-01-12",
        dueDate: "2024-01-28",
        percentageCompleted: 100,
        category: "Compliance Review",
    },
]

const priorities = ["All Priorities", "Low", "Medium", "High"]
const statuses = ["All Status", "Pending", "In Progress", "Completed", "Overdue", "On Hold"]
const categories = [
    "All Categories",
    "Contract Review",
    "Legal Research",
    "Consultation",
    "Document Drafting",
    "Filing",
    "Case Preparation",
    "Contract Negotiation",
    "Compliance Review",
]

export default function TasksTable() {
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedPriority, setSelectedPriority] = useState("All Priorities")
    const [selectedStatus, setSelectedStatus] = useState("All Status")
    const [selectedCategory, setSelectedCategory] = useState("All Categories")
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(5)

    // Filter tasks based on search and filters
    const filteredTasks = mockTasks.filter((task) => {
        const matchesSearch =
            task.taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            task.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            task.assignedAgent.toLowerCase().includes(searchTerm.toLowerCase()) ||
            task.description.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesPriority = selectedPriority === "All Priorities" || task.priority === selectedPriority.toLowerCase()
        const matchesStatus = selectedStatus === "All Status" || task.status === selectedStatus
        const matchesCategory = selectedCategory === "All Categories" || task.category === selectedCategory

        return matchesSearch && matchesPriority && matchesStatus && matchesCategory
    })

    // Pagination logic
    const totalPages = Math.ceil(filteredTasks.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentTasks = filteredTasks.slice(startIndex, endIndex)

    const handlePageChange = (page: number) => {
        setCurrentPage(page)
    }

    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(Number.parseInt(value))
        setCurrentPage(1)
    }

    const clearFilters = () => {
        setSearchTerm("")
        setSelectedPriority("All Priorities")
        setSelectedStatus("All Status")
        setSelectedCategory("All Categories")
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

    const getStatusBadge = (status: string) => {
        const colors = {
            Pending: "bg-gray-100 text-gray-800 border-gray-200",
            "In Progress": "bg-blue-100 text-blue-800 border-blue-200",
            Completed: "bg-green-100 text-green-800 border-green-200",
            Overdue: "bg-red-100 text-red-800 border-red-200",
            "On Hold": "bg-orange-100 text-orange-800 border-orange-200",
        }

        const icons = {
            Pending: <Clock className="w-3 h-3 mr-1" />,
            "In Progress": <Pause className="w-3 h-3 mr-1" />,
            Completed: <CheckCircle className="w-3 h-3 mr-1" />,
            Overdue: <XCircle className="w-3 h-3 mr-1" />,
            "On Hold": <Pause className="w-3 h-3 mr-1" />,
        }

        return (
            <Badge className={`${colors[status as keyof typeof colors]} border`}>
                {icons[status as keyof typeof icons]}
                {status}
            </Badge>
        )
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        })
    }

    const isOverdue = (dueDate: string, status: string) => {
        return new Date(dueDate) < new Date() && status !== "Completed"
    }

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
                        {/* Search */}
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <Label htmlFor="search">Search Tasks</Label>
                                <div className="relative my-2 ">
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
  className="cursor-pointer bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 shadow-none hover:shadow-lg transition-shadow duration-300"
>
  Search
</Button>

<Button
  className="cursor-pointer hover:text-white text-white bg-[#f42b03] hover:bg-[#f42b03] rounded-lg px-4 py-2 shadow-none hover:shadow-lg transition-shadow duration-300"
  variant="outline"
>
  Clear
</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tasks Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Tasks ({filteredTasks.length})
                    </CardTitle>
                </CardHeader>
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
                                                    <div className="font-medium">{task.taskName}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <div className="font-medium">{task.clientName}</div>
                                                    <div className="text-sm text-muted-foreground">{task.clientEmail}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center space-x-2">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarFallback className="text-xs">
                                                            {task.assignedAgent
                                                                .split(" ")
                                                                .map((n) => n[0])
                                                                .join("")}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium text-sm">{task.assignedAgent}</div>
                                                        <div className="text-xs text-muted-foreground">{task.agentType}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                                    <span className={isOverdue(task.dueDate, task.status) ? "text-red-600 font-medium" : ""}>
                                                        {formatDate(task.dueDate)}
                                                    </span>
                                                </div>
                                                {isOverdue(task.dueDate, task.status) && (
                                                    <Badge variant="destructive" className="text-xs mt-1">
                                                        Overdue
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-medium">{task.percentageCompleted}%</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {task.percentageCompleted === 100
                                                                ? "Complete"
                                                                : task.percentageCompleted === 0
                                                                    ? "Not Started"
                                                                    : "In Progress"}
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                                        <div
                                                            className={`h-2 rounded-full transition-all duration-300 ${task.percentageCompleted === 100
                                                                ? "bg-green-500"
                                                                : task.percentageCompleted >= 75
                                                                    ? "bg-blue-500"
                                                                    : task.percentageCompleted >= 50
                                                                        ? "bg-yellow-500"
                                                                        : task.percentageCompleted > 0
                                                                            ? "bg-orange-500"
                                                                            : "bg-gray-300"
                                                                }`}
                                                            style={{
                                                                width: `${task.percentageCompleted}%`,
                                                            }}
                                                        />
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
                                                        <DropdownMenuItem>
                                                            <Eye className="mr-2 h-4 w-4" />
                                                            View Details
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem>
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            Edit Task
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

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between space-x-2 py-4">
                            <div className="text-sm text-muted-foreground">
                                Page {currentPage} of {totalPages}
                            </div>
                            <div className="flex items-center space-x-2">
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
            </Card>
        </div>
    )
}
