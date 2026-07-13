"use client"
import { useState, useEffect } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    Loader2,
    Plus,
    MoreHorizontal,
    Edit,
    Trash2,
    Eye,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Calendar,
    Search,
    Filter,
    X,
    CalendarIcon,
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuCheckboxItem,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"


import type { Prospect } from "@/types"
import { toast } from "react-toastify"
import { cn } from "@/lib/utils"
import { useTablePage } from "@/hooks/useTablePage"

const statuses = ["New", "In Progress", "Career", "Relevant but not Now", "Not Relevant"]
const engagementStatuses = ["To Be Contacted", "Follow Up", "Missed Out"]

export default function ProspectsTable() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [prospects, setProspects] = useState<Prospect[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
    const [selectedEngagementStatus, setSelectedEngagementStatus] = useState<string[]>([])
    const { currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, clampToTotalPages } =
        useTablePage("admin-sales-dashboard-prospects-table-page")
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [sourceToDelete, setSourceToDelete] = useState<Prospect | null>(null)
    const [dateType, setDateType] = useState<string>("")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [selectedAssignedId, setSelectedAssignedId] = useState<string>("")

    // Delete handler
    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            const res = await fetch(`/api/prospects/${id}`, { method: "DELETE" });
            if (res.ok) {
                setProspects((prev) => prev.filter((p) => p.id !== id));
                toast.success("Successfully deleted")
            } else {
                toast.error("Failed to delete prospect.");
            }
        } catch {
            toast.error("Failed to delete prospect.");
        } finally {
            setDeletingId(null);
        }
    };

    useEffect(() => {
        const statusParam = searchParams?.get("status")
        const engagementStatusParam = searchParams?.get("engagementStatus")
        const assignedIdParam = searchParams?.get("assignedId")
        if (statusParam) {
            setSelectedStatuses([statusParam])
        }
        if (engagementStatusParam) {
            setSelectedEngagementStatus([engagementStatusParam])
        }
        if (assignedIdParam) {
            setSelectedAssignedId(assignedIdParam)
        }

        setLoading(true);
        fetch(`/api/prospects?assignedAgentId=${assignedIdParam || ""}`)
            .then(res => res.json())
            .then(data => {
                if (data.prospects) {
                    setProspects(data.prospects);
                } else {
                    setProspects([]);
                }
                setLoading(false);
            })
            .catch(() => {
                setProspects([]);
                setLoading(false);
            });
    }, [searchParams])


    const filteredProspects = prospects.filter((prospect) => {
        const matchesSearch =
            prospect.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (prospect.phoneNumber ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (prospect.description ?? "").toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(prospect.status);

        let engagementStatus: "To Be Contacted" | "Follow Up" | "Missed Out" = "To Be Contacted";

        const assignedAgentComments = (Array.isArray(prospect?.comments) ? prospect.comments : [])
            .filter((c) => c.authorId === prospect.assignedAgentId);

        if (assignedAgentComments.length === 0 && !prospect.nextFollowUp) {
            engagementStatus = "To Be Contacted";
        } else if (assignedAgentComments.length === 0 && prospect.nextFollowUp) {
            engagementStatus = "Follow Up";
        } else if (prospect.nextFollowUp) {
            const lastCommentDate = assignedAgentComments
                .map((c) => new Date(c.createdAt))
                .sort((a, b) => b.getTime() - a.getTime())[0];

            const followUpDate = new Date(prospect.nextFollowUp);

            engagementStatus = (followUpDate > lastCommentDate) ? "Follow Up" : "Missed Out";
        }

        const matchesEngagement =
            selectedEngagementStatus.length === 0 ||
            selectedEngagementStatus.includes(engagementStatus);

        return matchesSearch && matchesStatus && matchesEngagement;
    });

    const totalPages = Math.ceil(filteredProspects.length / itemsPerPage)

    useEffect(() => {
        clampToTotalPages(totalPages)
    }, [totalPages, clampToTotalPages])
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentProspects = filteredProspects.slice(startIndex, endIndex)

    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return "N/A"
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        })
    }

    const resetFilter = () => {
        setSearchTerm("")
        setSelectedStatuses([])
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
                    <div>
                        <h1 className="text-3xl font-bold">Leads Management</h1>
                        <p className="text-muted-foreground mt-2">Manage and track all leads</p>
                    </div>
                    <Button onClick={() => router.push("/dashboard/prospects/add")} className="mt-[20px] md:mt-none text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300">
                        <Plus className="h-4 w-4" />
                        Create Lead
                    </Button>
                </div>

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
                                <CardDescription>Filter and search through your prospects</CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <Label htmlFor="search">Search Leads</Label>
                                        <div className="relative my-2">
                                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="search"
                                                placeholder="Search by name, phone number, or description..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="pl-10"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>Status</Label>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" className="w-full justify-between bg-transparent">
                                                    {selectedStatuses.length ? `${selectedStatuses.length} selected` : "All Status"}
                                                    <Filter className="ml-2 h-4 w-4 opacity-60" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent className="w-56">
                                                <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuCheckboxItem
                                                    checked={selectedStatuses.length === 0}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) setSelectedStatuses([])
                                                    }}
                                                >
                                                    All Status
                                                </DropdownMenuCheckboxItem>
                                                <DropdownMenuSeparator />
                                                {statuses.map((status) => (
                                                    <DropdownMenuCheckboxItem
                                                        key={status}
                                                        checked={selectedStatuses.includes(status)}
                                                        onCheckedChange={() => {
                                                            const newStatuses = selectedStatuses.includes(status)
                                                                ? selectedStatuses.filter((s) => s !== status)
                                                                : [...selectedStatuses, status]
                                                            setSelectedStatuses(newStatuses)
                                                        }}
                                                    >
                                                        {status}
                                                    </DropdownMenuCheckboxItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        {selectedStatuses.length > 0 && (
                                            <div className="flex flex-wrap gap-2 pt-2 justify-end">
                                                {selectedStatuses.map((status) => (
                                                    <Badge key={status} variant="secondary" className="px-2 py-1">
                                                        <span>{status}</span>
                                                        <button
                                                            type="button"
                                                            aria-label={`Remove ${status}`}
                                                            className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-muted/70"
                                                            onClick={() => {
                                                                const newStatuses = selectedStatuses.filter((s) => s !== status)
                                                                setSelectedStatuses(newStatuses)
                                                            }}
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Engagement Status</Label>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" className="w-full justify-between bg-transparent">
                                                    {selectedEngagementStatus.length
                                                        ? `${selectedEngagementStatus.length} selected`
                                                        : "All Status"}
                                                    <Filter className="ml-2 h-4 w-4 opacity-60" />
                                                </Button>
                                            </DropdownMenuTrigger>

                                            <DropdownMenuContent className="w-56">
                                                <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
                                                <DropdownMenuSeparator />

                                                {/* All Status Option */}
                                                <DropdownMenuCheckboxItem
                                                    checked={selectedEngagementStatus.length === 0}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) setSelectedEngagementStatus([]);
                                                    }}
                                                >
                                                    All Status
                                                </DropdownMenuCheckboxItem>

                                                <DropdownMenuSeparator />

                                                {/* Individual Status Options */}
                                                {engagementStatuses.map((status) => (
                                                    <DropdownMenuCheckboxItem
                                                        key={status}
                                                        checked={selectedEngagementStatus.includes(status)}
                                                        onCheckedChange={() => {
                                                            const newStatuses = selectedEngagementStatus.includes(status)
                                                                ? selectedEngagementStatus.filter((s) => s !== status)
                                                                : [...selectedEngagementStatus, status];
                                                            setSelectedEngagementStatus(newStatuses);
                                                        }}
                                                    >
                                                        {status}
                                                    </DropdownMenuCheckboxItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        {/* Selected Status Badges */}
                                        {selectedEngagementStatus.length > 0 && (
                                            <div className="flex flex-wrap gap-2 pt-2 justify-end">
                                                {selectedEngagementStatus.map((status) => (
                                                    <Badge key={status} variant="secondary" className="px-2 py-1">
                                                        <span>{status}</span>
                                                        <button
                                                            type="button"
                                                            aria-label={`Remove ${status}`}
                                                            className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-muted/70"
                                                            onClick={() => {
                                                                const newStatuses = selectedEngagementStatus.filter((s) => s !== status);
                                                                setSelectedEngagementStatus(newStatuses);
                                                            }}
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* <div className="space-y-2">
                                        <Label >Date Type</Label>
                                        <Select value={dateType} onValueChange={(value: any) => setDateType(value)}>
                                            <SelectTrigger className="bg-white w-full">
                                                <SelectValue placeholder={"Enter the date type"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="followup">Follow-up Date</SelectItem>
                                                <SelectItem value="created">Created Date</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div> */}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Start Date */}
                                    {/* <div className="space-y-2">
                                        <Label className="text-sm font-medium">Start Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className={cn(
                                                        "w-full justify-start text-left font-normal",
                                                        !startDate && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {startDate
                                                        ? new Date(startDate).toLocaleDateString("en-GB", {
                                                            day: "2-digit",
                                                            month: "2-digit",
                                                            year: "numeric",
                                                        })
                                                        : "Pick a date"}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <CalendarComponent
                                                    mode="single"
                                                    selected={startDate ? new Date(startDate) : undefined}
                                                    onSelect={(date: Date) => {
                                                        setStartDate(date.toISOString().split("T")[0]);
                                                        setCurrentPage(1);
                                                    }}
                                                    disabled={(date: Date) => {
                                                        const today = new Date();
                                                        today.setHours(0, 0, 0, 0);
                                                        return date < today;
                                                    }}
                                                    required={false}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div> */}

                                    {/* End Date */}
                                    {/* <div className="space-y-2">
                                        <Label className="text-sm font-medium">End Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className={cn(
                                                        "w-full justify-start text-left font-normal",
                                                        !endDate && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {endDate
                                                        ? new Date(endDate).toLocaleDateString("en-GB", {
                                                            day: "2-digit",
                                                            month: "2-digit",
                                                            year: "numeric",
                                                        })
                                                        : "Pick a date"}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <CalendarComponent
                                                    mode="single"
                                                    selected={endDate ? new Date(endDate) : undefined}
                                                    onSelect={(date: Date) => {
                                                        setEndDate(date.toISOString().split("T")[0]);
                                                        setCurrentPage(1);
                                                    }}
                                                    disabled={(date: Date) => {
                                                        if (!startDate) return false; // no startDate selected yet
                                                        const start = new Date(startDate);
                                                        start.setHours(0, 0, 0, 0); // reset to midnight
                                                        return date < start; // disable all before startDate
                                                    }} required={false}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div> */}

                                    {/* Reset Filters */}
                                    <div className="flex items-end">
                                        <Button
                                            variant="outline"
                                            className="w-full gap-2 bg-white hover:bg-slate-50"
                                        // onClick={resetFilters}
                                        >
                                            <X className="h-4 w-4" />
                                            Reset Filters
                                        </Button>
                                    </div>
                                </div>

                            </CardContent>
                        </>
                    )}
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Leads ({filteredProspects.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center items-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Phone Number</TableHead>
                                            <TableHead>Next Follow Up</TableHead>
                                            <TableHead>Assigned To</TableHead>
                                            <TableHead>Created By</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentProspects.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-8">
                                                    No prospects found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            currentProspects.map((prospect) => (
                                                <TableRow key={prospect.id} className="cursor-pointer" >
                                                    <TableCell className="font-medium max-w-[150px] truncate" onClick={() => router.push(`/dashboard/prospects/${prospect.id}`)}>{prospect.name}</TableCell>
                                                    < TableCell > {prospect.phoneNumber}</TableCell>
                                                    {/* <TableCell className="max-w-[300px] truncate" onClick={() => router.push(`/dashboard/prospects/${prospect.id}`)}>{prospect.description || "N/A"}</TableCell> */}
                                                    <TableCell onClick={() => router.push(`/dashboard/prospects/${prospect.id}`)}>
                                                        <div className="flex items-center gap-2">
                                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                                            {formatDate(prospect.nextFollowUp)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center text-xs font-semibold text-slate-700">
                                                                {prospect?.assignedAgent?.name
                                                                    .split(" ")
                                                                    .map((n: string) => n[0])
                                                                    .join("")}
                                                            </div>
                                                            <span className="text-sm text-slate-700">{prospect?.assignedAgent?.name}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell onClick={() => router.push(`/dashboard/prospects/${prospect.id}`)}>
                                                        <span className="text-sm text-slate-700">{prospect?.createdByAgent?.name || "Unknown"}</span>
                                                    </TableCell>
                                                    <TableCell onClick={() => router.push(`/dashboard/prospects/${prospect.id}`)}>
                                                        <Badge
                                                            className={
                                                                prospect.status === "New" ? "bg-green-100 text-green-800" : "bg-sky-100 text-sky-800"
                                                            }
                                                        >
                                                            {prospect.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                <DropdownMenuItem onClick={() => router.push(`/dashboard/prospects/${prospect.id}`)}>
                                                                    <Eye className="mr-2 h-4 w-4" />
                                                                    View
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => router.push(`/dashboard/prospects/${prospect.id}/edit`)}>
                                                                    <Edit className="mr-2 h-4 w-4" />
                                                                    Edit
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem className="text-destructive" onClick={() => setSourceToDelete(prospect)} disabled={deletingId === prospect.id}>
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    {deletingId === prospect.id ? "Deleting..." : "Delete"}
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
                                        <p className="text-sm text-muted-foreground">
                                            Showing {startIndex + 1} to {Math.min(endIndex, filteredProspects.length)} of{" "}
                                            {filteredProspects.length} prospects
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                                            <ChevronsLeft className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(currentPage - 1)}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <span className="text-sm">
                                            Page {currentPage} of {totalPages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(currentPage + 1)}
                                            disabled={currentPage === totalPages}
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(totalPages)}
                                            disabled={currentPage === totalPages}
                                        >
                                            <ChevronsRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card >
            <AlertDialog open={!!sourceToDelete} onOpenChange={() => setSourceToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the prospect "{sourceToDelete?.name}". This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(sourceToDelete?.id!)} className="bg-red-600 hover:bg-red-700">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    )
}
