"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    Loader2,
    MoreHorizontal,
    Trash2,
    Eye,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Search,
    Filter,
    X,
    Mail,
    Phone,
    Building2,
    ArrowRight,
    CheckCircle2,
    Ban,
    RefreshCcw,
    UserPlus,
    ArrowLeft,
} from "lucide-react"
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "react-toastify"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import { useTablePage } from "@/hooks/useTablePage"

/* Enquiries arrive from the public businessPlus website with no agent attached.
   This screen is the review step before one becomes a lead. */

type Enquiry = {
    id: string
    name: string
    email: string
    phone?: string | null
    company?: string | null
    services: string[]
    payment?: string | null
    notes?: string | null
    source: string
    status: string
    convertedProspectId?: string | null
    convertedAt?: string | null
    convertedByAgent?: { id: string; name: string } | null
    assignedAgent?: { id: string; name: string } | null
    createdAt: string
}

type Agent = { id: string; name: string }
type LeadSource = { id: string; name: string }

const STATUSES = ["New", "Reviewed", "Converted", "Spam"]


function getStatusBadge(status: string) {
    const s = status.toLowerCase()
    if (s === "new")
        return (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                New
            </Badge>
        )
    if (s === "reviewed")
        return (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Reviewed
            </Badge>
        )
    if (s === "converted")
        return (
            <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
                Converted
            </Badge>
        )
    if (s === "spam")
        return (
            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                Spam
            </Badge>
        )
    return <Badge variant="outline">{status}</Badge>
}

const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return "N/A"
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    })
}

export default function EnquiriesPage() {
    const [enquiries, setEnquiries] = useState<Enquiry[]>([])
    const [loading, setLoading] = useState(true)

    const searchParams = useSearchParams()

    const [searchTerm, setSearchTerm] = useState("")
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
    const { currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, clampToTotalPages } =
        useTablePage("admin-sales-dashboard-enquiries-page")

    const [agents, setAgents] = useState<Agent[]>([])
    const [leadSources, setLeadSources] = useState<LeadSource[]>([])

    const [selected, setSelected] = useState<Enquiry | null>(null)
    const [convertTarget, setConvertTarget] = useState<Enquiry | null>(null)
    const [enquiryToDelete, setEnquiryToDelete] = useState<Enquiry | null>(null)
    const [assignedAgentId, setAssignedAgentId] = useState("")
    const [leadSourceId, setLeadSourceId] = useState("")
    const [busy, setBusy] = useState(false)

    const resetFilters = () => {
        setSearchTerm("")
        setSelectedStatuses([])
        setCurrentPage(1)
    }

    // Arriving from a dashboard section's "View All" link preselects that status.
    useEffect(() => {
        const statusParam = searchParams?.get("status")
        if (statusParam) setSelectedStatuses([statusParam])
    }, [searchParams])

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetchWithAuth("/api/enquiries?status=all")
            if (!res.ok) throw new Error("Failed to load enquiries")
            const data = await res.json()
            setEnquiries(data.enquiries ?? [])
        } catch {
            toast.error("Could not load enquiries")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        load()
    }, [load])

    /* Agents and lead sources only matter once someone opens the convert
       dialog, but both lists are small and shared by every row. */
    useEffect(() => {
        fetchWithAuth("/api/agents")
            .then((r) => (r.ok ? r.json() : []))
            .then((data) => setAgents(Array.isArray(data) ? data : []))
            .catch(() => setAgents([]))

        fetchWithAuth("/api/lead_source")
            .then((r) => (r.ok ? r.json() : []))
            .then((data) => setLeadSources(Array.isArray(data) ? data : []))
            .catch(() => setLeadSources([]))
    }, [])

    const filteredEnquiries = useMemo(() => {
        const term = searchTerm.trim().toLowerCase()
        return enquiries.filter((e) => {
            if (selectedStatuses.length && !selectedStatuses.includes(e.status)) return false
            if (!term) return true
            return [e.name, e.email, e.phone, e.company, e.services.join(" ")]
                .filter(Boolean)
                .some((field) => String(field).toLowerCase().includes(term))
        })
    }, [enquiries, searchTerm, selectedStatuses])

    const totalPages = Math.max(1, Math.ceil(filteredEnquiries.length / itemsPerPage))
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentEnquiries = filteredEnquiries.slice(startIndex, endIndex)

    useEffect(() => {
        clampToTotalPages(totalPages)
    }, [totalPages, clampToTotalPages])

    async function setStatus(enquiry: Enquiry, status: string) {
        setBusy(true)
        try {
            const res = await fetchWithAuth(`/api/enquiries/${enquiry.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to update")
            toast.success(`Marked as ${status}`)
            setSelected(null)
            load()
        } catch (error: any) {
            toast.error(error.message || "Failed to update enquiry")
        } finally {
            setBusy(false)
        }
    }

    async function convert() {
        if (!convertTarget) return
        if (!assignedAgentId) {
            toast.error("Select an agent to assign this lead to")
            return
        }
        setBusy(true)
        try {
            const res = await fetchWithAuth(`/api/enquiries/${convertTarget.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "convert",
                    assignedAgentId,
                    leadSourceId: leadSourceId || undefined,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to convert")
            toast.success("Enquiry converted to a lead")
            setConvertTarget(null)
            setSelected(null)
            setAssignedAgentId("")
            setLeadSourceId("")
            load()
        } catch (error: any) {
            toast.error(error.message || "Failed to convert enquiry")
        } finally {
            setBusy(false)
        }
    }

    async function handleDelete(id: string) {
        setBusy(true)
        try {
            const res = await fetchWithAuth(`/api/enquiries/${id}`, { method: "DELETE" })
            if (!res.ok) throw new Error("Failed to delete")
            toast.success("Enquiry deleted")
            setEnquiryToDelete(null)
            setSelected(null)
            load()
        } catch (error: any) {
            toast.error(error.message || "Failed to delete enquiry")
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
                    <div>
                        <h1 className="text-3xl font-bold">All BusinessPlus Enquiries</h1>
                        <p className="text-muted-foreground mt-2">
                            Service requests submitted on the businessPlus website
                        </p>
                    </div>
                    <div className="flex items-center gap-2 mt-[20px] md:mt-none">
                        <Link href="/dashboard/enquiries">
                            <Button variant="outline" className="rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer">
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </Button>
                        </Link>
                        <Button
                            onClick={load}
                            disabled={loading}
                            className="text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300"
                        >
                            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                    </div>
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
                                <CardDescription>Filter and search through your enquiries</CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <Label htmlFor="search">Search Enquiries</Label>
                                        <div className="relative my-2">
                                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="search"
                                                placeholder="Search by name, email, company, or service..."
                                                value={searchTerm}
                                                onChange={(e) => {
                                                    setSearchTerm(e.target.value)
                                                    setCurrentPage(1)
                                                }}
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
                                                    {selectedStatuses.length
                                                        ? `${selectedStatuses.length} selected`
                                                        : "All Status"}
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
                                                {STATUSES.map((status) => (
                                                    <DropdownMenuCheckboxItem
                                                        key={status}
                                                        checked={selectedStatuses.includes(status)}
                                                        onCheckedChange={() => {
                                                            setSelectedStatuses((prev) =>
                                                                prev.includes(status)
                                                                    ? prev.filter((s) => s !== status)
                                                                    : [...prev, status],
                                                            )
                                                            setCurrentPage(1)
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
                                                            onClick={() =>
                                                                setSelectedStatuses((prev) =>
                                                                    prev.filter((s) => s !== status),
                                                                )
                                                            }
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Reset Filters */}
                                    <div className="flex items-end">
                                        <Button
                                            variant="outline"
                                            className="w-full gap-2 bg-white hover:bg-slate-50"
                                            onClick={resetFilters}
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
                    <CardTitle>Enquiries ({filteredEnquiries.length})</CardTitle>
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
                                            <TableHead>Contact</TableHead>
                                            <TableHead>Services</TableHead>
                                            <TableHead>Received</TableHead>
                                            <TableHead>Assigned To</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentEnquiries.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-8">
                                                    {searchTerm || selectedStatuses.length
                                                        ? "No enquiries match your filters"
                                                        : "No enquiries found"}
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            currentEnquiries.map((enquiry) => (
                                                <TableRow key={enquiry.id} className="cursor-pointer">
                                                    <TableCell
                                                        className="font-medium max-w-[180px]"
                                                        onClick={() => setSelected(enquiry)}
                                                    >
                                                        <p className="truncate">{enquiry.name}</p>
                                                        {enquiry.company && (
                                                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                                <Building2 className="h-3 w-3" />
                                                                <span className="truncate">{enquiry.company}</span>
                                                            </p>
                                                        )}
                                                    </TableCell>
                                                    <TableCell onClick={() => setSelected(enquiry)}>
                                                        <p className="text-sm flex items-center gap-1.5">
                                                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                                            {enquiry.email}
                                                        </p>
                                                        {enquiry.phone && (
                                                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                                                <Phone className="h-3 w-3" />
                                                                {enquiry.phone}
                                                            </p>
                                                        )}
                                                    </TableCell>
                                                    <TableCell
                                                        className="max-w-[240px]"
                                                        onClick={() => setSelected(enquiry)}
                                                    >
                                                        <div className="flex flex-wrap gap-1">
                                                            {enquiry.services.slice(0, 2).map((s) => (
                                                                <Badge
                                                                    key={s}
                                                                    variant="outline"
                                                                    className="text-xs font-normal"
                                                                >
                                                                    {s}
                                                                </Badge>
                                                            ))}
                                                            {enquiry.services.length > 2 && (
                                                                <Badge variant="outline" className="text-xs font-normal">
                                                                    +{enquiry.services.length - 2}
                                                                </Badge>
                                                            )}
                                                            {enquiry.services.length === 0 && (
                                                                <span className="text-sm text-muted-foreground">N/A</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell onClick={() => setSelected(enquiry)}>
                                                        <span className="text-sm text-slate-700">
                                                            {formatDate(enquiry.createdAt)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell onClick={() => setSelected(enquiry)}>
                                                        {enquiry.assignedAgent ? (
                                                            <span className="text-sm text-slate-700">
                                                                {enquiry.assignedAgent.name}
                                                            </span>
                                                        ) : (
                                                            <span className="text-sm text-muted-foreground">
                                                                Unassigned
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell onClick={() => setSelected(enquiry)}>
                                                        {getStatusBadge(enquiry.status)}
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
                                                                <DropdownMenuItem asChild>
                                                                    <Link href={`/dashboard/enquiries/${enquiry.id}`}>
                                                                        <Eye className="mr-2 h-4 w-4" />
                                                                        View
                                                                    </Link>
                                                                </DropdownMenuItem>

                                                                {enquiry.status === "Converted" ? (
                                                                    enquiry.convertedProspectId && (
                                                                        <DropdownMenuItem asChild>
                                                                            <Link
                                                                                href={`/dashboard/prospects/${enquiry.convertedProspectId}`}
                                                                            >
                                                                                <ArrowRight className="mr-2 h-4 w-4" />
                                                                                Open lead
                                                                            </Link>
                                                                        </DropdownMenuItem>
                                                                    )
                                                                ) : (
                                                                    <>
                                                                        <DropdownMenuItem
                                                                            onClick={() => {
                                                                                setConvertTarget(enquiry)
                                                                                setAssignedAgentId("")
                                                                                setLeadSourceId("")
                                                                            }}
                                                                        >
                                                                            <UserPlus className="mr-2 h-4 w-4" />
                                                                            Accept
                                                                        </DropdownMenuItem>
                                                                        {enquiry.status !== "Reviewed" && (
                                                                            <DropdownMenuItem
                                                                                onClick={() => setStatus(enquiry, "Reviewed")}
                                                                            >
                                                                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                                                                Mark reviewed
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                        <DropdownMenuItem
                                                                            onClick={() => setStatus(enquiry, "Spam")}
                                                                        >
                                                                            <Ban className="mr-2 h-4 w-4" />
                                                                            Mark spam
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}

                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    className="text-destructive"
                                                                    onClick={() => setEnquiryToDelete(enquiry)}
                                                                >
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
                                        <p className="text-sm text-muted-foreground">
                                            Showing {startIndex + 1} to{" "}
                                            {Math.min(endIndex, filteredEnquiries.length)} of{" "}
                                            {filteredEnquiries.length} enquiries
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(1)}
                                            disabled={currentPage === 1}
                                        >
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
            </Card>

            {/* ---------------- Detail ---------------- */}
            <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    {selected && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-3">
                                    {selected.name}
                                    {getStatusBadge(selected.status)}
                                </DialogTitle>
                                <DialogDescription>
                                    Received {formatDate(selected.createdAt)} from the businessPlus website.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 text-sm">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <p className="text-muted-foreground text-xs">Email</p>
                                        <p>{selected.email}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Phone</p>
                                        <p>{selected.phone || "N/A"}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Company</p>
                                        <p>{selected.company || "N/A"}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Payment preference</p>
                                        <p>{selected.payment || "N/A"}</p>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-muted-foreground text-xs mb-1.5">Services requested</p>
                                    {selected.services.length ? (
                                        <div className="flex flex-wrap gap-1.5">
                                            {selected.services.map((s) => (
                                                <Badge key={s} variant="outline" className="font-normal">
                                                    {s}
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : (
                                        <p>N/A</p>
                                    )}
                                </div>

                                <div>
                                    <p className="text-muted-foreground text-xs mb-1">Notes</p>
                                    <p className="whitespace-pre-wrap">{selected.notes || "N/A"}</p>
                                </div>

                                {selected.status === "Converted" && (
                                    <div className="rounded-md bg-violet-50 border border-violet-200 p-3">
                                        <p className="text-violet-800">
                                            Converted {formatDate(selected.convertedAt)}
                                            {selected.convertedByAgent
                                                ? `, assigned to ${selected.convertedByAgent.name}`
                                                : ""}
                                            .
                                        </p>
                                        {selected.convertedProspectId && (
                                            <Link
                                                href={`/dashboard/prospects/${selected.convertedProspectId}`}
                                                className="text-violet-900 underline text-xs"
                                            >
                                                Open the lead
                                            </Link>
                                        )}
                                    </div>
                                )}
                            </div>

                            <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                                <Button
                                    variant="outline"
                                    className="text-destructive"
                                    onClick={() => setEnquiryToDelete(selected)}
                                    disabled={busy}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                </Button>

                                {selected.status !== "Converted" && (
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => setStatus(selected, "Spam")}
                                            disabled={busy}
                                        >
                                            <Ban className="h-4 w-4 mr-2" />
                                            Spam
                                        </Button>
                                        {selected.status !== "Reviewed" && (
                                            <Button
                                                variant="outline"
                                                onClick={() => setStatus(selected, "Reviewed")}
                                                disabled={busy}
                                            >
                                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                                Mark reviewed
                                            </Button>
                                        )}
                                        <Button
                                            onClick={() => {
                                                setConvertTarget(selected)
                                                setAssignedAgentId("")
                                                setLeadSourceId("")
                                            }}
                                            disabled={busy}
                                        >
                                            Accept
                                        </Button>
                                    </div>
                                )}
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* ---------------- Convert ---------------- */}
            <Dialog open={!!convertTarget} onOpenChange={(open) => !open && setConvertTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Accept</DialogTitle>
                        <DialogDescription>
                            Accepting creates a lead from {convertTarget?.name}&apos;s enquiry and
                            assigns it to an agent. The enquiry is marked as converted and the
                            client sees it as accepted. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Assign to agent</Label>
                            <Select value={assignedAgentId} onValueChange={setAssignedAgentId}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select an agent" />
                                </SelectTrigger>
                                <SelectContent>
                                    {agents.map((agent) => (
                                        <SelectItem key={agent.id} value={agent.id}>
                                            {agent.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Lead source (optional)</Label>
                            <Select value={leadSourceId} onValueChange={setLeadSourceId}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a lead source" />
                                </SelectTrigger>
                                <SelectContent>
                                    {leadSources.map((source) => (
                                        <SelectItem key={source.id} value={source.id}>
                                            {source.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConvertTarget(null)} disabled={busy}>
                            Cancel
                        </Button>
                        <Button onClick={convert} disabled={busy || !assignedAgentId}>
                            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Accept
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ---------------- Delete ---------------- */}
            <AlertDialog
                open={!!enquiryToDelete}
                onOpenChange={() => setEnquiryToDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will delete the enquiry from &quot;{enquiryToDelete?.name}&quot;. Any lead
                            already created from it is not affected.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => handleDelete(enquiryToDelete?.id!)}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
