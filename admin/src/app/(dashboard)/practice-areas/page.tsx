"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "react-toastify"
import {
    ArrowDown,
    ArrowUp,
    Briefcase,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Download,
    Edit,
    Eye,
    Filter,
    Loader2,
    MoreHorizontal,
    Plus,
    Search,
    Trash2,
} from "lucide-react"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import { DEFAULT_PRACTICE_AREAS } from "@/lib/practiceAreaParameters"
import { useTablePage } from "@/hooks/useTablePage"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import PracticeAreaIcon from "./_components/PracticeAreaIcon"

export interface PracticeAreaRow {
    id: string
    title: string
    description?: string | null
    icon: string
    active: boolean
    sortOrder: number
    createdAt: string
    parameterCount: number
    requiredCount: number
    enquiryCount: number
}

type StatusFilter = "all" | "shown" | "hidden"
type ParameterFilter = "all" | "with" | "required" | "none"
type SortKey = "order" | "a-z" | "z-a" | "newest" | "oldest"

export default function PracticeAreasTable() {
    const router = useRouter()
    const [areas, setAreas] = useState<PracticeAreaRow[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
    const [parameterFilter, setParameterFilter] = useState<ParameterFilter>("all")
    const [sortBy, setSortBy] = useState<SortKey>("order")
    const { currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, clampToTotalPages } =
        useTablePage("admin-practice-areas-page")
    const [areaToDelete, setAreaToDelete] = useState<PracticeAreaRow | null>(null)
    const [isOwner, setIsOwner] = useState(false)
    const [reordering, setReordering] = useState(false)
    const [importing, setImporting] = useState(false)

    useEffect(() => {
        try {
            const user = JSON.parse(localStorage.getItem("user") || "{}")
            setIsOwner(user.adminType === "owner")
        } catch {
            setIsOwner(false)
        }
    }, [])

    const loadAreas = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetchWithAuth("/api/practice-areas", { cache: "no-store" })
            if (!res.ok) throw new Error(`Failed to fetch parameter areas: ${res.status}`)
            setAreas(await res.json())
        } catch (error) {
            console.error("Error fetching parameter areas:", error)
            toast.error("Failed to load parameter areas")
            setAreas([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadAreas()
    }, [loadAreas])

    const filtered = areas.filter((area) => {
        const term = searchTerm.trim().toLowerCase()
        if (
            term &&
            !area.title.toLowerCase().includes(term) &&
            !(area.description ?? "").toLowerCase().includes(term)
        ) {
            return false
        }
        if (statusFilter === "shown" && !area.active) return false
        if (statusFilter === "hidden" && area.active) return false
        if (parameterFilter === "with" && area.parameterCount === 0) return false
        if (parameterFilter === "required" && area.requiredCount === 0) return false
        if (parameterFilter === "none" && area.parameterCount > 0) return false
        return true
    })

    const sorted = [...filtered].sort((a, b) => {
        switch (sortBy) {
            case "a-z":
                return a.title.localeCompare(b.title)
            case "z-a":
                return b.title.localeCompare(a.title)
            case "newest":
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            case "oldest":
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            default:
                return a.sortOrder - b.sortOrder
        }
    })

    // Built-in website areas not in the list yet. Once any area exists the
    // website shows only this list, so these drop off the site until imported.
    const missingDefaults = DEFAULT_PRACTICE_AREAS.filter(
        (d) => !areas.some((a) => a.title.toLowerCase() === d.title.toLowerCase()),
    )

    // Position on the website, shown in the # column whatever the sort.
    // sortOrder can have gaps after a delete, so it is ranked rather than shown.
    const websitePosition = new Map(
        [...areas].sort((a, b) => a.sortOrder - b.sortOrder).map((area, i) => [area.id, i + 1]),
    )

    // Moving rows only makes sense on the full list in website order.
    const canReorder =
        sortBy === "order" && !searchTerm.trim() && statusFilter === "all" && parameterFilter === "all"

    const totalPages = Math.ceil(sorted.length / itemsPerPage)
    useEffect(() => {
        clampToTotalPages(totalPages)
    }, [totalPages, clampToTotalPages])
    const startIndex = (currentPage - 1) * itemsPerPage
    const pageRows = sorted.slice(startIndex, startIndex + itemsPerPage)

    const resetFilters = () => {
        setSearchTerm("")
        setStatusFilter("all")
        setParameterFilter("all")
        setSortBy("order")
        setCurrentPage(1)
    }

    const moveArea = async (index: number, direction: -1 | 1) => {
        const target = index + direction
        if (target < 0 || target >= sorted.length) return
        const next = [...sorted]
        ;[next[index], next[target]] = [next[target], next[index]]
        const previous = areas
        setAreas(next.map((area, i) => ({ ...area, sortOrder: i })))
        setReordering(true)
        try {
            const res = await fetchWithAuth("/api/practice-areas/reorder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderedIds: next.map((a) => a.id) }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || "Failed to reorder parameter areas")
            }
        } catch (error) {
            setAreas(previous)
            toast.error(error instanceof Error ? error.message : "Failed to reorder parameter areas")
            if (error instanceof Error && error.message.includes("Refresh")) loadAreas()
        } finally {
            setReordering(false)
        }
    }

    const handleImport = async () => {
        setImporting(true)
        try {
            const res = await fetchWithAuth("/api/practice-areas/import-defaults", { method: "POST" })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error(data.error || "Failed to import parameter areas")
                return
            }
            toast.success(`Imported ${data.imported} parameter areas`)
            await loadAreas()
        } catch {
            toast.error("Failed to import parameter areas")
        } finally {
            setImporting(false)
        }
    }

    const handleDelete = async () => {
        if (!areaToDelete) return
        try {
            const res = await fetchWithAuth(`/api/practice-areas/${areaToDelete.id}`, { method: "DELETE" })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error(data.error || "Failed to delete parameter area")
                return
            }
            toast.success("Practice area deleted")
            setAreaToDelete(null)
            await loadAreas()
        } catch {
            toast.error("Failed to delete parameter area")
        }
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
                    <div>
                        <h1 className="text-[28px] md:text-3xl font-bold">Parameter Areas</h1>
                        <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
                            Services offered on the website, and the details clients fill in for each
                        </p>
                    </div>
                    <Link href="/practice-areas/create" className="flex justify-end">
                        <Button className="mt-[20px] md:mt-none bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300">
                            <Plus className="h-4 w-4" />
                            Create Parameter Area
                        </Button>
                    </Link>
                </div>

                {!loading && missingDefaults.length > 0 && (
                    <Card className="mb-6 border-amber-200 bg-amber-50">
                        <CardContent className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4">
                            <div>
                                {areas.length === 0 ? (
                                    <>
                                        <p className="font-medium text-amber-900">
                                            The website is showing its built-in list of parameter areas
                                        </p>
                                        <p className="text-sm text-amber-800 mt-1">
                                            Import that list first so you can manage it here. Once any practice
                                            area exists, the website shows only the ones on this page.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="font-medium text-amber-900">
                                            {missingDefaults.length} of the website&apos;s built-in parameter areas are not
                                            on the website now
                                        </p>
                                        <p className="text-sm text-amber-800 mt-1">
                                            The website shows only the parameter areas on this page. Missing:{" "}
                                            {missingDefaults.map((d) => d.title).join(", ")}.
                                        </p>
                                    </>
                                )}
                            </div>
                            <Button onClick={handleImport} disabled={importing} className="shrink-0">
                                {importing ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Download className="mr-2 h-4 w-4" />
                                )}
                                {areas.length === 0 ? "Import Website List" : `Import ${missingDefaults.length} Missing`}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Filter className="h-5 w-5" />
                            Filters & Search
                        </CardTitle>
                        <CardDescription>Filter and search through parameter areas</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {loading ? (
                            <>
                                <div className="h-10 w-full bg-gray-200 rounded-xl mb-3"></div>
                                <div className="flex justify-between gap-4">
                                    <div className="h-10 w-1/3 bg-gray-200 rounded-xl"></div>
                                    <div className="h-10 w-1/3 bg-gray-200 rounded-xl"></div>
                                    <div className="h-10 w-1/3 bg-gray-200 rounded-xl"></div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <Label htmlFor="search">Search Parameter Areas</Label>
                                    <div className="relative my-1">
                                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="search"
                                            placeholder="Search by title or description..."
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value)
                                                setCurrentPage(1)
                                            }}
                                            className="pl-10"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <Label>Website Status</Label>
                                        <Select
                                            value={statusFilter}
                                            onValueChange={(v) => {
                                                setStatusFilter(v as StatusFilter)
                                                setCurrentPage(1)
                                            }}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All</SelectItem>
                                                <SelectItem value="shown">Shown on website</SelectItem>
                                                <SelectItem value="hidden">Hidden</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Parameters</Label>
                                        <Select
                                            value={parameterFilter}
                                            onValueChange={(v) => {
                                                setParameterFilter(v as ParameterFilter)
                                                setCurrentPage(1)
                                            }}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All</SelectItem>
                                                <SelectItem value="with">Has parameters</SelectItem>
                                                <SelectItem value="required">Has required parameters</SelectItem>
                                                <SelectItem value="none">No parameters</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label>Sort By</Label>
                                        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="order">Website order</SelectItem>
                                                <SelectItem value="a-z">Title A-Z</SelectItem>
                                                <SelectItem value="z-a">Title Z-A</SelectItem>
                                                <SelectItem value="newest">Newest first</SelectItem>
                                                <SelectItem value="oldest">Oldest first</SelectItem>
                                            </SelectContent>
                                        </Select>
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
                    <CardTitle className="flex items-center gap-2">
                        <Briefcase className="h-5 w-5" />
                        Parameter Areas ({sorted.length})
                    </CardTitle>
                    {!canReorder && sorted.length > 1 && (
                        <CardDescription>
                            Clear the filters and sort by website order to change the order.
                        </CardDescription>
                    )}
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
                                            <TableHead className="w-12">#</TableHead>
                                            <TableHead>Title</TableHead>
                                            <TableHead>Parameters</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Enquiries</TableHead>
                                            <TableHead>Created Date</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pageRows.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center h-32">
                                                    No parameter areas found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            pageRows.map((area, i) => {
                                                const index = startIndex + i
                                                return (
                                                    <TableRow
                                                        key={area.id}
                                                        className="cursor-pointer hover:bg-muted/50"
                                                        onClick={() => router.push(`/practice-areas/${area.id}`)}
                                                    >
                                                        <TableCell className="text-muted-foreground">
                                                            {websitePosition.get(area.id)}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-start gap-3">
                                                                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-700">
                                                                    <PracticeAreaIcon icon={area.icon} />
                                                                </span>
                                                                <div className="min-w-0">
                                                                    <div className="font-medium">{area.title}</div>
                                                                    {area.description && (
                                                                        <div className="text-xs text-muted-foreground max-w-md truncate">
                                                                            {area.description}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            {area.parameterCount === 0 ? (
                                                                <span className="text-muted-foreground">None</span>
                                                            ) : (
                                                                <span>
                                                                    {area.parameterCount}
                                                                    {area.requiredCount > 0 && (
                                                                        <span className="text-xs text-muted-foreground">
                                                                            {" "}
                                                                            ({area.requiredCount} required)
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {area.active ? (
                                                                <Badge className="bg-green-100 text-green-800 border-green-200 border">
                                                                    Shown
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="secondary">Hidden</Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>{area.enquiryCount}</TableCell>
                                                        <TableCell>
                                                            {new Date(area.createdAt).toLocaleDateString("en-US", {
                                                                year: "numeric",
                                                                month: "short",
                                                                day: "numeric",
                                                            })}
                                                        </TableCell>
                                                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                            <div className="flex items-center justify-end gap-1">
                                                                {canReorder && (
                                                                    <>
                                                                        <Button
                                                                            variant="ghost"
                                                                            className="h-8 w-8 p-0"
                                                                            disabled={reordering || index === 0}
                                                                            onClick={() => moveArea(index, -1)}
                                                                            aria-label="Move up"
                                                                        >
                                                                            <ArrowUp className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            className="h-8 w-8 p-0"
                                                                            disabled={reordering || index === sorted.length - 1}
                                                                            onClick={() => moveArea(index, 1)}
                                                                            aria-label="Move down"
                                                                        >
                                                                            <ArrowDown className="h-4 w-4" />
                                                                        </Button>
                                                                    </>
                                                                )}
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
                                                                        <DropdownMenuItem
                                                                            onClick={() => router.push(`/practice-areas/${area.id}`)}
                                                                        >
                                                                            <Eye className="mr-2 h-4 w-4" />
                                                                            View & Parameters
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem
                                                                            onClick={() => router.push(`/practice-areas/${area.id}/edit`)}
                                                                        >
                                                                            <Edit className="mr-2 h-4 w-4" />
                                                                            Edit
                                                                        </DropdownMenuItem>
                                                                        {isOwner && (
                                                                            <DropdownMenuItem
                                                                                onClick={() => setAreaToDelete(area)}
                                                                                className="text-red-600"
                                                                            >
                                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                                Delete
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {totalPages > 1 && (
                                <div className="flex items-center justify-between px-2 py-4">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm text-muted-foreground">Rows per page</p>
                                        <Select
                                            value={itemsPerPage.toString()}
                                            onValueChange={(v) => {
                                                setItemsPerPage(Number.parseInt(v))
                                                setCurrentPage(1)
                                            }}
                                        >
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
                                            <Button variant="outline" size="icon" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                                                <ChevronsLeft className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => setCurrentPage(currentPage - 1)}
                                                disabled={currentPage === 1}
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => setCurrentPage(currentPage + 1)}
                                                disabled={currentPage === totalPages}
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => setCurrentPage(totalPages)}
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

            <AlertDialog open={!!areaToDelete} onOpenChange={() => setAreaToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this parameter area?</AlertDialogTitle>
                        <AlertDialogDescription>
                            &quot;{areaToDelete?.title}&quot; and its parameters will be removed from the website.
                            {(areaToDelete?.enquiryCount ?? 0) > 0 &&
                                ` The ${areaToDelete?.enquiryCount} enquir${areaToDelete?.enquiryCount === 1 ? "y" : "ies"} that picked it keep their answers.`}
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
