"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Filter, Search } from "lucide-react"
import { clientTypes, entityTypes } from "../client/_component/clientTable"
import DeletedClientTable from "../client/_component/deletedClientTable"

/**
 * Deleted clients now live as a tab on the clients page. This route stays so
 * existing links — the deleted-client detail page's back button among them —
 * keep resolving. The shared table renders only filters and rows, so the
 * heading and container it used to own are supplied here.
 */
export default function DeletedClientsPage() {
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedType, setSelectedType] = useState("All Types")
    const [selectedEntityType, setSelectedEntityType] = useState("All Entity Types")

    const resetFilters = () => {
        setSearchTerm("")
        setSelectedType("All Types")
        setSelectedEntityType("All Entity Types")
    }

    return (
        <div className="w-full container mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 max-w-7xl">
            <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold break-words">
                        Deleted Clients
                    </h1>
                    <p className="text-sm sm:text-base text-muted-foreground mt-2">
                        Clients that were deleted, along with the tasks and retainerships hidden with them
                    </p>
                </div>
                <Link href="/client" className="w-full md:w-auto">
                    <Button
                        variant="outline"
                        className="w-full md:w-auto rounded-lg px-4 py-2 flex items-center justify-center gap-2 cursor-pointer"
                    >
                        Back to Clients
                    </Button>
                </Link>
            </div>

            {/* The shared table renders rows only, so this route supplies the
                same filters the clients page keeps above its tabs. */}
            <Card className="mb-6 md:mb-8">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filters & Search
                    </CardTitle>
                    <CardDescription>Filter and search through deleted clients</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
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

            <DeletedClientTable
                searchTerm={searchTerm}
                selectedType={selectedType}
                selectedEntityType={selectedEntityType}
            />
        </div>
    )
}
