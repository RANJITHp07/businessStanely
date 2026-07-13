"use client"

import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useState, useEffect } from "react"
import Link from "next/link"
import { toast } from "react-toastify"
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    CheckCircle,
    Clock,
    Edit,
    Eye,
    Filter,
    Loader2,
    MoreHorizontal,
    Plus,
    Search,
    Trash2
} from "lucide-react"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog"
import {
    Avatar, AvatarFallback, AvatarImage
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter } from "next/navigation"

import { TaskCategory } from "@/types";
import { useTablePage } from "@/hooks/useTablePage"

// We'll use the API data instead of mock data

export default function TaskCategoryTable() {
    const [categories, setCategories] = useState<TaskCategory[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    // Removed unused sortBy and sortByDate state
    const { currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, clampToTotalPages } =
        useTablePage("agent-dashboard-task_category-page")
    const [categoryToDelete, setCategoryToDelete] = useState<TaskCategory | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("approved")
    const [currentUserRole, setCurrentUserRole] = useState<string>("")

    const router = useRouter()

    // Get the current user's role from localStorage
    useEffect(() => {
        const userStr = localStorage.getItem("user")
        if (userStr) {
            try {
                const user = JSON.parse(userStr)
                const userRole = user.adminType || ""
                setCurrentUserRole(userRole)

                // No longer restrict pending tab for non-owners
                // We'll use the isOwner flag for controlling actions instead
            } catch (error) {
                console.error("Error parsing user data:", error)
            }
        }
    }, [activeTab])

    // State to store all categories for counting
    const [allCategories, setAllCategories] = useState<TaskCategory[]>([]);

    // Fetch all categories for counting tabs
    useEffect(() => {
        const fetchAllCategories = async () => {
            try {
                const response = await fetchWithAuth(`/api/task-categories`);

                if (!response.ok) {
                    throw new Error('Failed to fetch all services');
                }

                const data = await response.json();
                setAllCategories(data);
            } catch (error) {
                console.error("Error fetching all services:", error);
                setAllCategories([]);
            }
        };
        fetchAllCategories();
    }, []);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                setLoading(true);
                // Fetch categories from API based on active tab
                const status = activeTab === 'approved' ? 'approved' : 'pending';
                const response = await fetchWithAuth(`/api/task-categories?status=${status}`);

                if (!response.ok) {
                    throw new Error('Failed to fetch categories');
                }

                const data = await response.json();
                setCategories(data);
            } catch (error) {
                console.error("Error fetching categories:", error);
                // Show empty state instead of mock data
                setCategories([]);
                if (error instanceof Error) {
                    toast.error(error.message);
                }
            } finally {
                setLoading(false);
            }
        };
        fetchCategories();
    }, [activeTab])

    // Sort function (default: a-z, newest)
    const sortCategories = (categories: TaskCategory[]) => {
        return [...categories].sort((a, b) => {
            // Default: sort by name a-z
            const nameCompare = a.name.localeCompare(b.name);
            if (nameCompare !== 0) return nameCompare;
            // Then by createdAt, newest first
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }

    // Filter categories based on search and tab
    const filteredCategories = categories.filter((category) => {
        const matchesSearch =
            category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (category.description?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
            (category.createdBy?.toLowerCase() || "").includes(searchTerm.toLowerCase());

        const matchesTab = category.status === activeTab;

        return matchesSearch && matchesTab;
    });

    // Apply sorting to filtered categories
    const sortedCategories = filteredCategories

    const resetFilters = () => {
        setSearchTerm("")
    }

    // Pagination logic
    const totalPages = Math.ceil(sortedCategories.length / itemsPerPage)

    useEffect(() => {
        clampToTotalPages(totalPages)
    }, [totalPages, clampToTotalPages])
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
            // Call API to delete category
            const response = await fetchWithAuth(`/api/task-categories/${categoryToDelete.id}`, {
                method: 'DELETE',
            })

            if (!response.ok) {
                throw new Error('Failed to delete category')
            }

            // Update both category lists in the UI
            setCategories(categories.filter((category) => category.id !== categoryToDelete.id))
            setAllCategories(allCategories.filter((category) => category.id !== categoryToDelete.id))
            setCategoryToDelete(null)
            toast.success("Category deleted successfully")
        } catch (error) {
            console.error("Error deleting category:", error)
            const errorMessage = error instanceof Error ? error.message : "Failed to delete category"
            toast.error(errorMessage)
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

    // Get counts for tabs from allCategories to always show correct counts
    const approvedCount = allCategories.filter((cat) => cat.status === "approved").length
    const pendingCount = allCategories.filter((cat) => cat.status === "pending").length

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
                    <div>
                        <h1 className="text-[28px] md:text-3xl font-bold">Service Management</h1>
                        <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
                            Manage and organize your services
                        </p>
                    </div>
                    <Link href="/task_category/create" className="flex justify-end">
                        <Button className="mt-[20px] md:mt-none bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300">
                            <Plus className="h-4 w-4" />
                            Create Service
                        </Button>
                    </Link>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Filter className="h-5 w-5" />
                            Filters & Search
                        </CardTitle>
                        <CardDescription>Filter and search through your services</CardDescription>
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
                                        <Label htmlFor="search">Search Services</Label>
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
                        Approved Services ({approvedCount})
                    </TabsTrigger>
                    <TabsTrigger value="pending" className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Pending Services ({pendingCount})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="approved">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <CheckCircle className="h-5 w-5" />
                                    Approved Services ({sortedCategories.length})
                                </CardTitle>
                                {/* <div className="flex items-center gap-2">
                                    <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                                    <Select value={sortBy} onValueChange={setSortBy}>
                                        <SelectTrigger className="md:w-32">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="a-z">A-Z</SelectItem>
                                            <SelectItem value="z-a">Z-A</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select value={sortByDate} onValueChange={setSortByDate}>
                                        <SelectTrigger className="md:w-32">
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
                                                    <TableHead>Service</TableHead>
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
                                                        <TableRow key={category.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/task_category/${category.id}`)}>
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
  {category.name.length > 35 
    ? category.name.charAt(0).toUpperCase() + category.name.slice(1, 35) + '...'
    : category.name.charAt(0).toUpperCase() + category.name.slice(1)
  }
</div>
                                                                        <div className="text-sm text-muted-foreground">
                                                                            Created: {new Date(category.createdAt).toLocaleDateString()}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="max-w-xs">
                                                                    <p className="text-sm truncate" title={category.description || ""}>
                                                                        {category.description || ""}
                                                                    </p>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline">{category.taskCount} tasks</Badge>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="text-sm">
                                                                    {category.createdBy || "Unknown"}
                                                                    {category.createdByType === "agent" && (
                                                                        <span className="ml-1 text-xs text-blue-600">(Agent)</span>
                                                                    )}
                                                                    {category.createdByType === "user" && category.createdByRole === "owner" && (
                                                                        <span className="ml-1 text-xs text-purple-600">(Owner)</span>
                                                                    )}
                                                                    {category.createdByType === "user" && category.createdByRole === "admin" && (
                                                                        <span className="ml-1 text-xs text-green-600">(Admin)</span>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                                                                            <span className="sr-only">Open menu</span>
                                                                            <MoreHorizontal className="h-4 w-4" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end">
                                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                        <DropdownMenuItem asChild>
                                                                            <Link href={`/task_category/${category.id}`} onClick={(e) => e.stopPropagation()}>
                                                                                <Eye className="mr-2 h-4 w-4" />
                                                                                View Details
                                                                            </Link>
                                                                        </DropdownMenuItem>
                                                                        {currentUserRole === "owner" && (
                                                                            <>
                                                                                <DropdownMenuItem asChild>
                                                                                    <Link href={`/task_category/${category.id}/edit`} onClick={(e) => e.stopPropagation()}>
                                                                                        <Edit className="mr-2 h-4 w-4" />
                                                                                        Edit Service
                                                                                    </Link>
                                                                                </DropdownMenuItem>
                                                                                <DropdownMenuSeparator />
                                                                                <DropdownMenuItem
                                                                                    className="text-destructive"
                                                                                    onClick={(e) => { e.stopPropagation(); setCategoryToDelete(category); }}
                                                                                >
                                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                                    Delete Service
                                                                                </DropdownMenuItem>
                                                                            </>
                                                                        )}
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
                                                    <TableHead>Service</TableHead>
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
                                                        <TableRow key={category.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/task_category/${category.id}`)}>
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
                                                                <div className="text-sm">
                                                                    {category.createdBy || "Unknown"}
                                                                    {category.createdByType === "agent" && (
                                                                        <span className="ml-1 text-xs text-blue-600">(Agent)</span>
                                                                    )}
                                                                    {category.createdByType === "user" && category.createdByRole === "owner" && (
                                                                        <span className="ml-1 text-xs text-purple-600">(Owner)</span>
                                                                    )}
                                                                    {category.createdByType === "user" && category.createdByRole === "admin" && (
                                                                        <span className="ml-1 text-xs text-green-600">(Admin)</span>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                                                                            <span className="sr-only">Open menu</span>
                                                                            <MoreHorizontal className="h-4 w-4" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end">
                                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                        <DropdownMenuItem asChild>
                                                                            <Link href={`/task_category/${category.id}`} onClick={(e) => e.stopPropagation()}>
                                                                                <Eye className="mr-2 h-4 w-4" />
                                                                                View Details
                                                                            </Link>
                                                                        </DropdownMenuItem>
                                                                        {currentUserRole === "owner" && (
                                                                            <DropdownMenuItem asChild>
                                                                                <Link href={`/task_category/approve/${category.id}`} onClick={(e) => e.stopPropagation()}>
                                                                                    <CheckCircle className="mr-2 h-4 w-4" />
                                                                                    Approve/Reject Service
                                                                                </Link>
                                                                            </DropdownMenuItem>
                                                                        )}
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
                            This action cannot be undone. This will permanently delete the service and may affect existing tasks
                            Ownership to this category.
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
