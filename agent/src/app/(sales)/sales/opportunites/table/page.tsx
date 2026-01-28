"use client"
import { useState, useEffect } from "react"
import { useAgentContext } from "@/lib/agent-context"
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
import { normalizePhoneNumber } from "@/lib/normalizePhoneNumber"

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
    const agent = useAgentContext();
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
            // Normalize status to match backend data
            const normalized =
                statusParam.toLowerCase() === "proposal issued".toLowerCase() ? "Proposal Issued" :
                    statusParam.toLowerCase() === "closed as won".toLowerCase() ? "Closed as Won" :
                        statusParam.toLowerCase() === "closed as loss".toLowerCase() ? "Closed as Loss" : statusParam;
            setSelectedStatuses([normalized]);
        }
    }, [searchParams])


    useEffect(() => {
        setLoading(true);
        fetch('/api/opportunities')
            .then(res => res.json())
            .then(data => {
                setOpportunities(data.opportunities || []);
                setLoading(false);
            })
            .catch(() => {
                setOpportunities([]);
                setLoading(false);
            });
    }, []);

    // Client-side role-based filtering
    const filteredOpportunities = opportunities.filter((opportunity: any) => {
        if (!agent) return false;
        // If the API already filters, this is a safeguard for extra safety
        if (agent.agentType === "Lead Maker") {
            if (opportunity.prospect?.createdByAgentId !== agent.id) return false;
        } else if (agent.agentType === "Client Advisor" || agent.agentType === "Client Manager") {
            if (opportunity.prospect?.assignedAgentId !== agent.id) return false;
        }
        const matchesSearch =
            opportunity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            opportunity.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            opportunity.description.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(opportunity.status);

        return matchesSearch && matchesStatus;
    });

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

    const totalAmount = filteredOpportunities.reduce((sum, opp) => sum + opp?.prospect?.amount, 0)
    const wonAmount = filteredOpportunities
        .filter((opp) => opp.status === "Closed as Won")
        .reduce((sum, opp) => sum + opp.prospect?.amount, 0)

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
                    <div>
                        <h1 className="text-3xl font-bold">Opportunity Management</h1>
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
                                                <TableRow key={opportunity.id} className="cursor-pointer">
                                                    <TableCell className="max-w-[150px] truncate" onClick={() => router.push(`/sales/opportunites/${opportunity.id}`)}>{opportunity?.prospect?.name}</TableCell>
                                                    <TableCell onClick={() => router.push(`/sales/opportunites/${opportunity.id}`)}>{normalizePhoneNumber(opportunity.prospect.phoneNumber!, opportunity.prospect.dialCode).internationalNumber || "N/A"}</TableCell>
                                                    <TableCell className="max-w-[300px] truncate" onClick={() => router.push(`/sales/opportunites/${opportunity.id}`)}>{opportunity.description}</TableCell>
                                                    <TableCell className="font-semibold" onClick={() => router.push(`/sales/opportunites/${opportunity.id}`)}>{formatCurrency(opportunity?.prospect.amount)}</TableCell>
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
                                                                <DropdownMenuItem onClick={() => router.push(`/sales/opportunites/${opportunity.id}`)}>
                                                                    < Eye className="mr-2 h-4 w-4" />
                                                                    View
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => router.push(`/sales/prospects/${opportunity.prospectId}/edit`)}>
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
        </div >
    )
}
