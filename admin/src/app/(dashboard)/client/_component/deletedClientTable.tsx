"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    MoreHorizontal,
    Eye,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    User,
    Building2,
    Phone,
    Mail,
    Trash2,
} from "lucide-react"
import Link from "next/link"
import { useTablePage } from "@/hooks/useTablePage"

const clientTypes = ["All Types", "Individual", "Organization"]
const entityTypes = ["All Entity Types", "Corporation", "LLC", "Partnership", "Sole Proprietorship", "Non-Profit"]

interface DeletedClient {
    id: string
    clientType: string
    email: string
    phoneNumber: string
    firstName?: string | null
    lastName?: string | null
    gender?: string | null
    organizationName?: string | null
    authorizedPersonName?: string | null
    entityType?: string | null
    name: string
    deletedAt: string
    deletedByType?: string | null
    taskCount: number
    retainershipCount: number
}

/**
 * The deleted-clients list, rendered as a tab on the clients page and also at
 * /deleted-client, which re-exports it so existing links keep working.
 *
 * `onCountChange` reports the row count up to the clients page, which uses it
 * for the tab label. The fetch lives here rather than in the parent so the two
 * tabs stay independent.
 */
export default function DeletedClientTable({
    onCountChange,
    searchTerm = "",
    selectedType = "All Types",
    selectedEntityType = "All Entity Types",
}: {
    onCountChange?: (count: number) => void
    searchTerm?: string
    selectedType?: string
    selectedEntityType?: string
} = {}) {
    const [clients, setClients] = useState<DeletedClient[]>([])
    const [loading, setLoading] = useState(true)
    const { currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, clampToTotalPages } =
        useTablePage("admin-dashboard-deleted-client")

    const router = useRouter()

    useEffect(() => {
        const fetchDeletedClients = async () => {
            try {
                const response = await fetchWithAuth("/api/deleted-clients")
                if (response.ok) {
                    const rows = await response.json()
                    setClients(rows)
                    onCountChange?.(rows.length)
                } else {
                    console.error("Failed to fetch deleted clients")
                }
            } catch (error) {
                console.error("Error fetching deleted clients:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchDeletedClients()
        // onCountChange is only read inside the fetch; re-running on a new
        // function identity would refetch on every parent render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const filteredClients = clients.filter((client) => {
        const name = getClientDisplayName(client) || ""
        const matchesSearch =
            name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (client.phoneNumber || "").toLowerCase().includes(searchTerm.toLowerCase())

        const matchesType =
            selectedType === "All Types" || client.clientType.toLowerCase() === selectedType.toLowerCase()

        const matchesEntity =
            selectedEntityType === "All Entity Types" ||
            (client.entityType && client.entityType.toLowerCase() === selectedEntityType.toLowerCase())

        return matchesSearch && matchesType && matchesEntity
    })

    // Newest deletion first, which is the order the API already returns.
    const totalPages = Math.ceil(filteredClients.length / itemsPerPage)

    useEffect(() => {
        clampToTotalPages(totalPages)
    }, [totalPages, clampToTotalPages])
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

    const handleRowClick = (client: DeletedClient) => {
        router.push(`/deleted-client/${client.id}`)
    }

    function getClientDisplayName(client: DeletedClient) {
        return client.clientType === "individual"
            ? `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim()
            : client.organizationName
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

    const formatDeletedAt = (value: string) => {
        const date = new Date(value)
        return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString()
    }

    const getInitials = (client: DeletedClient) =>
        client.clientType === "individual"
            ? `${client.firstName?.[0] ?? ""}${client.lastName?.[0] ?? ""}`
            : client.organizationName
                ?.toUpperCase()
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)

    // The clients page owns the heading, the filters card and the tabs; this
    // renders the table only, filtered by the values passed in.
    return (
        <div className="w-full">
            <Card>
                {loading ? (
                    <CardContent className="p-3 sm:p-6">
                        <div className="h-[300px] w-full bg-gray-200 rounded-2xl"></div>
                    </CardContent>
                ) : (<>
                    <CardHeader>
                        <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                            <Trash2 className="h-5 w-5" />
                            Deleted Clients ({filteredClients.length})
                        </CardTitle>
                        <CardDescription className="text-sm">
                            Task and retainership counts are of records hidden together with the client
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="p-3 sm:p-6">
                        {/* Desktop Table View */}
                        <div className="hidden md:block rounded-md border overflow-hidden">
                            <Table className="w-full table-fixed">
                                <colgroup>
                                    <col className="w-[26%]" />
                                    <col className="w-[13%]" />
                                    <col className="w-[22%]" />
                                    <col className="w-[8%]" />
                                    <col className="w-[11%]" />
                                    <col className="w-[14%]" />
                                    <col className="w-[6%]" />
                                </colgroup>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs sm:text-sm">Client</TableHead>
                                        <TableHead className="text-xs sm:text-sm">Type</TableHead>
                                        <TableHead className="text-xs sm:text-sm">Contact Info</TableHead>
                                        <TableHead className="text-xs sm:text-sm">Tasks</TableHead>
                                        <TableHead className="text-xs sm:text-sm">Retainership</TableHead>
                                        <TableHead className="text-xs sm:text-sm">Deleted</TableHead>
                                        <TableHead className="text-xs sm:text-sm text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {currentClients.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">
                                                No deleted clients found matching your criteria.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        currentClients.map((client) => (
                                            <TableRow className="cursor-pointer hover:bg-muted/50" key={client.id} onClick={() => handleRowClick(client)}>
                                                <TableCell>
                                                    <div className="flex items-center space-x-3 ">
                                                        <Avatar className="h-10 w-10 flex-shrink-0">
                                                            <AvatarFallback>{getInitials(client)}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0">
                                                            <div className="font-medium text-sm truncate">{getClientDisplayName(client)}</div>
                                                            <div className="text-xs text-muted-foreground truncate">
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
                                                <TableCell>
                                                    <Badge className="bg-gray-200 text-black">{client.taskCount}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className="bg-gray-200 text-black">{client.retainershipCount}</Badge>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    <span className="block truncate" title={formatDeletedAt(client.deletedAt)}>
                                                        {formatDeletedAt(client.deletedAt)}
                                                    </span>
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
                                                            <DropdownMenuItem
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    router.push(`/deleted-client/${client.id}`)
                                                                }}
                                                            >
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                View Details
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
                        <div className="md:hidden border rounded-md overflow-hidden">
                            <Table className="w-full table-fixed">
                                <colgroup>
                                    <col className="w-[40%]" />
                                    <col className="w-[22%]" />
                                    <col className="w-[26%]" />
                                    <col className="w-[12%]" />
                                </colgroup>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs">Client</TableHead><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Deleted</TableHead><TableHead className="text-xs text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {currentClients.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-xs text-muted-foreground">
                                                No deleted clients found matching your criteria.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        currentClients.map((client) => (
                                            <TableRow className="cursor-pointer hover:bg-muted/50" key={client.id} onClick={() => handleRowClick(client)}>
                                                <TableCell>
                                                    <div className="flex items-center space-x-2">
                                                        <Avatar className="h-8 w-8 flex-shrink-0">
                                                            <AvatarFallback className="text-xs">{getInitials(client)}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0">
                                                            <div className="font-medium text-xs truncate">{getClientDisplayName(client)}</div>
                                                            <div className="text-xs text-muted-foreground truncate">{client.email}</div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs">{getClientTypeBadge(client.clientType)}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    <span className="block truncate" title={formatDeletedAt(client.deletedAt)}>
                                                        {formatDeletedAt(client.deletedAt)}
                                                    </span>
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
                                                                <Link href={`/deleted-client/${client.id}`}>
                                                                    <Eye className="mr-2 h-3 w-3" />
                                                                    <span className="text-xs">View Details</span>
                                                                </Link>
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
        </div>
    )
}
