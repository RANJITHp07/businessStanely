"use client"
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2 } from "lucide-react"
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
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    User,
    Building2,
    Phone,
    Mail,
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


const clientTypes = ["All Types", "Individual", "Organization"]
const statusOptions = ["All Status", "Active", "Inactive"]
const communicationPreferences = ["All Communication", "Email", "Phone", "SMS", "Mail", "In-Person"]
const entityTypes = ["All Entity Types", "Corporation", "LLC", "Partnership", "Sole Proprietorship", "Non-Profit"]

import { Client } from "@/types";
import { useRouter } from "next/navigation"

export default function ClientsTable() {
    const [clients, setClients] = useState<Client[]>([]);
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedType, setSelectedType] = useState("All Types")
    const [selectedStatus, setSelectedStatus] = useState("All Status")
    const [selectedCommunication, setSelectedCommunication] = useState("All Communication")
    const [selectedEntityType, setSelectedEntityType] = useState("All Entity Types")
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(20)
    const [clientToDelete, setClientToDelete] = useState<Client | null>(null)
    const [loading, setLoading] = useState(true)

    const router = useRouter()

    const getStatusBadge = (status: string, count: number) => {
        return (
            <Badge key={status} className="bg-gray-200 text-black">
                {status.charAt(0).toUpperCase() + status.slice(1)}: {count}
            </Badge>
        );
    };

    useEffect(() => {
        const fetchClients = async () => {
            try {
                const response = await fetchWithAuth('/api/clients');
                if (response.ok) {
                    const data = await response.json();
                    setClients(data);
                } else {
                    console.error("Failed to fetch clients");
                }
            } catch (error) {
                console.error("Error fetching clients:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchClients();
    }, []);

    // Sort function
    const sortClients = (clients: Client[], sortBy: string) => {
        return [...clients].sort((a, b) => {
            if (sortBy === "a-z") {
                const nameA = a.clientType === "individual" ? `${a.firstName} ${a.lastName}` : a.organizationName || '';
                const nameB = b.clientType === "individual" ? `${b.firstName} ${b.lastName}` : b.organizationName || '';
                return nameA.localeCompare(nameB);
            } else if (sortBy === "z-a") {
                const nameA = a.clientType === "individual" ? `${a.firstName} ${a.lastName}` : a.organizationName || '';
                const nameB = b.clientType === "individual" ? `${b.firstName} ${b.lastName}` : b.organizationName || '';
                return nameB.localeCompare(nameA);
            }

            return 0;
        });
    }

    // Filter clients based on search and filters
    const filteredClients = clients.filter((client) => {
        const clientName =
            client.clientType === "individual" ? `${client.firstName} ${client.lastName}` : client.organizationName

        const matchesSearch =
            (clientName && clientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (client.phoneNumber && client.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (client.address && client.address.toLowerCase().includes(searchTerm.toLowerCase()))

        const matchesType = selectedType === "All Types" || client.clientType === selectedType.toLowerCase()

        const matchesCommunication =
            selectedCommunication === "All Communication" ||
            (client.preferredCommunication && client.preferredCommunication.toLowerCase() === selectedCommunication.toLowerCase())

        return matchesSearch && matchesType && matchesCommunication
    })

    // Apply sorting to filtered clients
    const sortedClients = sortClients(filteredClients, "a-z")

    // Pagination logic
    const totalPages = Math.ceil(sortedClients.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentClients = sortedClients.slice(startIndex, endIndex)

    const handlePageChange = (page: number) => {
        setCurrentPage(page)
    }

    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(Number.parseInt(value))
        setCurrentPage(1)
    }

    const resetFilters = () => {
        setSearchTerm("");
        setSelectedType("All Types");
        setSelectedStatus("All Status");
        setSelectedCommunication("All Communication")
        setSelectedEntityType("All Entity Types")
    };


    const handleDelete = async () => {
        if (!clientToDelete) return

        try {
            const response = await fetchWithAuth(`/api/clients/${clientToDelete.id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setClients(clients.filter((client) => client.id !== clientToDelete.id));
                setClientToDelete(null);
            } else {
                console.error("Failed to delete client");
            }
        } catch (error) {
            console.error("Error deleting client:", error);
        }
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

    const getClientDisplayName = (client: Client) => {
        return client.clientType === "individual" ? `${client.firstName} ${client.lastName}` : client.organizationName
    }

    return (
        <div className="w-full container mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 max-w-7xl">
            <div className="mb-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6 md:mb-4">

                    <div>
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold break-words">Client Management</h1>
                        <p className="text-sm sm:text-base text-muted-foreground mt-2">Manage and organize your client details</p>
                    </div>
                    <Link href='/client/create' className="w-full md:w-auto">
                        <Button className="w-full md:w-auto bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300 justify-center">
                            <Plus className="h-4 w-4" />
                            Create Client
                        </Button>
                    </Link>
                </div>

                {/* Filters */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                            <Filter className="h-5 w-5 flex-shrink-0" />
                            <span className="truncate">Filters & Search</span>
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm">Filter and search through your clients</CardDescription>
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
                                {/* Search */}
                                <div className="flex flex-col items-start gap-2 md:gap-4">
                                    <div className="w-full">
                                        <Label htmlFor="search" className="text-sm sm:text-base">Search Clients</Label>
                                        <div className="relative mt-2">
                                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="search"
                                                placeholder="Search by name, email, phone, or address..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="pl-10 text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Filter Controls */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                                    {/* Client Type */}
                                    <div className="space-y-2">
                                        <Label className="text-sm sm:text-base">Client Type</Label>
                                        <Select value={selectedType} onValueChange={setSelectedType}>
                                            <SelectTrigger className="w-full text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {clientTypes.map((type) => (
                                                    <SelectItem key={type} value={type} className="text-sm">
                                                        {type}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Status */}
                                    <div className="space-y-2">
                                        <Label className="text-sm sm:text-base">Status</Label>
                                        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                            <SelectTrigger className="w-full text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {statusOptions.map((status) => (
                                                    <SelectItem key={status} value={status} className="text-sm">
                                                        {status}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Communication */}
                                    <div className="space-y-2">
                                        <Label className="text-sm sm:text-base">Communication</Label>
                                        <Select value={selectedCommunication} onValueChange={setSelectedCommunication}>
                                            <SelectTrigger className="w-full text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {communicationPreferences.map((comm) => (
                                                    <SelectItem key={comm} value={comm} className="text-sm">
                                                        {comm}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Entity Type */}
                                    <div className="space-y-2">
                                        <Label className="text-sm sm:text-base">Entity Type</Label>
                                        <Select value={selectedEntityType} onValueChange={setSelectedEntityType}>
                                            <SelectTrigger className="w-full text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {entityTypes.map((entity) => (
                                                    <SelectItem key={entity} value={entity} className="text-sm">
                                                        {entity}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Results Summary */}
                                <div className="flex items-center justify-end gap-2 text-xs sm:text-sm text-muted-foreground">
                                    <Button
                                        onClick={resetFilters}
                                        className="cursor-pointer hover:text-white text-white bg-[#f42b03] hover:bg-[#f42b03] rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm shadow-none hover:shadow-lg transition-shadow duration-300"
                                        variant="outline"
                                    >
                                        Clear
                                    </Button>
                                </div>
                            </>
                        )}
                    </CardContent>



                </Card>
            </div>

            {/* Clients Table */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                            <Users className="h-5 w-5 flex-shrink-0" />
                            <span className="truncate">Clients ({sortedClients.length})</span>
                        </CardTitle>
                    </div>
                </CardHeader>


                {loading ? (<div className="flex justify-center items-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>) : (<>
                    <CardContent className="p-3 sm:p-6">
                        {/* Desktop Table View */}
                        <div className="hidden md:block rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs sm:text-sm">Client</TableHead>
                                        <TableHead className="text-xs sm:text-sm">Type</TableHead>
                                        <TableHead className="text-xs sm:text-sm">Contact Info</TableHead>
                                        <TableHead className="text-xs sm:text-sm">Communication</TableHead>
                                        <TableHead className="text-xs sm:text-sm text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {currentClients.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">
                                                No clients found matching your criteria.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        currentClients.map((client) => (
                                            <TableRow className="cursor-pointer hover:bg-muted/50" key={client.id} onClick={() => router.push(`/client/${client.id}/edit`)}>
                                                <TableCell>
                                                    <div className="flex items-center space-x-3">
                                                        <Avatar className="h-10 w-10 flex-shrink-0">
                                                            <AvatarFallback>
                                                                {client.clientType === "individual"
                                                                    ? `${client.firstName?.[0] ?? ''}${client.lastName?.[0] ?? ''}`
                                                                    : client.organizationName
                                                                        ?.toUpperCase()
                                                                        ?.split(" ")
                                                                        .map((n) => n[0])
                                                                        .join("")
                                                                        .slice(0, 2)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0">
                                                            <div className="font-medium text-sm w-60 truncate">
                                                                {getClientDisplayName(client)
                                                                    ? getClientDisplayName(client)!.length > 35
                                                                        ? getClientDisplayName(client)!.slice(0, 35) + '...'
                                                                        : getClientDisplayName(client)
                                                                    : 'N/A'
                                                                }
                                                            </div>                                                          <div className="text-xs text-muted-foreground truncate">
                                                                {client.clientType === "organization" && client.authorizedPersonName && (
                                                                    <>Contact: {client.authorizedPersonName.charAt(0).toUpperCase() + client?.authorizedPersonName?.slice(1)}</>
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
                                                        <div className="flex items-center gap-1 text-xs">
                                                            <Mail className="h-3 w-3 text-muted-foreground" />
                                                            <span className="truncate">{client.email}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 text-xs">
                                                            <Phone className="h-3 w-3 text-muted-foreground" />
                                                            <span className="truncate">{client.phoneNumber}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{getCommunicationBadge(client.preferredCommunication || "")}</TableCell>
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
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/client/${client.id}/edit`}>
                                                                    <Edit className="mr-2 h-4 w-4" />
                                                                    Edit Client
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="text-destructive"
                                                                onClick={() => setClientToDelete(client)}
                                                            >
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

                        {/* Mobile Table View */}
                        <div className="md:hidden border rounded-md overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs">Client</TableHead>
                                        <TableHead className="text-xs">Type</TableHead>
                                        <TableHead className="text-xs">Contact</TableHead>
                                        <TableHead className="text-xs text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {currentClients.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-xs text-muted-foreground">
                                                No clients found matching your criteria.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        currentClients.map((client) => (
                                            <TableRow className="cursor-pointer hover:bg-muted/50" key={client.id} onClick={() => router.push(`/client/${client.id}/edit`)}>
                                                <TableCell>
                                                    <div className="flex items-center space-x-2">
                                                        <Avatar className="h-8 w-8 flex-shrink-0">
                                                            <AvatarFallback className="text-xs">
                                                                {client.clientType === "individual"
                                                                    ? `${client.firstName?.[0] ?? ''}${client.lastName?.[0] ?? ''}`
                                                                    : client.organizationName
                                                                        ?.toUpperCase()
                                                                        ?.split(" ")
                                                                        .map((n) => n[0])
                                                                        .join("")
                                                                        .slice(0, 2)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0">
                                                            <div className="font-medium text-xs truncate">{getClientDisplayName(client)}</div>
                                                            <div className="text-xs text-muted-foreground truncate">
                                                                {client.clientType === "organization" && client.authorizedPersonName && (
                                                                    <>Contact: {client.authorizedPersonName.charAt(0).toUpperCase()}{client?.authorizedPersonName?.slice(1)}</>
                                                                )}
                                                                {client.clientType === "individual" && client.gender && (
                                                                    <>{client.gender.charAt(0).toUpperCase() + client.gender.slice(1)}</>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs">{getClientTypeBadge(client.clientType)}</TableCell>
                                                <TableCell>
                                                    <div className="space-y-0.5">
                                                        <div className="flex items-center gap-1 text-xs">
                                                            <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                                            <span className="truncate text-xs">{client.email}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 text-xs">
                                                            <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                                            <span className="truncate text-xs">{client.phoneNumber}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-7 w-7 p-0">
                                                                <span className="sr-only">Open menu</span>
                                                                <MoreHorizontal className="h-3 w-3" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/client/${client.id}/edit`}>
                                                                    <Edit className="mr-2 h-3 w-3" />
                                                                    <span className="text-xs">Edit Client</span>
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="text-destructive text-xs"
                                                                onClick={() => setClientToDelete(client)}
                                                            >
                                                                <Trash2 className="mr-2 h-3 w-3" />
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
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 pt-4 border-t">
                                <div className="text-xs sm:text-sm text-muted-foreground">
                                    Page {currentPage} of {totalPages}
                                </div>
                                <div className="flex items-center flex-wrap gap-2">
                                    <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                                        <SelectTrigger className="w-24 text-xs sm:text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[5, 10, 20, 50].map((value) => (
                                                <SelectItem key={value} value={value.toString()} className="text-xs sm:text-sm">
                                                    {value} / page
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button variant="outline" size="sm" onClick={() => handlePageChange(1)} disabled={currentPage === 1} className="text-xs">
                                        <ChevronsLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="text-xs"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>

                                    {/* Page Numbers - Hidden on mobile */}
                                    <div className="hidden sm:flex items-center gap-1">
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            const pageNumber = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
                                            if (pageNumber <= totalPages) {
                                                return (
                                                    <Button
                                                        key={pageNumber}
                                                        variant={currentPage === pageNumber ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => handlePageChange(pageNumber)}
                                                        className="text-xs"
                                                    >
                                                        {pageNumber}
                                                    </Button>
                                                )
                                            }
                                            return null
                                        })}
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        className="text-xs"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePageChange(totalPages)}
                                        disabled={currentPage === totalPages}
                                        className="text-xs"
                                    >
                                        <ChevronsRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </>)}




            </Card>
            <AlertDialog open={!!clientToDelete} onOpenChange={() => setClientToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the client and remove their data from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}