"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
    Users,
    Plus,
    Search,
    Filter,
    MoreHorizontal,
    Edit,
    Trash2,
    Eye,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from "lucide-react"
import Link from "next/link"

// Mock data for agents
const mockAgents = [
    {
        id: "1",
        name: "John Smith",
        email: "john.smith@lawfirm.com",
        phone: "+1 (555) 123-4567",
        agentType: "Senior Partner",
        specializations: ["Corporate Law", "Tax Law"],
        jurisdiction: "New York",
        barAssociationId: "NY12345",
        teamSize: 8,
        status: "Active",
        joinDate: "2020-01-15",
        avatar: null,
    },
    {
        id: "2",
        name: "Sarah Johnson",
        email: "sarah.johnson@lawfirm.com",
        phone: "+1 (555) 234-5678",
        agentType: "Partner",
        specializations: ["Criminal Law", "Family Law"],
        jurisdiction: "California",
        barAssociationId: "CA67890",
        teamSize: 5,
        status: "Active",
        joinDate: "2021-03-22",
        avatar: null,
    },
    {
        id: "3",
        name: "Michael Brown",
        email: "michael.brown@lawfirm.com",
        phone: "+1 (555) 345-6789",
        agentType: "Associate",
        specializations: ["Real Estate Law"],
        jurisdiction: "Texas",
        barAssociationId: "TX11111",
        teamSize: 0,
        status: "Active",
        joinDate: "2022-06-10",
        avatar: null,
    },
    {
        id: "4",
        name: "Emily Davis",
        email: "emily.davis@lawfirm.com",
        phone: "+1 (555) 456-7890",
        agentType: "Junior Associate",
        specializations: ["Personal Injury", "Employment Law"],
        jurisdiction: "Florida",
        barAssociationId: "FL22222",
        teamSize: 0,
        status: "Active",
        joinDate: "2023-01-08",
        avatar: null,
    },
    {
        id: "5",
        name: "Robert Wilson",
        email: "robert.wilson@lawfirm.com",
        phone: "+1 (555) 567-8901",
        agentType: "Senior Partner",
        specializations: ["Immigration Law", "Healthcare Law"],
        jurisdiction: "Illinois",
        barAssociationId: "IL33333",
        teamSize: 12,
        status: "Active",
        joinDate: "2019-09-12",
        avatar: null,
    },
    {
        id: "6",
        name: "Jennifer Martinez",
        email: "jennifer.martinez@lawfirm.com",
        phone: "+1 (555) 678-9012",
        agentType: "Paralegal",
        specializations: ["Bankruptcy Law"],
        jurisdiction: "Pennsylvania",
        barAssociationId: "PA44444",
        teamSize: 0,
        status: "Inactive",
        joinDate: "2022-11-30",
        avatar: null,
    },
    {
        id: "7",
        name: "David Thompson",
        email: "david.thompson@lawfirm.com",
        phone: "+1 (555) 789-0123",
        agentType: "Partner",
        specializations: ["Intellectual Property", "Environmental Law"],
        jurisdiction: "Ohio",
        barAssociationId: "OH55555",
        teamSize: 7,
        status: "Active",
        joinDate: "2020-07-18",
        avatar: null,
    },
    {
        id: "8",
        name: "Lisa Anderson",
        email: "lisa.anderson@lawfirm.com",
        phone: "+1 (555) 890-1234",
        agentType: "Legal Assistant",
        specializations: ["Corporate Law"],
        jurisdiction: "Georgia",
        barAssociationId: "GA66666",
        teamSize: 0,
        status: "Active",
        joinDate: "2023-04-05",
        avatar: null,
    },
]

const agentTypes = [
    "All Types",
    "Senior Partner",
    "Partner",
    "Associate",
    "Junior Associate",
    "Paralegal",
    "Legal Assistant",
]
const jurisdictions = [
    "All Jurisdictions",
    "Federal",
    "New York",
    "California",
    "Texas",
    "Florida",
    "Illinois",
    "Pennsylvania",
    "Ohio",
    "Georgia",
]
const statusOptions = ["All Status", "Active", "Inactive"]

export default function AgentsTable() {
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedType, setSelectedType] = useState("All Types")
    const [selectedJurisdiction, setSelectedJurisdiction] = useState("All Jurisdictions")
    const [selectedStatus, setSelectedStatus] = useState("All Status")
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(5)

    // Filter agents based on search and filters
    const filteredAgents = mockAgents.filter((agent) => {
        const matchesSearch =
            agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            agent.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            agent.specializations.some((spec) => spec.toLowerCase().includes(searchTerm.toLowerCase()))

        const matchesType = selectedType === "All Types" || agent.agentType === selectedType
        const matchesJurisdiction =
            selectedJurisdiction === "All Jurisdictions" || agent.jurisdiction === selectedJurisdiction
        const matchesStatus = selectedStatus === "All Status" || agent.status === selectedStatus

        return matchesSearch && matchesType && matchesJurisdiction && matchesStatus
    })

    // Pagination logic
    const totalPages = Math.ceil(filteredAgents.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentAgents = filteredAgents.slice(startIndex, endIndex)

    const handlePageChange = (page: number) => {
        setCurrentPage(page)
    }

    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(Number.parseInt(value))
        setCurrentPage(1)
    }

    const clearFilters = () => {
        setSearchTerm("")
        setSelectedType("All Types")
        setSelectedJurisdiction("All Jurisdictions")
        setSelectedStatus("All Status")
        setCurrentPage(1)
    }

    const getStatusBadge = (status: string) => {
        return <Badge variant={status === "Active" ? "default" : "secondary"}>{status}</Badge>
    }

    const getAgentTypeBadge = (type: string) => {
        const colors = {
            "Senior Partner": "bg-purple-100 text-purple-800",
            Partner: "bg-blue-100 text-blue-800",
            Associate: "bg-green-100 text-green-800",
            "Junior Associate": "bg-yellow-100 text-yellow-800",
            Paralegal: "bg-orange-100 text-orange-800",
            "Legal Assistant": "bg-gray-100 text-gray-800",
        }

        return <Badge className={colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800"}>{type}</Badge>
    }

    return (
        <div className=" mx-auto p-6 max-w-10xl">
            <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-3xl font-bold">Agent Management</h1>
                        <p className="text-muted-foreground mt-2">Manage and organize your legal team members</p>
                    </div>
                    <Link href="/agent/create">
                        <Button className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Create Agent
                        </Button>
                    </Link>
                </div>

                {/* Filters */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Filter className="h-5 w-5" />
                            Filters & Search
                        </CardTitle>
                        <CardDescription>Filter and search through your agents</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Search */}
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <Label htmlFor="search">Search Agents</Label>
                                <div className="relative my-1">
                                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="search"
                                        placeholder="Search by name, email, or specialization..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Filter Controls */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Agent Type</Label>
                                <Select value={selectedType} onValueChange={setSelectedType}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {agentTypes.map((type) => (
                                            <SelectItem key={type} value={type}>
                                                {type}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Jurisdiction</Label>
                                <Select value={selectedJurisdiction} onValueChange={setSelectedJurisdiction}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent >
                                        {jurisdictions.map((jurisdiction) => (
                                            <SelectItem key={jurisdiction} value={jurisdiction}>
                                                {jurisdiction}
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
                                        {statusOptions.map((status) => (
                                            <SelectItem key={status} value={status}>
                                                {status}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Results Summary */}
                        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                            <Button>Search</Button>
                            <Button variant={'outline'}>Clear</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Agents Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Agents ({filteredAgents.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Agent</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Specializations</TableHead>
                                    <TableHead>Join Date</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {currentAgents.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                            No agents found matching your criteria.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    currentAgents.map((agent) => (
                                        <TableRow key={agent.id}>
                                            <TableCell>
                                                <div className="flex items-center space-x-3">
                                                    <Avatar className="h-10 w-10">
                                                        <AvatarImage src={agent.avatar || ""} />
                                                        <AvatarFallback>
                                                            {agent.name
                                                                .split(" ")
                                                                .map((n) => n[0])
                                                                .join("")}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium">{agent.name}</div>
                                                        <div className="text-sm text-muted-foreground">{agent.email}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>{getAgentTypeBadge(agent.agentType)}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {agent.specializations.slice(0, 2).map((spec) => (
                                                        <Badge key={spec} variant="outline" className="text-xs">
                                                            {spec}
                                                        </Badge>
                                                    ))}
                                                    {agent.specializations.length > 2 && (
                                                        <Badge variant="outline" className="text-xs">
                                                            +{agent.specializations.length - 2}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>{new Date(agent.joinDate).toLocaleDateString()}</TableCell>
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
                                                        <DropdownMenuItem>
                                                            <Eye className="mr-2 h-4 w-4" />
                                                            View Details
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem>
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            Edit Agent
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="text-destructive">
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Delete Agent
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

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between space-x-2 py-4">
                            <div className="text-sm text-muted-foreground">
                                Page {currentPage} of {totalPages}
                            </div>
                            <div className="flex items-center space-x-2">
                                <Button variant="outline" size="sm" onClick={() => handlePageChange(1)} disabled={currentPage === 1}>
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
            </Card>
        </div>
    )
}
