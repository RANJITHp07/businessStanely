"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Filter, Plus, Search, Trash2, Users } from "lucide-react"
import ClientsTable, {
    clientTypes,
    communicationPreferences,
    entityTypes,
    statusOptions,
} from './_component/clientTable'
import DeletedClientTable from './_component/deletedClientTable'

/**
 * Active and deleted clients, laid out like the retainership page: heading, one
 * shared filters card, then the tabs.
 *
 * The filter state lives here so both lists read the same values. Status and
 * Communication are shown only on the active tab, because deleted rows are not
 * filtered on those fields.
 *
 * Each table still fetches its own rows and reports the count back for the tab
 * labels; those callbacks are memoised because the children watch them.
 */
function Client() {
    const [activeTab, setActiveTab] = useState("active")
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedType, setSelectedType] = useState("All Types")
    const [selectedStatus, setSelectedStatus] = useState("All Status")
    const [selectedCommunication, setSelectedCommunication] = useState("All Communication")
    const [selectedEntityType, setSelectedEntityType] = useState("All Entity Types")

    const [activeCount, setActiveCount] = useState<number | null>(null)
    const [deletedCount, setDeletedCount] = useState<number | null>(null)

    const handleActiveCount = useCallback((count: number) => setActiveCount(count), [])
    const handleDeletedCount = useCallback((count: number) => setDeletedCount(count), [])

    const resetFilters = () => {
        setSearchTerm("")
        setSelectedType("All Types")
        setSelectedStatus("All Status")
        setSelectedCommunication("All Communication")
        setSelectedEntityType("All Entity Types")
    }

    const label = (count: number | null) => (count === null ? "" : ` (${count})`)

    return (
        <div className="w-full container mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 max-w-7xl">
            <div className="mb-6 md:mb-8">
                <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-6">
                    <div>
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold break-words">
                            Client Management
                        </h1>
                        <p className="text-sm sm:text-base text-muted-foreground mt-2">
                            Manage and organize your client details
                        </p>
                    </div>
                    <Link href="/client/create" className="w-full md:w-auto">
                        <Button className="w-full md:w-auto bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 flex items-center justify-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300">
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
                        <div className="flex flex-col items-start gap-2 md:gap-4">
                            <div className="w-full">
                                <Label htmlFor="search" className="text-sm sm:text-base">Search Clients</Label>
                                <div className="relative mt-2">
                                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="search"
                                        placeholder="Search by name, email, phone..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10 text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Filter Controls */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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

                            {/* Deleted rows are not filtered on status or
                                communication, so these only show on the active tab. */}
                            {activeTab === "active" && (
                                <>
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
                                </>
                            )}

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

                        <div className="flex items-center justify-end gap-2 text-xs sm:text-sm text-muted-foreground">
                            <Button
                                onClick={resetFilters}
                                className="cursor-pointer hover:text-white text-white bg-[#f42b03] hover:bg-[#f42b03] rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm shadow-none hover:shadow-lg transition-shadow duration-300"
                                variant="outline"
                            >
                                Clear
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Clients Table with Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="active" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Clients{label(activeCount)}
                    </TabsTrigger>
                    <TabsTrigger value="deleted" className="flex items-center gap-2">
                        <Trash2 className="h-4 w-4" />
                        Deleted Clients{label(deletedCount)}
                    </TabsTrigger>
                </TabsList>

                {/* forceMount keeps each table's fetch and pagination alive when
                    the other tab is shown, so switching back does not refetch. */}
                <TabsContent value="active" forceMount className="data-[state=inactive]:hidden mt-0">
                    <ClientsTable
                        onCountChange={handleActiveCount}
                        searchTerm={searchTerm}
                        selectedType={selectedType}
                        selectedStatus={selectedStatus}
                        selectedCommunication={selectedCommunication}
                        selectedEntityType={selectedEntityType}
                    />
                </TabsContent>

                <TabsContent value="deleted" forceMount className="data-[state=inactive]:hidden mt-0">
                    <DeletedClientTable
                        onCountChange={handleDeletedCount}
                        searchTerm={searchTerm}
                        selectedType={selectedType}
                        selectedEntityType={selectedEntityType}
                    />
                </TabsContent>
            </Tabs>
        </div>
    )
}

export default Client
