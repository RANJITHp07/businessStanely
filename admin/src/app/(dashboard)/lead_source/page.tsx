"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, MoreHorizontal, BookmarkPlus, ArrowUpDown, RefreshCcw } from "lucide-react"
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
import {
    Plus,
    Search,
    Filter,
    Edit,
    Trash2,
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
import { toast } from "react-toastify"
import { useTablePage } from "@/hooks/useTablePage"

export interface LeadSource {
    id: number
    name: string
    description?: string
    createdAt: string
    usageCount?: number
}

export default function LeadSourcesTable() {
    const router = useRouter()
    const [leadSources, setLeadSources] = useState<LeadSource[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [sortBy, setSortBy] = useState("a-z")
    const [sortByDate, setSortByDate] = useState("newest")
    const { currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, clampToTotalPages } =
        useTablePage("admin-dashboard-lead_source-page")
    const [sourceToDelete, setSourceToDelete] = useState<LeadSource | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshKey, setRefreshKey] = useState(0)

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                refreshData()
            }
        }

        document.addEventListener("visibilitychange", handleVisibilityChange)
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange)
        }
    }, [])

    useEffect(() => {
        const fetchLeadSources = async () => {
            try {
                setLoading(true)
                const response = await fetch("/api/lead_source", {
                    cache: "no-store",
                    credentials: "include",
                    headers: {
                        "Cache-Control": "no-cache",
                        Pragma: "no-cache",
                    },
                })

                if (!response.ok) {
                    throw new Error(`Failed to fetch lead sources: ${response.status}`)
                }

                const data = await response.json()
                setLeadSources(data)
            } catch (error) {
                console.error("Error fetching lead sources:", error)
                setLeadSources([])
            } finally {
                setLoading(false)
            }
        }
        fetchLeadSources()
    }, [refreshKey, router])

    const sortLeadSources = (sources: LeadSource[], sortBy: string, sortByDate: string) => {
        const sorted = [...sources].sort((a, b) => {
            if (sortBy === "a-z") {
                const nameComparison = a.name.localeCompare(b.name)
                if (nameComparison !== 0) return nameComparison
                if (sortByDate === "newest") {
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                } else if (sortByDate === "oldest") {
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                }
            } else if (sortBy === "z-a") {
                const nameComparison = b.name.localeCompare(a.name)
                if (nameComparison !== 0) return nameComparison
                if (sortByDate === "newest") {
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                } else if (sortByDate === "oldest") {
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                }
            }

            if (sortByDate === "newest") {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            } else if (sortByDate === "oldest") {
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            }

            return 0
        })

        return sorted
    }

    const filteredLeadSources = leadSources.filter((source) => {
        const matchesSearch =
            source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (source.description && source.description.toLowerCase().includes(searchTerm.toLowerCase()))

        return matchesSearch
    })

    const sortedLeadSources = sortLeadSources(filteredLeadSources, sortBy, sortByDate)

    const resetFilters = () => {
        setSearchTerm("")
    }

    const totalPages = Math.ceil(sortedLeadSources.length / itemsPerPage)

    useEffect(() => {
        clampToTotalPages(totalPages)
    }, [totalPages, clampToTotalPages])
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentLeadSources = sortedLeadSources.slice(startIndex, endIndex)

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
            const response = await fetch("/api/lead_source", {
                cache: "no-store",
                credentials: "include",
                headers: {
                    "Cache-Control": "no-cache",
                    Pragma: "no-cache",
                },
            })

            if (!response.ok) {
                throw new Error(`Failed to fetch lead sources: ${response.status}`)
            }

            const data = await response.json()
            setLeadSources(data)
        } catch (error) {
            console.error("Error refreshing lead sources:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!sourceToDelete) return
        try {
            const response = await fetch(`/api/lead_source/${sourceToDelete.id}`, {
                method: "DELETE",
                credentials: "include",
            })

            if (!response.ok) {
                throw new Error("Failed to delete lead source")
            }

            setRefreshKey((prev) => prev + 1)
            setSourceToDelete(null)
            toast.success("Deleted successfully")
        } catch (error) {
            console.error("Error deleting lead source:", error)
            toast.error("Failed to delete lead source")
        }
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
                    <div>
                        <h1 className="text-[28px] md:text-3xl font-bold">Lead Source Management</h1>
                        <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
                            Manage and organize your lead sources
                        </p>
                    </div>
                    <Link href="/lead_source/create" className="flex justify-end">
                        <Button className="mt-[20px] md:mt-none bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300">
                            <Plus className="h-4 w-4" />
                            Create Lead Source
                        </Button>
                    </Link>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Filter className="h-5 w-5" />
                            Filters & Search
                        </CardTitle>
                        <CardDescription>Filter and search through your lead sources</CardDescription>
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
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <Label htmlFor="search">Search Lead Sources</Label>
                                        <div className="relative my-1">
                                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="search"
                                                placeholder="Search by name or description..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="pl-10"
                                            />
                                        </div>
                                    </div>
                                </div>
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

            <Card>
                <CardHeader>
                    <div className="lg:flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <BookmarkPlus className="h-5 w-5" />
                            Lead Sources ({sortedLeadSources.length})
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead>Created Date</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentLeadSources.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center h-32">
                                                    No lead sources found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            currentLeadSources.map((source) => (
                                                <TableRow key={source.id}>
                                                    <TableCell className="font-medium">{source.name}</TableCell>
                                                    <TableCell className="max-w-md truncate">{source.description || "N/A"}</TableCell>
                                                    <TableCell>
                                                        {new Date(source.createdAt).toLocaleDateString("en-US", {
                                                            year: "numeric",
                                                            month: "short",
                                                            day: "numeric",
                                                        })}
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
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onClick={() => router.push(`/lead_source/${source.id}/edit`)}>
                                                                    <Edit className="mr-2 h-4 w-4" />
                                                                    Edit
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => setSourceToDelete(source)} className="text-red-600">
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Delete
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
                                <div className="flex items-center justify-between px-2 py-4">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm text-muted-foreground">Rows per page</p>
                                        <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                                            <SelectTrigger className="w-[70px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="10">10</SelectItem>
                                                <SelectItem value="20">20</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                                <SelectItem value="100">100</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm text-muted-foreground">
                                            Page {currentPage} of {totalPages}
                                        </p>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => handlePageChange(1)}
                                                disabled={currentPage === 1}
                                            >
                                                <ChevronsLeft className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => handlePageChange(currentPage - 1)}
                                                disabled={currentPage === 1}
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => handlePageChange(currentPage + 1)}
                                                disabled={currentPage === totalPages}
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => handlePageChange(totalPages)}
                                                disabled={currentPage === totalPages}
                                            >
                                                <ChevronsRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={!!sourceToDelete} onOpenChange={() => setSourceToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the lead source "{sourceToDelete?.name}". This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
