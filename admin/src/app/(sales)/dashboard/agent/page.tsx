"use client";
import { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
} from "lucide-react";
import Link from "next/link";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const agentTypes = [
    "All Types",
    "Lead Maker",
    "Client Advisor",
    "Client Manager"
];
const jurisdictions = ["All Jurisdictions", "India", "USA", "UAE", "Others"];

import { Agent } from "@/types";

export default function AgentsTable() {
    const router = useRouter();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedType, setSelectedType] = useState("All Types");
    const [selectedJurisdiction, setSelectedJurisdiction] = useState("All Jurisdictions");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchAgents = async () => {
            try {
                const response = await fetchWithAuth("/api/agents");
                if (response.ok) {
                    const data = await response.json();
                    setAgents(data.filter((agent: Agent) => agent.agentRole === "Advisor Agent"));
                } else {
                    console.error("Failed to fetch agents");
                }
            } catch (error) {
                console.error("Error fetching agents:", error);
            }
            finally {
                setLoading(false);
            }
        };

        fetchAgents();
    }, []);

    // Filter agents based on search and filters
    const filteredAgents = agents.filter((agent) => {
        const matchesSearch =
            agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            agent.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            agent.specializations
                .join(", ")
                .toLowerCase()
                .includes(searchTerm.toLowerCase());

        const matchesType =
            selectedType === "All Types" || agent.agentType === selectedType;
        const matchesJurisdiction =
            selectedJurisdiction === "All Jurisdictions" ||
            agent.jurisdiction === selectedJurisdiction;

        return matchesSearch && matchesType && matchesJurisdiction;
    });

    // Apply sorting to filtered agents
    const sortedAgents = filteredAgents;

    const resetFilters = () => {
        setSearchTerm("");
        setSelectedType("All Types");
        setSelectedJurisdiction("All Jurisdictions");
    };

    // Pagination logic
    const totalPages = Math.ceil(sortedAgents.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentAgents = sortedAgents.slice(startIndex, endIndex);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(Number.parseInt(value));
        setCurrentPage(1);
    };

    const handleDelete = async () => {
        if (!agentToDelete) return;

        try {
            const response = await fetchWithAuth(`/api/agents/${agentToDelete.id}`, {
                method: "DELETE",
            });

            if (response.ok) {
                setAgents(agents.filter((agent) => agent.id !== agentToDelete.id));
                setAgentToDelete(null);
            } else {
                console.error("Failed to delete agent");
            }
        } catch (error) {
            console.error("Error deleting agent:", error);
        }
    };

    const getAgentTypeBadge = (type: string) => {
        const colors = {
            "Senior Partner": "bg-purple-100 text-purple-800",
            Partner: "bg-blue-100 text-blue-800",
            Associate: "bg-green-100 text-green-800",
            "Junior Associate": "bg-yellow-100 text-yellow-800",
            Paralegal: "bg-orange-100 text-orange-800",
            "Legal Assistant": "bg-gray-100 text-gray-800",
        };

        return (
            <Badge
                className={
                    colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800"
                }
            >
                {type}
            </Badge>
        );
    };

    return (
        <div className="w-full container mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 max-w-7xl">
            <div className="mb-6 md:mb-8">
                <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-6">
                    <div>
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold break-words">
                            Advisor Agent Management
                        </h1>
                        <p className="text-sm sm:text-base text-muted-foreground mt-2">
                            Manage and organize your legal team members
                        </p>
                    </div>
                    <Link href="/agent/create?agentRole=Advisor Agent" className="w-full md:w-auto">
                        <Button className="w-full md:w-auto bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 flex items-center justify-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300">
                            <Plus className="h-4 w-4" />
                            Create Agent
                        </Button>
                    </Link>
                </div>

                <Card>





                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Filter className="h-5 w-5" />
                            Filters & Search
                        </CardTitle>
                        <CardDescription>
                            Filter and search through your agents
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {loading ? (
                            <>
                                <div className="h-[200px] w-full bg-gray-200 rounded-2xl mb-4"></div>
                                <div className="flex flex-col md:flex-row justify-between gap-4">
                                    <div className="h-5 w-full md:w-1/2 bg-gray-200 rounded-xl mb-3"></div>
                                    <div className="h-5 w-full md:w-1/2 bg-gray-200 rounded-xl mb-3"></div>
                                </div></>
                        ) : (<>
                            {/* Search */}
                            <div className="flex flex-col items-start gap-2 md:gap-4">
                                <div className="w-full">
                                    <Label htmlFor="search" className="text-sm sm:text-base">Search Advisor Agents</Label>
                                    <div className="relative mt-2">
                                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="search"
                                            placeholder="Search by name, email..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-10 text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Filter Controls */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm sm:text-base">Agent Type</Label>
                                    <Select value={selectedType} onValueChange={setSelectedType}>
                                        <SelectTrigger className="w-full text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {agentTypes.map((type) => (
                                                <SelectItem key={type} value={type} className="text-sm">
                                                    {type}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-sm sm:text-base">Jurisdiction</Label>
                                    <Select
                                        value={selectedJurisdiction}
                                        onValueChange={setSelectedJurisdiction}
                                    >
                                        <SelectTrigger className="w-full text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {jurisdictions.map((jurisdiction) => (
                                                <SelectItem key={jurisdiction} value={jurisdiction} className="text-sm">
                                                    {jurisdiction}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Results Summary */}
                            <div className="flex items-center justify-end gap-2 text-xs sm:text-sm text-muted-foreground">
                                <Button
                                    className="cursor-pointer hover:text-white text-white bg-[#f42b03] hover:bg-[#f42b03] rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm shadow-none hover:shadow-lg transition-shadow duration-300"
                                    variant="outline"
                                    onClick={resetFilters}
                                >
                                    Clear
                                </Button>
                            </div> </>)}

                    </CardContent>
                </Card>
            </div>

            {/* Agents Table */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                            <Users className="h-5 w-5 flex-shrink-0" />
                            <span className="truncate">Advisor Agents ({sortedAgents.length})</span>
                        </CardTitle>
                    </div>
                </CardHeader>

                {loading ? (<div className="flex justify-center items-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
                ) : (<>
                    <CardContent className="p-3 sm:p-6">
                        {/* Desktop Table View */}
                        <div className="hidden md:block rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow isHeader>
                                        <TableHead className="text-xs sm:text-sm">Agent</TableHead>
                                        <TableHead className="text-xs sm:text-sm">Type</TableHead>
                                        <TableHead className="text-xs sm:text-sm">Specializations</TableHead>
                                        <TableHead className="text-xs sm:text-sm">Jurisdiction</TableHead>
                                        <TableHead className="text-xs sm:text-sm text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {currentAgents.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={5}
                                                className="text-center py-8 text-sm text-muted-foreground"
                                            >
                                                No agents found matching your criteria.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        currentAgents.map((agent) => {
                                            return (
                                                <TableRow
                                                    key={agent.id}
                                                    onClick={() => router.push(`/agent/${agent.id}?tab=tasks`)}
                                                    className="cursor-pointer hover:bg-muted/50"
                                                >
                                                    <TableCell>
                                                        <div className="flex items-center space-x-3">
                                                            <Avatar className="h-10 w-10 flex-shrink-0">
                                                                <AvatarImage src={agent.photo || ""} />
                                                                <AvatarFallback>
                                                                    {agent.name
                                                                        .toUpperCase()
                                                                        .split(" ")
                                                                        .map((n) => n[0])
                                                                        .join("")}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="min-w-0">
                                                                <div className="font-medium text-sm truncate">
                                                                    {agent.name.charAt(0).toUpperCase() + agent.name.slice(1)}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground truncate">
                                                                    {agent.email}
                                                                </div>
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
                                                    <TableCell className="text-sm">{agent.jurisdiction}</TableCell>
                                                    <TableCell
                                                        className="text-right"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
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
                                                                    <Link href={`/agent/${agent.id}`}>
                                                                        <Eye className="mr-2 h-4 w-4" />
                                                                        View Details
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem asChild>
                                                                    <Link href={`/agent/${agent.id}/edit`}>
                                                                        <Edit className="mr-2 h-4 w-4" />
                                                                        Edit Agent
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    className="text-destructive"
                                                                    onClick={() => setAgentToDelete(agent)}
                                                                >
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Delete Agent
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden border rounded-md overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow isHeader>
                                        <TableHead className="text-xs">Agent</TableHead>
                                        <TableHead className="text-xs">Type</TableHead>
                                        <TableHead className="text-xs">Specializations</TableHead>
                                        <TableHead className="text-xs text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {currentAgents.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={4}
                                                className="text-center py-8 text-xs text-muted-foreground"
                                            >
                                                No agents found matching your criteria.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        currentAgents.map((agent) => {
                                            return (
                                                <TableRow
                                                    key={agent.id}
                                                    onClick={() => router.push(`/agent/${agent.id}?tab=tasks`)}
                                                    className="cursor-pointer hover:bg-muted/50"
                                                >
                                                    <TableCell>
                                                        <div className="flex items-center space-x-2">
                                                            <Avatar className="h-8 w-8 flex-shrink-0">
                                                                <AvatarImage src={agent.photo || ""} />
                                                                <AvatarFallback className="text-xs">
                                                                    {agent.name
                                                                        .toUpperCase()
                                                                        .split(" ")
                                                                        .map((n) => n[0])
                                                                        .join("")}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="min-w-0">
                                                                <div className="font-medium text-xs truncate">
                                                                    {agent.name.charAt(0).toUpperCase() + agent.name.slice(1)}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground truncate">
                                                                    {agent.email}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs">{getAgentTypeBadge(agent.agentType)}</TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-0.5">
                                                            {agent.specializations.slice(0, 1).map((spec) => (
                                                                <Badge key={spec} variant="outline" className="text-xs">
                                                                    {spec}
                                                                </Badge>
                                                            ))}
                                                            {agent.specializations.length > 1 && (
                                                                <Badge variant="outline" className="text-xs">
                                                                    +{agent.specializations.length - 1}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell
                                                        className="text-right"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
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
                                                                    <Link href={`/agent/${agent.id}`}>
                                                                        <Eye className="mr-2 h-3 w-3" />
                                                                        <span className="text-xs">View Details</span>
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem asChild>
                                                                    <Link href={`/agent/${agent.id}/edit`}>
                                                                        <Edit className="mr-2 h-3 w-3" />
                                                                        <span className="text-xs">Edit Agent</span>
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    className="text-destructive text-xs"
                                                                    onClick={() => setAgentToDelete(agent)}
                                                                >
                                                                    <Trash2 className="mr-2 h-3 w-3" />
                                                                    Delete Agent
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
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
                                    <Select
                                        value={itemsPerPage.toString()}
                                        onValueChange={handleItemsPerPageChange}
                                    >
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
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePageChange(1)}
                                        disabled={currentPage === 1}
                                        className="text-xs"
                                    >
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

                                    {/* Page Numbers */}
                                    <div className="hidden sm:flex items-center gap-1">
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            const pageNumber =
                                                Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                                            if (pageNumber <= totalPages) {
                                                return (
                                                    <Button
                                                        key={pageNumber}
                                                        variant={
                                                            currentPage === pageNumber ? "default" : "outline"
                                                        }
                                                        size="sm"
                                                        onClick={() => handlePageChange(pageNumber)}
                                                        className="text-xs"
                                                    >
                                                        {pageNumber}
                                                    </Button>
                                                );
                                            }
                                            return null;
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
            <AlertDialog
                open={!!agentToDelete}
                onOpenChange={() => setAgentToDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the
                            agent and remove their data from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}