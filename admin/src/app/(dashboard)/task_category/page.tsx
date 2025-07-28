"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
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
    ArrowUpDown,
    CheckCircle,
    Clock,
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

const colorOptions = [
    { value: "blue", label: "Blue", class: "bg-blue-500" },
    { value: "green", label: "Green", class: "bg-green-500" },
    { value: "red", label: "Red", class: "bg-red-500" },
    { value: "yellow", label: "Yellow", class: "bg-yellow-500" },
    { value: "purple", label: "Purple", class: "bg-purple-500" },
    { value: "pink", label: "Pink", class: "bg-pink-500" },
    { value: "indigo", label: "Indigo", class: "bg-indigo-500" },
    { value: "orange", label: "Orange", class: "bg-orange-500" },
]

// Mock data for demonstration
const mockTaskCategories: any[] = [
    {
        id: 1,
        name: "Development",
        description: "Software development and programming tasks",
        color: "blue",
        status: "approved",
        taskCount: 25,
        createdAt: "2024-01-15",
        updatedAt: "2024-01-20",
        createdBy: "John Admin",
        photo: "/placeholder.svg?height=40&width=40",
    },
    {
        id: 2,
        name: "Design",
        description: "UI/UX design and creative tasks",
        color: "purple",
        status: "approved",
        taskCount: 18,
        createdAt: "2024-01-18",
        updatedAt: "2024-01-25",
        createdBy: "Sarah Manager",
        photo: "/placeholder.svg?height=40&width=40",
    },
    {
        id: 3,
        name: "Marketing",
        description: "Marketing campaigns and promotional activities",
        color: "green",
        status: "pending",
        taskCount: 0,
        createdAt: "2024-01-20",
        updatedAt: "2024-01-28",
        createdBy: "Mike Wilson",
    },
    {
        id: 4,
        name: "Testing",
        description: "Quality assurance and testing procedures",
        color: "red",
        status: "pending",
        taskCount: 0,
        createdAt: "2024-01-22",
        updatedAt: "2024-01-26",
        createdBy: "Lisa Chen",
        photo: "/placeholder.svg?height=40&width=40",
    },
    {
        id: 5,
        name: "Documentation",
        description: "Technical documentation and user guides",
        color: "yellow",
        status: "approved",
        taskCount: 15,
        createdAt: "2024-01-25",
        updatedAt: "2024-01-28",
        createdBy: "David Brown",
        photo: "/placeholder.svg?height=40&width=40",
    },
    {
        id: 6,
        name: "Support",
        description: "Customer support and help desk tasks",
        color: "orange",
        status: "approved",
        taskCount: 22,
        createdAt: "2024-02-01",
        updatedAt: "2024-02-05",
        createdBy: "Emma Davis",
    },
    {
        id: 7,
        name: "Research",
        description: "Market research and analysis tasks",
        color: "indigo",
        status: "pending",
        taskCount: 0,
        createdAt: "2024-02-03",
        updatedAt: "2024-02-03",
        createdBy: "Alex Rodriguez",
        photo: "/placeholder.svg?height=40&width=40",
    },
    {
        id: 8,
        name: "Training",
        description: "Employee training and development programs",
        color: "pink",
        status: "pending",
        taskCount: 0,
        createdAt: "2024-02-05",
        updatedAt: "2024-02-05",
        createdBy: "Nina Patel",
    },
]

export default function TaskCategoryTable() {
    const [categories, setCategories] = useState<TaskCategory[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [sortBy, setSortBy] = useState("a-z")
    const [sortByDate, setSortByDate] = useState("newest")
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(5)
    const [categoryToDelete, setCategoryToDelete] = useState<TaskCategory | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("approved")

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                // Simulate API call
                await new Promise((resolve) => setTimeout(resolve, 1000))
                setCategories(mockTaskCategories)
            } catch (error) {
                console.error("Error fetching categories:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchCategories()
    }, [])

    // Sort function
    const sortCategories = (categories: TaskCategory[], sortBy: string, sortByDate: string) => {
        return [...categories].sort((a, b) => {
            if (sortBy === "a-z") {
                return a.name.localeCompare(b.name)
            } else if (sortBy === "z-a") {
                return b.name.localeCompare(a.name)
            }

            if (sortByDate === "newest") {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            } else if (sortByDate === "oldest") {
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            }

            return 0
        })
    }

    // Filter categories based on search and tab
    const filteredCategories = categories.filter((category) => {
        const matchesSearch =
            category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            category.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            category.createdBy.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesTab = category.status === activeTab

        return matchesSearch && matchesTab
    })

    // Apply sorting to filtered categories
    const sortedCategories = sortCategories(filteredCategories, sortBy, sortByDate)

    const resetFilters = () => {
        setSearchTerm("")
    }

    // Pagination logic
    const totalPages = Math.ceil(sortedCategories.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentCategories = sortedCategories.slice(startIndex, endIndex)

    const handlePageChange = (page: number) => {
        setCurrentPage(page)
    }

    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(Number.parseInt(value))
        setCurrentPage(1)
    }

    const handleDelete = async () => {
        if (!categoryToDelete) return
        try {
            // Simulate API call
            setCategories(categories.filter((category) => category.id !== categoryToDelete.id))
            setCategoryToDelete(null)
        } catch (error) {
            console.error("Error deleting category:", error)
        }
    }

    const handleApprove = async (categoryId: number) => {
        try {
            // Simulate API call
            setCategories(
                categories.map((category) =>
                    category.id === categoryId ? { ...category, status: "approved" as const } : category,
                ),
            )
        } catch (error) {
            console.error("Error approving category:", error)
        }
    }

    const getStatusBadge = (status: string) => {
        return (
            <Badge
                variant={status === "approved" ? "default" : "secondary"}
                className={status === "approved" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}
            >
                {status}
            </Badge>
        )
    }

    const getColorBadge = (color: string) => {
        const colorClass = colorOptions.find((c) => c.value === color)?.class || "bg-gray-500"
        return <div className={`w-4 h-4 rounded-full ${colorClass}`} />
    }

    // Get counts for tabs
    const approvedCount = categories.filter((cat) => cat.status === "approved").length
    const pendingCount = categories.filter((cat) => cat.status === "pending").length

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
                    <div>
                        <h1 className="text-[28px] md:text-3xl font-bold">Task Category Management</h1>
                        <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
                            Manage and organize your task categories
                        </p>
                    </div>
                    <Link href="/task-category/create" className="flex justify-end">
                        <Button className="mt-[20px] md:mt-none bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300">
                            <Plus className="h-4 w-4" />
                            Create Category
                        </Button>
                    </Link>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Filter className="h-5 w-5" />
                            Filters & Search
                        </CardTitle>
                        <CardDescription>Filter and search through your task categories</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {loading ? (
                            <>
                                <div className="h-[200px] w-full bg-gray-200 rounded-2xl mb-4"></div>
                                <div className="flex justify-between gap-4">
                                    <div className="h-5 w-1/2 bg-gray-200 rounded-xl mb-3"></div>
                                    <div className="h-5 w-1/2 bg-gray-200 rounded-xl mb-3"></div>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Search */}
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <Label htmlFor="search">Search Categories</Label>
                                        <div className="relative my-1">
                                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="search"
                                                placeholder="Search by name, description, or creator..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="pl-10"
                                            />
                                        </div>
                                    </div>
                                </div>
                                {/* Results Summary */}
                                <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                                    <Button
                                        className="cursor-pointer hover:text-white text-white bg-[#f42b03] hover:bg-[#f42b03] rounded-lg px-4 py-2 shadow-none hover:shadow-lg transition-shadow duration-300"
                                        variant="outline"
                                        onClick={resetFilters}
                                    >
                                        Clear
                                    </Button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Categories Table with Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="approved" className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Approved Categories ({approvedCount})
                    </TabsTrigger>
                    <TabsTrigger value="pending" className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Pending Categories ({pendingCount})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="approved">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <CheckCircle className="h-5 w-5" />
                                    Approved Categories ({sortedCategories.length})
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
                                                    <TableHead>Category</TableHead>
                                                    <TableHead>Description</TableHead>
                                                    <TableHead>Tasks</TableHead>
                                                    <TableHead>Created By</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {currentCategories.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                            No approved categories found matching your criteria.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    currentCategories.map((category) => (
                                                        <TableRow key={category.id}>
                                                            <TableCell>
                                                                <div className="flex items-center space-x-3">
                                                                    <Avatar className="h-10 w-10">
                                                                        <AvatarImage src={category.photo || ""} />
                                                                        <AvatarFallback>
                                                                            {category.name
                                                                                .toUpperCase()
                                                                                .split(" ")
                                                                                .map((n) => n[0])
                                                                                .join("")}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <div>
                                                                        <div className="font-medium">
                                                                            {category.name.charAt(0).toUpperCase() + category.name.slice(1)}
                                                                        </div>
                                                                        <div className="text-sm text-muted-foreground">
                                                                            Created: {new Date(category.createdAt).toLocaleDateString()}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="max-w-xs">
                                                                    <p className="text-sm truncate" title={category.description}>
                                                                        {category.description}
                                                                    </p>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline">{category.taskCount} tasks</Badge>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="text-sm">{category.createdBy}</div>
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
                                                                            <Link href={`/task-category/${category.id}`}>
                                                                                <Eye className="mr-2 h-4 w-4" />
                                                                                View Details
                                                                            </Link>
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem asChild>
                                                                            <Link href={`/task-category/${category.id}/edit`}>
                                                                                <Edit className="mr-2 h-4 w-4" />
                                                                                Edit Category
                                                                            </Link>
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem
                                                                            className="text-destructive"
                                                                            onClick={() => setCategoryToDelete(category)}
                                                                        >
                                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                                            Delete Category
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
                            </>
                        )}
                    </Card>
                </TabsContent>

                <TabsContent value="pending">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5" />
                                    Pending Categories ({sortedCategories.length})
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
                                                    <TableHead>Category</TableHead>
                                                    <TableHead>Description</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Created By</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {currentCategories.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                            No pending categories found matching your criteria.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    currentCategories.map((category) => (
                                                        <TableRow key={category.id}>
                                                            <TableCell>
                                                                <div className="flex items-center space-x-3">
                                                                    <Avatar className="h-10 w-10">
                                                                        <AvatarImage src={category.photo || ""} />
                                                                        <AvatarFallback>
                                                                            {category.name
                                                                                .toUpperCase()
                                                                                .split(" ")
                                                                                .map((n) => n[0])
                                                                                .join("")}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <div>
                                                                        <div className="font-medium">
                                                                            {category.name.charAt(0).toUpperCase() + category.name.slice(1)}
                                                                        </div>
                                                                        <div className="text-sm text-muted-foreground">
                                                                            Created: {new Date(category.createdAt).toLocaleDateString()}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="max-w-xs">
                                                                    <p className="text-sm truncate" title={category.description}>
                                                                        {category.description}
                                                                    </p>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>{getStatusBadge(category.status)}</TableCell>
                                                            <TableCell>
                                                                <div className="text-sm">{category.createdBy}</div>
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
                                                                        <Link href={'/task_category/approve/1'}>
                                                                            <DropdownMenuItem onClick={() => handleApprove(category.id)}>
                                                                                <CheckCircle className="mr-2 h-4 w-4" />
                                                                                Approve/Reject Category
                                                                            </DropdownMenuItem>
                                                                        </Link>
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
                            </>
                        )}
                    </Card>
                </TabsContent>
            </Tabs>

            <AlertDialog open={!!categoryToDelete} onOpenChange={() => setCategoryToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the task category and may affect existing tasks
                            assigned to this category.
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
