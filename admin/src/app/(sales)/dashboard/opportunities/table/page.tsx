"use client"

import { useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Eye,
    Search,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    ArrowLeft,
    Filter,
    X,
    Calendar,
} from "lucide-react"
import Link from "next/link"

// Mock data - expanded for pagination
const allProspects = [
    {
        id: 1,
        name: "Sarah Johnson",
        phone: "(555) 123-4567",
        description: "Interested in premium package",
        nextFollowUp: "2024-01-20",
        status: "New",
        source: "Website",
        advisor: "John Smith",
        createdDate: "2024-01-15",
    },
    {
        id: 2,
        name: "Michael Chen",
        phone: "(555) 234-5678",
        description: "Website inquiry about services",
        nextFollowUp: "2024-01-21",
        status: "New",
        source: "Website",
        advisor: "Jane Doe",
        createdDate: "2024-01-16",
    },
    {
        id: 3,
        name: "Emma Williams",
        phone: "(555) 345-6789",
        description: "Referral from existing client",
        nextFollowUp: "2024-01-22",
        status: "New",
        source: "Referral",
        advisor: "John Smith",
        createdDate: "2024-01-17",
    },
    {
        id: 4,
        name: "James Anderson",
        phone: "(555) 456-7890",
        description: "Campaign response - Q1 promo",
        nextFollowUp: "2024-01-23",
        status: "New",
        source: "Campaign",
        advisor: "Sarah Williams",
        createdDate: "2024-01-18",
    },
    {
        id: 5,
        name: "Olivia Martinez",
        phone: "(555) 567-8901",
        description: "Phone inquiry about pricing",
        nextFollowUp: "2024-01-24",
        status: "New",
        source: "Phone Call",
        advisor: "Jane Doe",
        createdDate: "2024-01-19",
    },
    {
        id: 6,
        name: "David Brown",
        phone: "(555) 678-9012",
        description: "Second meeting scheduled",
        nextFollowUp: "2024-01-19",
        status: "In Progress",
        source: "Website",
        advisor: "John Smith",
        createdDate: "2024-01-10",
    },
    {
        id: 7,
        name: "Sophia Taylor",
        phone: "(555) 789-0123",
        description: "Waiting for proposal review",
        nextFollowUp: "2024-01-20",
        status: "In Progress",
        source: "Referral",
        advisor: "Jane Doe",
        createdDate: "2024-01-11",
    },
    {
        id: 8,
        name: "Daniel Wilson",
        phone: "(555) 890-1234",
        description: "Demo completed, considering options",
        nextFollowUp: "2024-01-21",
        status: "In Progress",
        source: "Phone Call",
        advisor: "Sarah Williams",
        createdDate: "2024-01-12",
    },
    {
        id: 9,
        name: "Isabella Garcia",
        phone: "(555) 901-2345",
        description: "Contract negotiation phase",
        nextFollowUp: "2024-01-22",
        status: "In Progress",
        source: "Campaign",
        advisor: "John Smith",
        createdDate: "2024-01-13",
    },
    {
        id: 10,
        name: "Matthew Lee",
        phone: "(555) 012-3456",
        description: "Technical questions pending",
        nextFollowUp: "2024-01-23",
        status: "In Progress",
        source: "Website",
        advisor: "Jane Doe",
        createdDate: "2024-01-14",
    },
    {
        id: 11,
        name: "Ava Rodriguez",
        phone: "(555) 111-2222",
        description: "Follow-up call completed",
        nextFollowUp: "2024-01-25",
        status: "Contacted",
        source: "Website",
        advisor: "John Smith",
        createdDate: "2024-01-08",
    },
    {
        id: 12,
        name: "Ethan White",
        phone: "(555) 222-3333",
        description: "Email sent, awaiting response",
        nextFollowUp: "2024-01-26",
        status: "Contacted",
        source: "Referral",
        advisor: "Sarah Williams",
        createdDate: "2024-01-09",
    },
    {
        id: 13,
        name: "Mia Thompson",
        phone: "(555) 333-4444",
        description: "No answer on multiple attempts",
        nextFollowUp: "2024-01-20",
        status: "Missed",
        source: "Phone Call",
        advisor: "Jane Doe",
        createdDate: "2024-01-05",
    },
    {
        id: 14,
        name: "Alexander Davis",
        phone: "(555) 444-5555",
        description: "Voicemail left, no callback",
        nextFollowUp: "2024-01-21",
        status: "Missed",
        source: "Campaign",
        advisor: "John Smith",
        createdDate: "2024-01-06",
    },
    {
        id: 15,
        name: "Charlotte Moore",
        phone: "(555) 555-6666",
        description: "Initial contact made successfully",
        nextFollowUp: "2024-01-27",
        status: "New",
        source: "Website",
        advisor: "Sarah Williams",
        createdDate: "2024-01-20",
    },
]

const statusColors = {
    New: "bg-green-100 text-green-700 border-green-200",
    "In Progress": "bg-blue-100 text-blue-700 border-blue-200",
    Contacted: "bg-sky-100 text-sky-700 border-sky-200",
    Missed: "bg-red-100 text-red-700 border-red-200",
}

const ITEMS_PER_PAGE = 10

export default function ProspectsTablePage() {
    const searchParams = useSearchParams()
    const statusFromUrl = searchParams.get("status")

    const [searchQuery, setSearchQuery] = useState("")
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>(statusFromUrl ? [statusFromUrl] : [])
    const [sourceFilter, setSourceFilter] = useState("all")
    const [advisorFilter, setAdvisorFilter] = useState("all")
    const [dateType, setDateType] = useState<"followup" | "previous" | "created">("followup")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")
    const [currentPage, setCurrentPage] = useState(1)
    const [loading, setLoading] = useState(false)

    const filteredProspects = useMemo(() => {
        return allProspects.filter((prospect) => {
            const matchesSearch =
                prospect.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                prospect.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
                prospect.description.toLowerCase().includes(searchQuery.toLowerCase())

            const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(prospect.status)
            const matchesSource = sourceFilter === "all" || prospect.source === sourceFilter
            const matchesAdvisor = advisorFilter === "all" || prospect.advisor === advisorFilter

            let matchesDate = true
            if (startDate || endDate) {
                let dateToCompare = prospect.nextFollowUp
                if (dateType === "previous") {
                    dateToCompare = prospect.nextFollowUp // In real app, this would be previousFollowUp field
                } else if (dateType === "created") {
                    dateToCompare = prospect.createdDate
                }

                if (startDate && dateToCompare < startDate) matchesDate = false
                if (endDate && dateToCompare > endDate) matchesDate = false
            }

            return matchesSearch && matchesStatus && matchesSource && matchesAdvisor && matchesDate
        })
    }, [searchQuery, selectedStatuses, sourceFilter, advisorFilter, dateType, startDate, endDate])

    const totalPages = Math.ceil(filteredProspects.length / ITEMS_PER_PAGE)
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    const paginatedProspects = filteredProspects.slice(startIndex, endIndex)

    const resetFilters = () => {
        setSearchQuery("")
        setSelectedStatuses([])
        setSourceFilter("all")
        setAdvisorFilter("all")
        setDateType("followup")
        setStartDate("")
        setEndDate("")
        setCurrentPage(1)
    }

    const totalProspects = filteredProspects.length
    const newProspects = filteredProspects.filter((p) => p.status === "New").length
    const inProgressProspects = filteredProspects.filter((p) => p.status === "In Progress").length

    return (
        <div className="min-h-screen  bg-[#e3f2fd] p-6 md:p-8">
            <div className="mx-auto max-w-7xl space-y-6">
                {/* Header */}

                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Opportunities Management</h1>
                    <p className="text-slate-600">
                        {statusFromUrl ? `Showing ${statusFromUrl} opportunities` : "Manage and track all opportunities"}
                    </p>
                </div>

                {/* Filters */}
                <Card className="bg-white backdrop-blur-sm border-slate-200">
                    {loading ? (
                        <CardContent className="pt-6">
                            <div className="h-[200px] w-full bg-slate-200 rounded-2xl mb-4 animate-pulse"></div>
                            <div className="flex justify-between gap-4">
                                <div className="h-5 w-1/2 bg-slate-200 rounded-xl mb-3 animate-pulse"></div>
                                <div className="h-5 w-1/2 bg-slate-200 rounded-xl mb-3 animate-pulse"></div>
                            </div>
                        </CardContent>
                    ) : (
                        <>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-slate-900">
                                    <Filter className="h-5 w-5 text-slate-600" />
                                    Filters & Search
                                </CardTitle>
                                <CardDescription className="text-slate-600">Filter and search through your opportunities</CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                {/* Search */}
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <Label htmlFor="search" className="text-sm font-medium text-slate-700">
                                            Search Opportunities
                                        </Label>
                                        <div className="relative my-2">
                                            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                            <Input
                                                id="search"
                                                placeholder="Search by name, phone, or description..."
                                                value={searchQuery}
                                                onChange={(e) => {
                                                    setSearchQuery(e.target.value)
                                                    setCurrentPage(1)
                                                }}
                                                className="pl-10 bg-white"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Filter Controls */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="space-y-2 w-full">
                                        <Label className="text-sm font-medium text-slate-700">Status</Label>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" className="w-full justify-between bg-white">
                                                    {selectedStatuses.length ? `${selectedStatuses.length} selected` : "All Statuses"}
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
                                                    All Statuses
                                                </DropdownMenuCheckboxItem>
                                                <DropdownMenuSeparator />
                                                {["New", "In Progress", "Contacted", "Missed"].map((status) => (
                                                    <DropdownMenuCheckboxItem
                                                        key={status}
                                                        checked={selectedStatuses.includes(status)}
                                                        onCheckedChange={() => {
                                                            const newStatuses = selectedStatuses.includes(status)
                                                                ? selectedStatuses.filter((s) => s !== status)
                                                                : [...selectedStatuses, status]
                                                            setSelectedStatuses(newStatuses)
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
                                                        <span className="text-xs">{status}</span>
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

                                    <div className="space-y-2 w-full">
                                        <Label className="text-sm font-medium text-slate-700">Lead Source</Label>
                                        <Select
                                            value={sourceFilter}
                                            onValueChange={(value) => {
                                                setSourceFilter(value)
                                                setCurrentPage(1)
                                            }}
                                        >
                                            <SelectTrigger className="bg-white w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Sources</SelectItem>
                                                <SelectItem value="Website">Website</SelectItem>
                                                <SelectItem value="Referral">Referral</SelectItem>
                                                <SelectItem value="Phone Call">Phone Call</SelectItem>
                                                <SelectItem value="Campaign">Campaign</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium text-slate-700">Client Advisor</Label>
                                        <Select
                                            value={advisorFilter}
                                            onValueChange={(value) => {
                                                setAdvisorFilter(value)
                                                setCurrentPage(1)
                                            }}
                                        >
                                            <SelectTrigger className="bg-white w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Advisors</SelectItem>
                                                <SelectItem value="John Smith">John Smith</SelectItem>
                                                <SelectItem value="Jane Doe">Jane Doe</SelectItem>
                                                <SelectItem value="Sarah Williams">Sarah Williams</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium text-slate-700">Date Type</Label>
                                        <Select value={dateType} onValueChange={(value: any) => setDateType(value)}>
                                            <SelectTrigger className="bg-white w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="followup">Follow-up Date</SelectItem>
                                                <SelectItem value="previous">Previous Follow-up</SelectItem>
                                                <SelectItem value="created">Created Date</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium text-slate-700">Start Date</Label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                            <Input
                                                type="date"
                                                value={startDate}
                                                onChange={(e) => {
                                                    setStartDate(e.target.value)
                                                    setCurrentPage(1)
                                                }}
                                                className="pl-10 bg-white"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium text-slate-700">End Date</Label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                            <Input
                                                type="date"
                                                value={endDate}
                                                onChange={(e) => {
                                                    setEndDate(e.target.value)
                                                    setCurrentPage(1)
                                                }}
                                                className="pl-10 bg-white"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-end">
                                        <Button
                                            onClick={resetFilters}
                                            variant="outline"
                                            className="w-full gap-2 bg-white hover:bg-slate-50"
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

                {/* Table */}
                <Card className="overflow-hidden py-0 bg-white/60 backdrop-blur-sm border-slate-200">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-[#003459] text-white hover:bg-slate-50/80">
                                        <TableHead className="text-slate-700 font-semibold">Name</TableHead>
                                        <TableHead className="text-slate-700 font-semibold">Phone</TableHead>
                                        <TableHead className="text-slate-700 font-semibold">Description</TableHead>
                                        <TableHead className="text-slate-700 font-semibold">Next Follow-Up</TableHead>
                                        <TableHead className="text-slate-700 font-semibold">Source</TableHead>
                                        <TableHead className="text-slate-700 font-semibold">Advisor</TableHead>
                                        <TableHead className="text-slate-700 font-semibold">Status</TableHead>
                                        <TableHead className="text-slate-700 font-semibold text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedProspects.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="py-12 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Search className="h-12 w-12 text-slate-300" />
                                                    <p className="text-sm font-medium text-slate-900">No prospects found</p>
                                                    <p className="text-sm text-slate-600">Try adjusting your filters</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedProspects.map((prospect) => (
                                            <TableRow key={prospect.id} className="hover:bg-slate-50/50">
                                                <TableCell className="font-medium text-slate-900">{prospect.name}</TableCell>
                                                <TableCell className="text-slate-600">{prospect.phone}</TableCell>
                                                <TableCell className="text-slate-600 max-w-xs truncate">{prospect.description}</TableCell>
                                                <TableCell className="text-slate-600">{prospect.nextFollowUp}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                                                        {prospect.source}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-slate-600">{prospect.advisor}</TableCell>
                                                <TableCell>
                                                    <Badge className={`border ${statusColors[prospect.status as keyof typeof statusColors]}`}>
                                                        {prospect.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Link href={`/dashboard/prospects/${prospect.id}`}>
                                                        <Button variant="ghost" size="sm" className="gap-2">
                                                            <Eye className="h-4 w-4" />
                                                            View
                                                        </Button>
                                                    </Link>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-2">
                        <div className="text-sm text-slate-600">
                            Showing {startIndex + 1} to {Math.min(endIndex, filteredProspects.length)} of {filteredProspects.length}{" "}
                            prospects
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="bg-white"
                            >
                                <ChevronsLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="bg-white"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm text-slate-700 min-w-[100px] text-center">
                                Page {currentPage} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="bg-white"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                className="bg-white"
                            >
                                <ChevronsRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
