"use client"
import { useState, useEffect } from "react"
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
import Link from "next/link"

interface Opportunity {
    id: string
    name: string
    phoneNumber: string
    description: string
    amount: number
    nextFollowUp?: string
    status: "Proposal Issued" | "Closed as Won" | "Closed as Loss"
}

const statuses = ["Proposal Issued", "Closed as Won", "Closed as Loss"]

export default function OpportunitiesTable() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [opportunities, setOpportunities] = useState<Opportunity[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(20)

    useEffect(() => {
        const statusParam = searchParams?.get("status")
        if (statusParam) {
            setSelectedStatuses([statusParam])
        }
    }, [searchParams])

    useEffect(() => {
        // Mock API call - replace with actual API
        setTimeout(() => {
            const mockOpportunities: Opportunity[] = [
                {
                    id: "1a2b3c",
                    name: "Acme Corp",
                    phoneNumber: "+1 234-567-8900",
                    description: "Enterprise software license for 100 users",
                    amount: 50000,
                    nextFollowUp: "2025-01-20",
                    status: "Proposal Issued",
                },
                {
                    id: "4d5e6f",
                    name: "Tech Solutions Inc",
                    phoneNumber: "+1 234-567-8901",
                    description: "Cloud migration and consulting services",
                    amount: 125000,
                    nextFollowUp: "2025-01-15",
                    status: "Closed as Won",
                },
                {
                    id: "7g8h9i",
                    name: "Global Enterprises",
                    phoneNumber: "+1 234-567-8902",
                    description: "Annual support contract renewal",
                    amount: 35000,
                    nextFollowUp: "2025-01-18",
                    status: "Closed as Loss",
                },
                {
                    id: "0j1k2l",
                    name: "StartUp Innovations",
                    phoneNumber: "+1 234-567-8903",
                    description: "Custom app development project",
                    amount: 75000,
                    nextFollowUp: "2025-01-22",
                    status: "Proposal Issued",
                },
                {
                    id: "3m4n5o",
                    name: "Retail Chain Co",
                    phoneNumber: "+1 234-567-8904",
                    description: "POS system integration",
                    amount: 90000,
                    nextFollowUp: "2025-01-12",
                    status: "Closed as Won",
                },
                {
                    id: "6p7q8r",
                    name: "Manufacturing Ltd",
                    phoneNumber: "+1 234-567-8905",
                    description: "ERP system implementation",
                    amount: 200000,
                    nextFollowUp: "2025-02-01",
                    status: "Proposal Issued",
                },
                {
                    id: "9s0t1u",
                    name: "Healthcare Group",
                    phoneNumber: "+1 234-567-8906",
                    description: "HIPAA compliant data management solution",
                    amount: 150000,
                    nextFollowUp: "2025-01-28",
                    status: "Closed as Loss",
                },
                {
                    id: "2v3w4x",
                    name: "Financial Services Co",
                    phoneNumber: "+1 234-567-8907",
                    description: "Cybersecurity audit and implementation",
                    amount: 180000,
                    nextFollowUp: "2025-01-25",
                    status: "Closed as Won",
                },
            ]
            setOpportunities(mockOpportunities)
            setLoading(false)
        }, 500)
    }, [])

    const filteredOpportunities = opportunities.filter((opportunity) => {
        const matchesSearch =
            opportunity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            opportunity.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            opportunity.description.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(opportunity.status)

        return matchesSearch && matchesStatus
    })

    const totalPages = Math.ceil(filteredOpportunities.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentOpportunities = filteredOpportunities.slice(startIndex, endIndex)

    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return "N/A"
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        })
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount)
    }

    const resetFilter = () => {
        setSearchTerm("")
        setSelectedStatuses([])
    }

    const totalAmount = filteredOpportunities.reduce((sum, opp) => sum + opp.amount, 0)
    const wonAmount = filteredOpportunities
        .filter((opp) => opp.status === "Closed as Won")
        .reduce((sum, opp) => sum + opp.amount, 0)

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
                    <div>
                        <h1 className="text-3xl font-bold">Opportunities Management</h1>
                        <p className="text-muted-foreground mt-2">Manage and track all sales opportunities</p>
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
                                <CardDescription>Filter and search through your opportunities</CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <Label htmlFor="search">Search Opportunities</Label>
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

                                    <div className="md:col-span-2 flex items-end gap-2">
                                        <Button onClick={resetFilter} variant="outline" className="gap-2 bg-transparent">
                                            <X className="h-4 w-4" />
                                            Reset Filters
                                        </Button>
                                    </div>
                                </div>

                                <div className="pt-4 border-t">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-blue-50 p-4 rounded-lg">
                                            <p className="text-sm text-muted-foreground">Total Opportunity Value</p>
                                            <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalAmount)}</p>
                                        </div>
                                        <div className="bg-green-50 p-4 rounded-lg">
                                            <p className="text-sm text-muted-foreground">Won Opportunity Value</p>
                                            <p className="text-2xl font-bold text-green-700">{formatCurrency(wonAmount)}</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </>
                    )}
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Opportunities ({filteredOpportunities.length})</CardTitle>
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
                                            <TableHead>Description</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead>Next Follow Up</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentOpportunities.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-8">
                                                    No opportunities found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            currentOpportunities.map((opportunity) => (
                                                <TableRow key={opportunity.id}>
                                                    <TableCell className="font-medium">{opportunity.name}</TableCell>
                                                    <TableCell>{opportunity.phoneNumber}</TableCell>
                                                    <TableCell className="max-w-[300px] truncate">{opportunity.description}</TableCell>
                                                    <TableCell className="font-semibold">{formatCurrency(opportunity.amount)}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                                            {formatDate(opportunity.nextFollowUp)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            className={
                                                                opportunity.status === "Proposal Issued"
                                                                    ? "bg-amber-100 text-amber-800"
                                                                    : opportunity.status === "Closed as Won"
                                                                        ? "bg-green-100 text-green-800"
                                                                        : "bg-red-100 text-red-800"
                                                            }
                                                        >
                                                            {opportunity.status}
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
                                                                <DropdownMenuItem onClick={() => router.push("/sales/opportunites/1")}>
                                                                    <Eye className="mr-2 h-4 w-4" />
                                                                    View
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem>
                                                                    <Edit className="mr-2 h-4 w-4" />
                                                                    Edit
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem className="text-destructive">
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
                                            Showing {startIndex + 1} to {Math.min(endIndex, filteredOpportunities.length)} of{" "}
                                            {filteredOpportunities.length} opportunities
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
                                        <div className="flex items-center gap-1">
                                            <span className="text-sm">
                                                Page {currentPage} of {totalPages}
                                            </span>
                                        </div>
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
        </div>
    )
}
