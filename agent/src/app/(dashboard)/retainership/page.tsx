"use client"

import { useState, useEffect } from "react"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import Link from "next/link"
import { toast } from "react-toastify"
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    CheckCircle,
    Clock,
    Edit,
    Eye,
    Filter,
    Loader2,
    MoreHorizontal,
    Plus,
    Search,
    Trash2,
    User,
    Building2,
    Phone,
    Mail,
    Calendar,
    AlertCircle,
    PlusCircle
} from "lucide-react"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog"
import {
    Avatar, AvatarFallback, AvatarImage
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter } from "next/navigation"
import { SectionTable, statusKey } from "../my-task/page"


// Updated the `DashboardRetainership` interface to include client details
interface DashboardRetainership {
    id: string;
    name: string;
    description: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    createdBy: {
        type: "User" | "Agent" | "Unknown";
        name: string;
    };
    client?: {
        id: string;
        name: string;
        email: string;
    };
    photo?: string;
    taskCount?: number;
}

export default function RetainershipTable() {
    const [retainerships, setRetainerships] = useState<DashboardRetainership[]>([])
    const [myLegislations, setMyLegislations] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("")
    // Removed unused sortBy and sortByDate state
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(20)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("my-retainerships")
    const [currentUserRole, setCurrentUserRole] = useState<string>("")

    const [myRetainerships, setMyRetainerships] = useState<DashboardRetainership[]>([]);
    const [triggerTask, setTriggerTask] = useState<any>([])
    const [myClients, setMyClients] = useState<DashboardRetainership[]>([]);

    const router = useRouter()

    // Get the current user's role from localStorage
    useEffect(() => {
        const userStr = localStorage.getItem("user")
        if (userStr) {
            try {
                const user = JSON.parse(userStr)
                const userRole = user.adminType || ""
                setCurrentUserRole(userRole)

                // No longer restrict pending tab for non-owners
                // We'll use the isOwner flag for controlling actions instead
            } catch (error) {
                console.error("Error parsing user data:", error)
            }
        }
    }, [activeTab])

    // State to store all retainerships for counting
    const [allRetainerships, setAllRetainerships] = useState<DashboardRetainership[]>([]);



    // Fetch retainerships and clients assigned to the agent
    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setLoading(true);

                const [
                    retainershipRes,
                    triggerRes,
                    clientsRes,
                    legislationsRes,
                ] = await Promise.all([
                    fetchWithAuth(`/api/tasks?retainershipTasks=true`),
                    fetchWithAuth(`/api/tasks?trigger=true`),
                    fetchWithAuth(`/api/clients?assignedToId=me`),
                    fetchWithAuth(`/api/legislation?assignedAgent=me`),
                ]);

                if (!retainershipRes.ok || !clientsRes.ok || !legislationsRes.ok) {
                    throw new Error("Failed to fetch dashboard data");
                }

                const [
                    retainershipData,
                    triggerData,
                    clientsData,
                    legislationsData,
                ] = await Promise.all([
                    retainershipRes.json(),
                    triggerRes.json(),
                    clientsRes.json(),
                    legislationsRes.json(),
                ]);

                setMyRetainerships(retainershipData.tasks || []);
                setTriggerTask(triggerData.tasks || [])
                setMyClients(clientsData || []);
                setMyLegislations(legislationsData || []);
                console.log(legislationsData)
            } catch (error) {
                setMyRetainerships([]);
                setMyClients([]);
                setMyLegislations([]);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);


    // Updated filtering logic to normalize status field for case-insensitive comparison
    const filteredRetainerships = (myLegislations || []).filter((retainership) => {
        const matchesSearch =
            !searchTerm || // Skip search filtering if searchTerm is empty
            (retainership.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
            (retainership.description?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
            (retainership.assignedAgent?.name?.toLowerCase() || "").includes(searchTerm.toLowerCase());


        return matchesSearch;
    });

    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(Number.parseInt(value))
        setCurrentPage(1)
    }
    // Sort by latest completed date first, then by creation date.
    const sortedRetainerships = [...filteredRetainerships].sort((a, b) => {
        const aCompleted = a.lastCompletedDate ? new Date(a.lastCompletedDate).getTime() : 0;
        const bCompleted = b.lastCompletedDate ? new Date(b.lastCompletedDate).getTime() : 0;

        if (bCompleted !== aCompleted) {
            return bCompleted - aCompleted;
        }

        const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bCreated - aCreated;
    })

    const resetFilters = () => {
        setSearchTerm("")
    }

    // Pagination logic
    const totalPages = Math.ceil(sortedRetainerships.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    // Explicitly type the retainership object in the component


    // Get counts for tabs from allRetainerships to always show correct counts

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

    const getClientDisplayName = (client: any) => {
        if (!client) return ""
        return client?.clientType === "individual" ? `${client.firstName} ${client.lastName}` : client.organizationName
    }

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    const isOverdue = (dueDate: string | undefined, status: string) => {
        if (!dueDate) return false;
        return new Date(dueDate) < new Date() && status !== "Completed";
    };

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
                    <div>
                        <h1 className="text-[28px] md:text-3xl font-bold">Task Retainership Management</h1>
                        <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
                            Manage and organize your task retainerships
                        </p>
                    </div>
                    {/* <Link href="/retainership/create" className="flex justify-end">
                        <Button className="mt-[20px] md:mt-none bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300">
                            <Plus className="h-4 w-4" />
                            Create Retainership
                        </Button>
                    </Link> */}
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Filter className="h-5 w-5" />
                            Filters & Search
                        </CardTitle>
                        <CardDescription>Filter and search through your task retainerships</CardDescription>
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
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <Label htmlFor="search">Search Retainerships</Label>
                                        <div className="relative my-1">
                                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="search"
                                                placeholder="Search by name, description, or creator..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="pl-10"
                                            />
                                        </div>
                                    </div>
                                </div>
                                {/* Results Summary */}
                                <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                                    <Button
                                        className="cursor-pointer hover:text-white text-white bg-[#f42b03] hover:bg-[#f42b03] rounded-lg px-4 py-2 shadow-none hover:shadow-lg transition-shadow duration-300"
                                        variant="outline"
                                        onClick={resetFilters}
                                    >
                                        Clear
                                    </Button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Retainerships Table with Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="approved" className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        My Legislation ({myLegislations.length})
                    </TabsTrigger>
                    <TabsTrigger value="my-retainerships" className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        My Task Retainer ({myRetainerships.length})
                    </TabsTrigger>
                    <TabsTrigger value="my-trigger" className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        My Task Trigger Retainer ({triggerTask.length})
                    </TabsTrigger>
                    <TabsTrigger value="my-clients" className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        My Clients - Retainership ({myClients.length})
                    </TabsTrigger>
                </TabsList>


                <TabsContent value="approved">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <CheckCircle className="h-5 w-5" />
                                    Legislations ({sortedRetainerships.length})
                                </CardTitle>
                                {/* <div className="flex items-center gap-2">
                                    <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                                    <Select value={sortBy} onValueChange={setSortBy}>
                                        <SelectTrigger className="md:w-32">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="a-z">A-Z</SelectItem>
                                            <SelectItem value="z-a">Z-A</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select value={sortByDate} onValueChange={setSortByDate}>
                                        <SelectTrigger className="md:w-32">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="newest">Newest</SelectItem>
                                            <SelectItem value="oldest">Oldest</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div> */}
                            </div>
                        </CardHeader>
                        {loading ? (
                            <div className="flex justify-center items-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <>
                                <CardContent>
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Client Name</TableHead>
                                                    <TableHead> Legislation Name</TableHead>
                                                    <TableHead>Last Completed Date</TableHead>
                                                    <TableHead>Tasks</TableHead>
                                                    <TableHead>Assigned Agent</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {sortedRetainerships?.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                            No legislation found for this retainership.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    sortedRetainerships?.map((legislation) => (
                                                        <TableRow
                                                            key={legislation.id}
                                                            onClick={() => router.push(`/legislation/${legislation.id}`)}
                                                            className="cursor-pointer hover:bg-muted/50"
                                                        >
                                                            <TableCell>
                                                                <div className="flex items-center space-x-3 max-w-56">
                                                                    <Avatar className="h-10 w-10 flex-shrink-0">
                                                                        <AvatarFallback>
                                                                            {legislation.retainership?.client?.clientType === "individual"
                                                                                ? `${legislation.retainership?.client.firstName?.[0] ?? ''}${legislation.retainership?.client.lastName?.[0] ?? ''}`
                                                                                : legislation.retainership?.client?.organizationName
                                                                                    ?.toUpperCase()
                                                                                    ?.split(" ")
                                                                                    .map((n) => n[0])
                                                                                    .join("")
                                                                                    .slice(0, 2)}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <div className="min-w-0">
                                                                        <div className="font-medium text-sm w-60 truncate">
                                                                            {getClientDisplayName(legislation.retainership?.client)
                                                                                ? getClientDisplayName(legislation.retainership?.client)!.length > 35
                                                                                    ? getClientDisplayName(legislation.retainership?.client)!.slice(0, 35) + '...'
                                                                                    : getClientDisplayName(legislation.retainership?.client)
                                                                                : 'N/A'
                                                                            }
                                                                        </div>
                                                                        <div className="text-xs text-muted-foreground truncate">
                                                                            {legislation.retainership?.client?.clientType === "organization" && legislation.retainership?.client?.authorizedPersonName && (
                                                                                <>Contact: {legislation.retainership?.client.authorizedPersonName.charAt(0).toUpperCase() + legislation.retainership?.client?.authorizedPersonName?.slice(1)}</>
                                                                            )}
                                                                            {legislation.retainership?.client?.clientType === "individual" && legislation.retainership?.client?.gender && (
                                                                                <>{legislation.retainership?.client?.gender.charAt(0).toUpperCase() + legislation.retainership?.client.gender.slice(1)}</>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                {legislation.title.length > 30
                                                                    ? legislation.title.slice(0, 42) + '...'
                                                                    : legislation.title
                                                                }
                                                            </TableCell>
                                                            <TableCell>
                                                                {formatDate(legislation.lastCompletedDate)}
                                                            </TableCell>
                                                            <TableCell className="flex flex-col gap-2">
                                                                <Badge>Total Task: {legislation.tasks?.length || 0}</Badge>
                                                                <Badge>
                                                                    Running Task: {legislation.tasks?.filter((t: any) => t.active && !t.completed && t.status !== "Hold").length || 0}
                                                                </Badge>
                                                                <Badge>
                                                                    Overdue Task: {legislation.tasks?.filter((t: any) => t.active && !t.completed && t.status !== "Hold" && t.dueDate && new Date(t.dueDate) < new Date()).length || 0}
                                                                </Badge>
                                                                <Badge>
                                                                    Pending Triggers: {legislation.tasks?.filter((t: any) => !t.active && !t.completed && t.status !== "Hold").length || 0}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell>{legislation.assignedAgent?.name || "Unknown"}</TableCell>
                                                            <TableCell className="text-right">
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                                                                            <span className="sr-only">Open menu</span>
                                                                            <MoreHorizontal className="h-4 w-4" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end">
                                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                        <DropdownMenuItem asChild>
                                                                            <a href={`/legislation/${legislation.id}`} onClick={(e) => e.stopPropagation()}>
                                                                                <Eye className="mr-2 h-4 w-4" />
                                                                                View Details
                                                                            </a>
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem asChild>
                                                                            <a
                                                                                href={`/task/create?legislationId=${legislation.id}&assignedAgent=${legislation.assignedAgent?.id}&client=${legislation?.retainership?.clientId}`}
                                                                                onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                                <PlusCircle className="mr-2 h-4 w-4" />
                                                                                Create Task
                                                                            </a>
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
                                        <div className="flex items-center justify-between space-x-2 py-4">
                                            <div className="text-sm text-muted-foreground">
                                                Page {currentPage} of {totalPages}
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Select
                                                    value={itemsPerPage.toString()}
                                                    onValueChange={handleItemsPerPageChange}
                                                >
                                                    <SelectTrigger className="w-24">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {[5, 10, 20, 50].map((value) => (
                                                            <SelectItem key={value} value={value.toString()}>
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
                                                >
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
                                                {Array.from(
                                                    { length: Math.min(5, totalPages) },
                                                    (_, i) => {
                                                        const pageNumber =
                                                            Math.max(
                                                                1,
                                                                Math.min(totalPages - 4, currentPage - 2)
                                                            ) + i;
                                                        if (pageNumber <= totalPages) {
                                                            return (
                                                                <Button
                                                                    key={pageNumber}
                                                                    variant={
                                                                        currentPage === pageNumber
                                                                            ? "default"
                                                                            : "outline"
                                                                    }
                                                                    size="sm"
                                                                    onClick={() => handlePageChange(pageNumber)}
                                                                >
                                                                    {pageNumber}
                                                                </Button>
                                                            );
                                                        }
                                                        return null;
                                                    }
                                                )}
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
                            </>
                        )}
                    </Card>
                </TabsContent>
                <TabsContent value="my-retainerships">

                    {loading ? (
                        <div className="flex justify-center items-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : myRetainerships.length === 0 ? (
                        <p className="text-center text-muted-foreground">No retainership task assigned to you.</p>
                    ) : (
                        <div className="">

                            <div className="space-y-3">
                                <SectionTable
                                    label="New Task"
                                    tasks={myRetainerships.filter((t) => ["todo"].includes(statusKey(t.status))).slice(0, 3)}
                                    retainershipTasks={true}
                                />
                                <SectionTable
                                    label="In Progress"
                                    tasks={myRetainerships.filter((t) => ["inprogress"].includes(statusKey(t.status))).slice(0, 3)}
                                    retainershipTasks={true}
                                />
                                <SectionTable
                                    label="Completed"
                                    tasks={myRetainerships.filter((t) => ["completed"].includes(statusKey(t.status))).slice(0, 3)}
                                    retainershipTasks={true}
                                />
                                <SectionTable
                                    label="Hold"
                                    tasks={myRetainerships.filter((t) => ["hold"].includes(statusKey(t.status))).slice(0, 3)}
                                    retainershipTasks={true}
                                />
                            </div>
                        </div>
                    )}
                </TabsContent>
                <TabsContent value="my-trigger">

                    {loading ? (
                        <div className="flex justify-center items-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : triggerTask.length === 0 ? (
                        <p className="text-center text-muted-foreground">No retainership task assigned to you.</p>
                    ) : (
                        <div className="">

                            <div className="space-y-3">
                                <SectionTable
                                    label="New Task"
                                    tasks={triggerTask.slice(0, 3)}
                                    trigger={true}
                                />
                            </div>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="my-clients">
                    <Card>
                        <CardHeader>
                            <CardTitle>My Clients - Retainership</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex justify-center items-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : myClients.length === 0 ? (
                                <p className="text-center text-muted-foreground">No clients assigned to you.</p>
                            ) : (
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="text-xs sm:text-sm">Client</TableHead>
                                                <TableHead className="text-xs sm:text-sm">Type</TableHead>
                                                <TableHead className="text-xs sm:text-sm">Contact Info</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {myClients.map((client: any) => (
                                                <TableRow key={client.id}>
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
                                                                <div className="font-medium text-sm truncate">
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
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs >
        </div >
    )
}
