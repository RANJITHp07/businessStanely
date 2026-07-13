"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, MoreHorizontal, Shield, ArrowUpDown, RefreshCcw } from "lucide-react"
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
    Plus,
    Search,
    Filter,
    Edit,
    Trash2,
    Eye,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
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
import { useTablePage } from "@/hooks/useTablePage"

const adminRoles = ["All Roles", "owner", "admin"]

export interface Admin {
    id: number
    name: string // This will be username if no name is set
    email: string
    role: string
    status: "active" | "inactive"
    createdAt: string
    photo?: string
    lastLogin?: string
    permissions?: string[] // Make permissions optional since API might not return it
}



export default function AdminsTable() {
    const router = useRouter()
    const [admins, setAdmins] = useState<Admin[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedRole, setSelectedRole] = useState("All Roles")
    const [selectedStatus, setSelectedStatus] = useState("All Status")
    const [sortBy, setSortBy] = useState("a-z")
    const [sortByDate, setSortByDate] = useState("newest")
    const { currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, clampToTotalPages } =
        useTablePage("admin-dashboard-admin-_component-adminTable")
    const [adminToDelete, setAdminToDelete] = useState<Admin | null>(null)
    const [loading, setLoading] = useState(true)
    const [currentUserRole, setCurrentUserRole] = useState<string>("")
    const [refreshKey, setRefreshKey] = useState(0) // Add refresh key

    // Get the current user's role from localStorage
    useEffect(() => {
        const userStr = localStorage.getItem("user")
        if (userStr) {
            try {
                const user = JSON.parse(userStr)
                console.log(user)
                setCurrentUserRole(user.adminType || "")
            } catch (error) {
                console.error("Error parsing user data:", error)
            }
        }
    }, [])

    // Refresh data when component becomes visible
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refreshData();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    useEffect(() => {
        const fetchAdmins = async () => {
            try {
                setLoading(true)

                // Check if user is logged in
                const userStr = localStorage.getItem("user")
                if (!userStr) {
                    console.error("No user found in localStorage")
                    router.push('/login')
                    return
                }

                // Log user data for debugging
                console.log("User from localStorage:", JSON.parse(userStr))

                // Check if auth token cookie exists
                const authToken = document.cookie
                    .split('; ')
                    .find(row => row.startsWith('auth-token='))
                console.log("Auth token cookie found:", !!authToken)

                // Fetch all admins with no-store cache option and force revalidation
                const response = await fetch('/api/admins', {
                    cache: 'no-store',
                    credentials: 'include', // Include cookies for authentication
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                })

                console.log("API Response status:", response.status)

                if (!response.ok) {
                    if (response.status === 401) {
                        console.error("Unauthorized - checking auth token...")
                        console.error("All cookies:", document.cookie)
                        router.push('/login')
                        return
                    }
                    const errorData = await response.text()
                    console.error("API Error:", response.status, errorData)
                    throw new Error(`Failed to fetch admins: ${response.status}`)
                }

                const data = await response.json()
                setAdmins(data)
            } catch (error) {
                console.error("Error fetching admins:", error)
                // Use empty array as fallback if API call fails
                setAdmins([])
            } finally {
                setLoading(false)
            }
        }
        fetchAdmins()
    }, [refreshKey, router]) // Add router to dependencies

    // Sort function
    const sortAdmins = (admins: Admin[], sortBy: string, sortByDate: string) => {
        const sorted = [...admins].sort((a, b) => {
            // Primary sorting based on what user selected most recently
            // If user wants alphabetical sorting
            if (sortBy === "a-z") {
                const nameComparison = a.name.localeCompare(b.name)
                if (nameComparison !== 0) return nameComparison
                // If names are the same, use date as secondary
                if (sortByDate === "newest") {
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                } else if (sortByDate === "oldest") {
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                }
            } else if (sortBy === "z-a") {
                const nameComparison = b.name.localeCompare(a.name)
                if (nameComparison !== 0) return nameComparison
                // If names are the same, use date as secondary
                if (sortByDate === "newest") {
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                } else if (sortByDate === "oldest") {
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                }
            }

            // If no alphabetical sorting specified, use date as primary
            if (sortByDate === "newest") {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            } else if (sortByDate === "oldest") {
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            }

            return 0
        })

        // Debug logging to verify sorting
        console.log(`Sorting by: ${sortBy} (alphabetical), ${sortByDate} (date)`)
        console.log('Sorted admins:', sorted.map(admin => ({
            name: admin.name,
            role: admin.role,
            createdAt: admin.createdAt,
            createdDate: new Date(admin.createdAt).toLocaleDateString()
        })))

        return sorted
    }

    // Filter admins based on search and filters
    const filteredAdmins = admins.filter((admin) => {
        const matchesSearch =
            admin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            admin.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (admin.permissions && admin.permissions.join(", ").toLowerCase().includes(searchTerm.toLowerCase()))

        const matchesRole = selectedRole === "All Roles" || admin.role.toLowerCase() === selectedRole.toLowerCase()
        const matchesStatus = selectedStatus === "All Status" || admin.status === selectedStatus

        return matchesSearch && matchesRole && matchesStatus
    })

    // Apply sorting to filtered admins
    const sortedAdmins = sortAdmins(filteredAdmins, sortBy, sortByDate)

    const resetFilters = () => {
        setSearchTerm("")
        setSelectedRole("All Roles")
        setSelectedStatus("All Status")
    }

    // Pagination logic
    const totalPages = Math.ceil(sortedAdmins.length / itemsPerPage)

    useEffect(() => {
        clampToTotalPages(totalPages)
    }, [totalPages, clampToTotalPages])
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentAdmins = sortedAdmins.slice(startIndex, endIndex)

    const handlePageChange = (page: number) => {
        setCurrentPage(page)
    }

    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(Number.parseInt(value))
        setCurrentPage(1)
    }

    const refreshData = async () => {
        setLoading(true)
        try {
            // Check if user is logged in
            const userStr = localStorage.getItem("user")
            if (!userStr) {
                console.error("No user found in localStorage")
                router.push('/login')
                return
            }

            const response = await fetch('/api/admins', {
                cache: 'no-store',
                credentials: 'include', // Include cookies for authentication
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            })

            if (!response.ok) {
                if (response.status === 401) {
                    console.error("Unauthorized - redirecting to login")
                    router.push('/login')
                    return
                }
                const errorData = await response.text()
                console.error("API Error:", response.status, errorData)
                throw new Error(`Failed to fetch admins: ${response.status}`)
            }

            const data = await response.json()
            setAdmins(data)
        } catch (error) {
            console.error("Error refreshing admins:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!adminToDelete) return
        try {
            // Call the API to delete the admin
            const response = await fetch(`/api/admins/${adminToDelete.id}`, {
                method: 'DELETE',
                credentials: 'include', // Include cookies for authentication
            })

            if (!response.ok) {
                throw new Error('Failed to delete admin')
            }

            // Refresh the admin list
            setRefreshKey(prev => prev + 1)
            setAdminToDelete(null)
        } catch (error) {
            console.error("Error deleting admin:", error)
        }
    }

    const getAdminRoleBadge = (role: string) => {
        const colors = {
            "owner": "bg-purple-100 text-purple-800",
            "admin": "bg-blue-100 text-blue-800",
            "Owner": "bg-purple-100 text-purple-800", // Fallback for capitalized
            "Admin": "bg-blue-100 text-blue-800", // Fallback for capitalized
        }
        return <Badge className={colors[role as keyof typeof colors] || "bg-gray-100 text-gray-800"}>
            {role.charAt(0).toUpperCase() + role.slice(1)}
        </Badge>
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
                    <div>
                        <h1 className="text-[28px] md:text-3xl font-bold">Admin Management</h1>
                        <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
                            Manage and organize your admin team members
                        </p>
                    </div>
                    {currentUserRole === "owner" && (
                        <Link href="/admin/create" className="flex justify-end">
                            <Button className="mt-[20px] md:mt-none bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300">
                                <Plus className="h-4 w-4" />
                                Create Admin
                            </Button>
                        </Link>
                    )}
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Filter className="h-5 w-5" />
                            Filters & Search
                        </CardTitle>
                        <CardDescription>Filter and search through your admins</CardDescription>
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
                                        <Label htmlFor="search">Search Admins</Label>
                                        <div className="relative my-1">
                                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="search"
                                                placeholder="Search by name, email, username, or permissions..."
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
                                        <Label>Admin Role</Label>
                                        <Select value={selectedRole} onValueChange={setSelectedRole}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {adminRoles.map((role) => (
                                                    <SelectItem key={role} value={role}>
                                                        {role}
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
                                                <SelectItem value="All Status">All Status</SelectItem>
                                                <SelectItem value="active">Active</SelectItem>
                                                <SelectItem value="inactive">Inactive</SelectItem>
                                            </SelectContent>
                                        </Select>
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

            {/* Admins Table */}
            <Card>
                <CardHeader>
                    <div className="lg:flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            Admins ({sortedAdmins.length})
                        </CardTitle>
                        {/* <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    refreshData();
                                    router.refresh();
                                }}
                                className="gap-2"
                            >
                                <RefreshCcw className="h-4 w-4" />
                                Refresh
                            </Button>
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
                            <Select value={selectedRole} onValueChange={setSelectedRole}>
                                <SelectTrigger className="w-38">
                                    <SelectValue className="text-black" placeholder="Role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="All Roles">All Roles</SelectItem>
                                    <SelectItem value="owner">Owner</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
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
                                            <TableHead>Admin</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentAdmins.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                    No admins found matching your criteria.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            currentAdmins.map((admin) => (
                                                <TableRow key={admin.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/admin/${admin.id}`)}>
                                                    <TableCell>
                                                        <div className="flex items-center space-x-3">
                                                            <Avatar className="h-10 w-10">
                                                                <AvatarImage src={admin.photo || ""} />
                                                                <AvatarFallback>
                                                                    {admin.name
                                                                        .toUpperCase()
                                                                        .split(" ")
                                                                        .map((n) => n[0])
                                                                        .join("")}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <div className="font-medium">
                                                                    {admin.name.charAt(0).toUpperCase() + admin.name.slice(1)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{getAdminRoleBadge(admin.role)}</TableCell>
                                                    <TableCell>
                                                        <div className="text-sm text-muted-foreground">{admin.email}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={admin.status === "active" ? "default" : "secondary"}>
                                                            {admin.status.charAt(0).toUpperCase() + admin.status.slice(1)}
                                                        </Badge>
                                                    </TableCell>

                                                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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
                                                                    <Link href={`/admin/${admin.id}`}>
                                                                        <Eye className="mr-2 h-4 w-4" />
                                                                        View Details
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                                {currentUserRole === "owner" && (
                                                                    <DropdownMenuItem asChild>
                                                                        <Link href={`/admin/${admin.id}/edit`}>
                                                                            <Edit className="mr-2 h-4 w-4" />
                                                                            Edit Admin
                                                                        </Link>
                                                                    </DropdownMenuItem>
                                                                )}
                                                                {currentUserRole === "owner" && (
                                                                    <>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem className="text-destructive" onClick={() => setAdminToDelete(admin)}>
                                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                                            Delete Admin
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

            <AlertDialog open={!!adminToDelete} onOpenChange={() => setAdminToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the admin and remove their data from our
                            servers.
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
