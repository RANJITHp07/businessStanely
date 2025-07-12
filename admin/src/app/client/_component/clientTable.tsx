"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
    User,
    Building2,
    Phone,
    Mail,
    Calendar,
    MapPin,
} from "lucide-react"
import Link from "next/link"

// Mock data for clients
const mockClients = [
    {
        id: "1",
        clientType: "individual",
        firstName: "John",
        lastName: "Anderson",
        organizationName: "",
        email: "john.anderson@email.com",
        phoneNumber: "+1 (555) 123-4567",
        secondaryPhoneNumber: "+1 (555) 123-4568",
        address: "123 Main St, New York, NY 10001",
        preferredCommunication: "email",
        gender: "male",
        dateOfBirth: "1985-03-15",
        idProofType: "passport",
        idProofNumber: "P123456789",
        registrationNumber: "",
        entityType: "",
        gstNumber: "",
        status: "Active",
        createdDate: "2024-01-15",
        totalCases: 3,
        lastContact: "2024-01-20",
    },
    {
        id: "2",
        clientType: "organization",
        firstName: "",
        lastName: "",
        organizationName: "Acme Corporation",
        email: "contact@acme.com",
        phoneNumber: "+1 (555) 234-5678",
        secondaryPhoneNumber: "",
        address: "456 Business Ave, Los Angeles, CA 90210",
        preferredCommunication: "phone",
        gender: "",
        dateOfBirth: "",
        idProofType: "",
        idProofNumber: "",
        registrationNumber: "REG123456",
        entityType: "corporation",
        gstNumber: "GST123456789",
        authorizedPersonName: "Sarah Johnson",
        designation: "CEO",
        incorporationDate: "2020-05-10",
        status: "Active",
        createdDate: "2024-01-10",
        totalCases: 8,
        lastContact: "2024-01-22",
    },
    {
        id: "3",
        clientType: "individual",
        firstName: "Emily",
        lastName: "Davis",
        organizationName: "",
        email: "emily.davis@email.com",
        phoneNumber: "+1 (555) 345-6789",
        secondaryPhoneNumber: "",
        address: "789 Oak Street, Chicago, IL 60601",
        preferredCommunication: "sms",
        gender: "female",
        dateOfBirth: "1990-07-22",
        idProofType: "drivers-license",
        idProofNumber: "DL987654321",
        registrationNumber: "",
        entityType: "",
        gstNumber: "",
        status: "Active",
        createdDate: "2024-01-18",
        totalCases: 1,
        lastContact: "2024-01-19",
    },
    {
        id: "4",
        clientType: "organization",
        firstName: "",
        lastName: "",
        organizationName: "TechStart Inc.",
        email: "info@techstart.com",
        phoneNumber: "+1 (555) 456-7890",
        secondaryPhoneNumber: "+1 (555) 456-7891",
        address: "321 Innovation Drive, San Francisco, CA 94105",
        preferredCommunication: "email",
        gender: "",
        dateOfBirth: "",
        idProofType: "",
        idProofNumber: "",
        registrationNumber: "REG789012",
        entityType: "llc",
        gstNumber: "GST987654321",
        authorizedPersonName: "Michael Chen",
        designation: "CTO",
        incorporationDate: "2022-03-18",
        status: "Active",
        createdDate: "2024-01-12",
        totalCases: 5,
        lastContact: "2024-01-21",
    },
    {
        id: "5",
        clientType: "individual",
        firstName: "Robert",
        lastName: "Williams",
        organizationName: "",
        email: "robert.williams@email.com",
        phoneNumber: "+1 (555) 567-8901",
        secondaryPhoneNumber: "",
        address: "654 Pine Avenue, Miami, FL 33101",
        preferredCommunication: "phone",
        gender: "male",
        dateOfBirth: "1978-11-05",
        idProofType: "national-id",
        idProofNumber: "NID456789123",
        registrationNumber: "",
        entityType: "",
        gstNumber: "",
        status: "Inactive",
        createdDate: "2023-12-20",
        totalCases: 2,
        lastContact: "2023-12-25",
    },
    {
        id: "6",
        clientType: "organization",
        firstName: "",
        lastName: "",
        organizationName: "Global Enterprises",
        email: "contact@global.com",
        phoneNumber: "+1 (555) 678-9012",
        secondaryPhoneNumber: "+1 (555) 678-9013",
        address: "987 Corporate Blvd, Houston, TX 77001",
        preferredCommunication: "email",
        gender: "",
        dateOfBirth: "",
        idProofType: "",
        idProofNumber: "",
        registrationNumber: "REG345678",
        entityType: "corporation",
        gstNumber: "GST456789012",
        authorizedPersonName: "Lisa Thompson",
        designation: "President",
        incorporationDate: "2018-09-12",
        status: "Active",
        createdDate: "2024-01-08",
        totalCases: 12,
        lastContact: "2024-01-23",
    },
    {
        id: "7",
        clientType: "individual",
        firstName: "Jennifer",
        lastName: "Martinez",
        organizationName: "",
        email: "jennifer.martinez@email.com",
        phoneNumber: "+1 (555) 789-0123",
        secondaryPhoneNumber: "",
        address: "147 Elm Street, Boston, MA 02101",
        preferredCommunication: "in-person",
        gender: "female",
        dateOfBirth: "1992-04-18",
        idProofType: "passport",
        idProofNumber: "P987654321",
        registrationNumber: "",
        entityType: "",
        gstNumber: "",
        status: "Active",
        createdDate: "2024-01-25",
        totalCases: 1,
        lastContact: "2024-01-26",
    },
    {
        id: "8",
        clientType: "organization",
        firstName: "",
        lastName: "",
        organizationName: "MedCare Solutions",
        email: "admin@medcare.com",
        phoneNumber: "+1 (555) 890-1234",
        secondaryPhoneNumber: "",
        address: "258 Health Plaza, Seattle, WA 98101",
        preferredCommunication: "phone",
        gender: "",
        dateOfBirth: "",
        idProofType: "",
        idProofNumber: "",
        registrationNumber: "REG901234",
        entityType: "llc",
        gstNumber: "GST123789456",
        authorizedPersonName: "David Wilson",
        designation: "Managing Director",
        incorporationDate: "2021-11-30",
        status: "Active",
        createdDate: "2024-01-14",
        totalCases: 4,
        lastContact: "2024-01-24",
    },
]

const clientTypes = ["All Types", "Individual", "Organization"]
const statusOptions = ["All Status", "Active", "Inactive"]
const communicationPreferences = ["All Communication", "Email", "Phone", "SMS", "Mail", "In-Person"]
const entityTypes = ["All Entity Types", "Corporation", "LLC", "Partnership", "Sole Proprietorship", "Non-Profit"]

export default function ClientsTable() {
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedType, setSelectedType] = useState("All Types")
    const [selectedStatus, setSelectedStatus] = useState("All Status")
    const [selectedCommunication, setSelectedCommunication] = useState("All Communication")
    const [selectedEntityType, setSelectedEntityType] = useState("All Entity Types")
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(5)

    // Filter clients based on search and filters
    const filteredClients = mockClients.filter((client) => {
        const clientName =
            client.clientType === "individual" ? `${client.firstName} ${client.lastName}` : client.organizationName

        const matchesSearch =
            clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.address.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesType = selectedType === "All Types" || client.clientType === selectedType.toLowerCase()

        const matchesStatus = selectedStatus === "All Status" || client.status === selectedStatus

        const matchesCommunication =
            selectedCommunication === "All Communication" ||
            client.preferredCommunication === selectedCommunication.toLowerCase()

        const matchesEntityType =
            selectedEntityType === "All Entity Types" ||
            client.entityType === selectedEntityType.toLowerCase().replace(/\s+/g, "-")

        return matchesSearch && matchesType && matchesStatus && matchesCommunication && matchesEntityType
    })

    // Pagination logic
    const totalPages = Math.ceil(filteredClients.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentClients = filteredClients.slice(startIndex, endIndex)

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
        setSelectedStatus("All Status")
        setSelectedCommunication("All Communication")
        setSelectedEntityType("All Entity Types")
        setCurrentPage(1)
    }

    const getStatusBadge = (status: string) => {
        return <Badge variant={status === "Active" ? "default" : "secondary"}>{status}</Badge>
    }

    const getClientTypeBadge = (type: string) => {
        const colors = {
            individual: "bg-blue-100 text-blue-800 border-blue-200",
            organization: "bg-purple-100 text-purple-800 border-purple-200",
        }

        const icons = {
            individual: <User className="w-3 h-3 mr-1" />,
            organization: <Building2 className="w-3 h-3 mr-1" />,
        }

        return (
            <Badge className={`${colors[type as keyof typeof colors]} border`}>
                {icons[type as keyof typeof icons]}
                {type.charAt(0).toUpperCase() + type.slice(1)}
            </Badge>
        )
    }

    const getCommunicationBadge = (communication: string) => {
        const colors = {
            email: "bg-green-100 text-green-800",
            phone: "bg-blue-100 text-blue-800",
            sms: "bg-yellow-100 text-yellow-800",
            mail: "bg-gray-100 text-gray-800",
            "in-person": "bg-orange-100 text-orange-800",
        }

        return (
            <Badge className={colors[communication as keyof typeof colors] || "bg-gray-100 text-gray-800"}>
                {communication.charAt(0).toUpperCase() + communication.slice(1).replace("-", " ")}
            </Badge>
        )
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        })
    }

    const getClientDisplayName = (client: (typeof mockClients)[0]) => {
        return client.clientType === "individual" ? `${client.firstName} ${client.lastName}` : client.organizationName
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
            <div className="flex  flex-col md:flex-row  justify-between md:items-center  mb-6 md:mb-4">

                    <div>
                        <h1 className="text-3xl font-bold">Client Management</h1>
                        <p className="text-muted-foreground mt-2">Manage and organize your client details</p>
                    </div>
                    <Link href='/client/create' className="flex justify-end">
                    <Button className=" mt-[20px] md:mt-none   bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300">
                            <Plus className="h-4 w-4" />
                            Create Client
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
                        <CardDescription>Filter and search through your clients</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Search */}
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <Label htmlFor="search">Search Clients</Label>
                                <div className="relative my-2">
                                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="search"
                                        placeholder="Search by name, email, phone, or address..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Filter Controls */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label>Client Type</Label>
                                <Select value={selectedType} onValueChange={setSelectedType}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {clientTypes.map((type) => (
                                            <SelectItem key={type} value={type}>
                                                {type}
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

                            <div className="space-y-2">
                                <Label>Communication</Label>
                                <Select value={selectedCommunication} onValueChange={setSelectedCommunication}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {communicationPreferences.map((comm) => (
                                            <SelectItem key={comm} value={comm}>
                                                {comm}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Entity Type</Label>
                                <Select value={selectedEntityType} onValueChange={setSelectedEntityType}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {entityTypes.map((entity) => (
                                            <SelectItem key={entity} value={entity}>
                                                {entity}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                        </div>

                        {/* Results Summary */}
                        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                        <Button
  className="cursor-pointer bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 shadow-none hover:shadow-lg transition-shadow duration-300"
>
  Search
</Button>

<Button
  className="cursor-pointer hover:text-white text-white bg-[#f42b03] hover:bg-[#f42b03] rounded-lg px-4 py-2 shadow-none hover:shadow-lg transition-shadow duration-300"
  variant="outline"
>
  Clear
</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Clients Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Clients ({filteredClients.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Contact Info</TableHead>
                                    <TableHead>Communication</TableHead>
                                    <TableHead>Cases</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Last Contact</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {currentClients.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                            No clients found matching your criteria.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    currentClients.map((client) => (
                                        <TableRow key={client.id}>
                                            <TableCell>
                                                <div className="flex items-center space-x-3">
                                                    <Avatar className="h-10 w-10">
                                                        <AvatarFallback>
                                                            {client.clientType === "individual"
                                                                ? `${client.firstName[0]}${client.lastName[0]}`
                                                                : client.organizationName
                                                                    .split(" ")
                                                                    .map((n) => n[0])
                                                                    .join("")
                                                                    .slice(0, 2)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium">{getClientDisplayName(client)}</div>
                                                        <div className="text-sm text-muted-foreground">
                                                            {client.clientType === "organization" && client.authorizedPersonName && (
                                                                <>Contact: {client.authorizedPersonName}</>
                                                            )}
                                                            {client.clientType === "individual" && client.gender && (
                                                                <>{client.gender.charAt(0).toUpperCase() + client.gender.slice(1)}</>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>{getClientTypeBadge(client.clientType)}</TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1 text-sm">
                                                        <Mail className="h-3 w-3 text-muted-foreground" />
                                                        <span>{client.email}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-sm">
                                                        <Phone className="h-3 w-3 text-muted-foreground" />
                                                        <span>{client.phoneNumber}</span>
                                                    </div>
                                                    {client.address && (
                                                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                            <MapPin className="h-3 w-3" />
                                                            <span className="truncate max-w-[200px]">{client.address}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>{getCommunicationBadge(client.preferredCommunication)}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <span className="font-medium">{client.totalCases}</span>
                                                    <span className="text-sm text-muted-foreground">cases</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{getStatusBadge(client.status)}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-sm">{formatDate(client.lastContact)}</span>
                                                </div>
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
                                                        <DropdownMenuItem>
                                                            <Eye className="mr-2 h-4 w-4" />
                                                            View Details
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem>
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            Edit Client
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="text-destructive">
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Delete Client
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
