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

interface Prospect {
    id: string
    name: string
    phoneNumber: string
    description: string
    nextFollowUp?: string
    status: "New" | "In Progress"
}

const statuses = ["New", "In Progress"]

export default function ProspectsTable() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [prospects, setProspects] = useState<Prospect[]>([])
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
            const mockProspects: Prospect[] = [
                {
                    id: "1a2b3c",
                    name: "John Doe",
                    phoneNumber: "+1 234-567-8900",
                    description: "Interested in legal consultation for business setup",
                    nextFollowUp: "2025-01-20",
                    status: "New",
                },
                {
                    id: "4d5e6f",
                    name: "Jane Smith",
                    phoneNumber: "+1 234-567-8901",
                    description: "Needs assistance with contract review",
                    nextFollowUp: "2025-01-22",
                    status: "In Progress",
                },
                {
                    id: "7g8h9i",
                    name: "Bob Johnson",
                    phoneNumber: "+1 234-567-8902",
                    description: "Looking for trademark registration services",
                    nextFollowUp: "2025-01-18",
                    status: "New",
                },
                {
                    id: "0j1k2l",
                    name: "Alice Williams",
                    phoneNumber: "+1 234-567-8903",
                    description: "Requires immigration law assistance",
                    nextFollowUp: "2025-01-25",
                    status: "In Progress",
                },
            ]
            setProspects(mockProspects)
            setLoading(false)
        }, 500)
    }, [])

    const filteredProspects = prospects.filter((prospect) => {
        const matchesSearch =
            prospect.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            prospect.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            prospect.description.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(prospect.status)

        return matchesSearch && matchesStatus
    })

    const totalPages = Math.ceil(filteredProspects.length / itemsPerPage)
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
                        <h1 className="text-3xl font-bold">Prospects Management</h1>
                        <p className="text-muted-foreground mt-2">Manage and track all prospects</p>
                    </div>
                    <Button onClick={() => router.push("/sales/prospects/add")} className="mt-[20px] md:mt-none text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300">
                        <Plus className="h-4 w-4" />
                        Create Prospect
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
                                        <Label htmlFor="search">Search Prospects</Label>
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
                            </CardContent>
                        </>
                    )}
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Prospects ({filteredProspects.length})</CardTitle>
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
                                            <TableHead>Next Follow Up</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentProspects.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8">
                                                    No prospects found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            currentProspects.map((prospect) => (
                                                <TableRow key={prospect.id}>
                                                    <TableCell className="font-medium">{prospect.name}</TableCell>
                                                    <TableCell>{prospect.phoneNumber}</TableCell>
                                                    <TableCell className="max-w-[300px] truncate">{prospect.description}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                                            {formatDate(prospect.nextFollowUp)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
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
                                                                <DropdownMenuItem onClick={() => router.push("/sales/prospects/1")}>
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
            </Card>
        </div >
    )
}
