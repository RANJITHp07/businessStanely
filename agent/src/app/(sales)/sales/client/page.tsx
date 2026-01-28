"use client"
import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, MoreHorizontal, Edit, Filter, Search, Users, ChevronsLeft, ChevronRight, ChevronLeft, ChevronsRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter } from "next/navigation"


export default function StatusTable() {
    const router = useRouter()
    const [items, setItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedStatus, setSelectedStatus] = useState("All Status")
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(20)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch("/api/prospects/client")
                const data = await res.json()
                setItems(data.prospects)
            } catch (err) {
                console.error(err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    const filteredClients = items.filter((client) => {
        const matchesSearch =
            (client.name && client.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (client.phone && client.phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (client.address && client.address.toLowerCase().includes(searchTerm.toLowerCase()))

        const matchesType = (() => {
            if (selectedStatus === "Opportunity") {
                return client.status === "Converted"
            } else if (selectedStatus === "Prospect") {
                return client.status !== "Converted"
            } else {
                return true
            }
        })()

        return matchesSearch && matchesType
    })

    const totalPages = Math.ceil(filteredClients.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const currentClients = filteredClients.slice(startIndex, endIndex)

    const resetFilters = () => {
        setSearchTerm("");
        setSelectedStatus("All Status");
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page)
    }

    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(Number.parseInt(value))
        setCurrentPage(1)
    }

    return (
        <div className="w-full max-w-7xl mx-auto p-4">
            <div className="mb-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6 md:mb-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold break-words">Client Management</h1>
                        <p className="text-sm sm:text-base text-muted-foreground mt-2">Manage and organize your client details</p>
                    </div>
                </div>

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
                                <div className="flex flex-col items-start gap-2 md:gap-4">
                                    <div className="w-full">
                                        <Label htmlFor="search" className="text-sm sm:text-base">Search Clients</Label>
                                        <div className="relative mt-2">
                                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="search"
                                                placeholder="Search by name, email, phone, or address..."
                                                className="pl-10 text-sm"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                                {/* Status */}
                                <div className="space-y-2">
                                    <Label className="text-sm sm:text-base">Status</Label>
                                    <Select value={selectedStatus} onValueChange={setSelectedStatus} >
                                        <SelectTrigger className="w-full text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem key={"All Status"} value={"All Status"} className="text-sm">
                                                All Status
                                            </SelectItem>
                                            <SelectItem key={"Prospect"} value={"Prospect"} className="text-sm">
                                                Prospect
                                            </SelectItem>
                                            <SelectItem key={"Opportunity"} value={"Opportunity"} className="text-sm">
                                                Opportunity
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center justify-end gap-2 text-xs sm:text-sm text-muted-foreground">
                                    <Button onClick={() => resetFilters()} className="cursor-pointer hover:text-white text-white bg-[#f42b03] hover:bg-[#f42b03] rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm shadow-none hover:shadow-lg transition-shadow duration-300" variant="outline">
                                        Clear
                                    </Button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                            <Users className="h-5 w-5 flex-shrink-0" />
                            <span className="truncate">Clients ({filteredClients.length})</span>
                        </CardTitle>
                    </div>
                </CardHeader>

                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <CardContent className="p-3 sm:p-6">
                        <div className="hidden md:block rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Contact</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Lead Source</TableHead>
                                        <TableHead>Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {currentClients.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground bg-white">
                                                No items found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        currentClients.map(item => (
                                            <TableRow key={item.id} className="hover:bg-muted/50 cursor-pointer bg-white"
                                                onClick={() =>
                                                    router.push(
                                                        item.status === "Converted"
                                                            ? `/sales/opportunities/${item.opportunities.id}`
                                                            : `/sales/prospects/${item.id}`
                                                    )
                                                }
                                            >
                                                <TableCell>{item.name}</TableCell>
                                                <TableCell>{item.phoneNumber}</TableCell>
                                                <TableCell>{item.email}</TableCell>
                                                <TableCell>
                                                    <Badge className="bg-gray-200 text-black">
                                                        {item.status === "Converted" ? "Oppurtunity" : "Prospect"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{item?.leadSource?.name || "N/A"}</TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem asChild>
                                                                <Link href={item.status === "Converted" ? `/sales/opportunities/${item.opportunities.id}` : `/sales/prospects/${item.id}`}>
                                                                    <Edit className="mr-2 h-4 w-4" />
                                                                    View
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
                        </div>
                    </CardContent>
                )}
            </Card>
        </div >
    )
}
