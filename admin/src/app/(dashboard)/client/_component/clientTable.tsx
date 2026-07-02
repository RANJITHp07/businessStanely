"use client"
import { useState, useEffect, useRef, type ClipboardEvent, type RefObject } from "react"
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
    NotebookPen,
    PlusCircle,
    Save,
    Bold,
    Italic,
    Underline,
    List,
    ListOrdered,
    Heading1,
    Heading2,
    Undo2,
    Eraser,
    CalendarIcon,
    Eye,
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"


const clientTypes = ["All Types", "Individual", "Organization"]
const statusOptions = ["All Status", "Active", "Inactive"]
const communicationPreferences = ["All Communication", "Email", "Phone", "SMS", "Mail", "In-Person"]
const entityTypes = ["All Entity Types", "Corporation", "LLC", "Partnership", "Sole Proprietorship", "Non-Profit"]

import { Client } from "@/types";
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

// Helper to get badge color for each status add more colors if you want 
const getStatusBadge = (status: string, count: number) => {
    return (
        <Badge key={status} className="bg-gray-200 text-black">
            {status.charAt(0).toUpperCase() + status.slice(1)}: {count}
        </Badge>
    );
};

type ClientDiaryEntry = {
    id: string;
    clientId: string;
    entryDate: string;
    content: string;
    createdAt: string;
    updatedAt: string;
};

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDiaryEntryDate = (rawDate: string) => {
    const trimmedDate = rawDate.trim();
    if (!trimmedDate) return "";

    if (DATE_ONLY_REGEX.test(trimmedDate)) {
        return trimmedDate;
    }

    const parsedDate = new Date(trimmedDate);
    if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().slice(0, 10);
    }

    return trimmedDate.includes("T") ? trimmedDate.split("T")[0] : trimmedDate;
};

const normalizeDiaryEntries = (entries: ClientDiaryEntry[]) => {
    return entries.map((entry) => ({
        ...entry,
        entryDate: normalizeDiaryEntryDate(entry.entryDate),
    }));
};

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
    const [isDiaryOpen, setIsDiaryOpen] = useState(false)
    const [selectedClientForDiary, setSelectedClientForDiary] = useState<Client | null>(null)
    const [selectedDiaryDate, setSelectedDiaryDate] = useState("")
    const [diaryEntries, setDiaryEntries] = useState<ClientDiaryEntry[]>([])
    const [isDiaryLoading, setIsDiaryLoading] = useState(false)
    const [isDiarySubmitting, setIsDiarySubmitting] = useState(false)
    const [isAddDiaryModalOpen, setIsAddDiaryModalOpen] = useState(false)
    const [isUpdateDiaryModalOpen, setIsUpdateDiaryModalOpen] = useState(false)
    const [isViewDiaryModalOpen, setIsViewDiaryModalOpen] = useState(false)
    const [selectedDiaryEntryForUpdate, setSelectedDiaryEntryForUpdate] = useState<ClientDiaryEntry | null>(null)
    const [selectedDiaryEntryForView, setSelectedDiaryEntryForView] = useState<ClientDiaryEntry | null>(null)
    const [addDiaryDraft, setAddDiaryDraft] = useState("")
    const [addDiaryDate, setAddDiaryDate] = useState<Date | undefined>(new Date())
    const [updateDiaryDraft, setUpdateDiaryDraft] = useState("")
    const [updateDiaryDate, setUpdateDiaryDate] = useState<Date | undefined>(new Date())
    const [isFilterCalendarOpen, setIsFilterCalendarOpen] = useState(false)
    const [isAddCalendarOpen, setIsAddCalendarOpen] = useState(false)
    const [isUpdateCalendarOpen, setIsUpdateCalendarOpen] = useState(false)
    const addDiaryEditorRef = useRef<HTMLDivElement>(null)
    const updateDiaryEditorRef = useRef<HTMLDivElement>(null)

    const router = useRouter()

    useEffect(() => {
        const fetchClients = async () => {
            try {
                const response = await fetch('/api/clients');
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

        const matchesEntity =
            selectedEntityType === "All Entity Types" ||
            (client.entityType && client.entityType.toLowerCase() === selectedEntityType.toLowerCase())

        return matchesSearch && matchesType && matchesCommunication && matchesEntity
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
        if (!clientToDelete) return;

        try {
            const response = await fetch(`/api/clients/${clientToDelete.id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setClients(clients.filter((client) => client.id !== clientToDelete.id));
                setClientToDelete(null);
                router.push('/client'); // Redirect to the client list page after deletion
            } else {
                console.error("Failed to delete client");
            }
        } catch (error) {
            console.error("Error deleting client:", error);
        }
    };

    // Prevent navigation for deleted clients
    const handleRowClick = (client: Client) => {
        if (!clients.find((c) => c.id === client.id)) {
            console.warn("Attempted to navigate to a deleted client.");
            return;
        }
        router.push(`/client/${client.id}/edit`);
    };

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

    const formatDateString = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const parseDateString = (dateString: string) => {
        if (!dateString) return undefined;
        const [year, month, day] = dateString.split("-").map(Number);
        if (!year || !month || !day) return undefined;
        return new Date(year, month - 1, day);
    };

    const openClientDiary = (client: Client) => {
        window.open(`/client/${client.id}/diary`, "_blank");
    };

    const fetchDiaryEntries = async (clientId: string, date?: string) => {
        setIsDiaryLoading(true);
        try {
            const query = date ? `?date=${encodeURIComponent(date)}` : "";
            const response = await fetch(`/api/clients/${clientId}/diary${query}`, {
                method: "GET",
                cache: "no-store",
            });

            if (!response.ok) {
                console.error("Failed to fetch diary entries");
                setDiaryEntries([]);
                return;
            }

            const data = await response.json();
            const entries = Array.isArray(data.entries) ? data.entries : [];
            setDiaryEntries(normalizeDiaryEntries(entries));
        } catch (error) {
            console.error("Error fetching diary entries:", error);
            setDiaryEntries([]);
        } finally {
            setIsDiaryLoading(false);
        }
    };

    useEffect(() => {
        if (!isDiaryOpen || !selectedClientForDiary?.id) return;
        fetchDiaryEntries(selectedClientForDiary.id, selectedDiaryDate || undefined);
    }, [isDiaryOpen, selectedClientForDiary?.id, selectedDiaryDate]);

    const diaryEntriesForSelection = diaryEntries
        .filter(
            (entry) =>
                entry.clientId === selectedClientForDiary?.id &&
                (!selectedDiaryDate || normalizeDiaryEntryDate(entry.entryDate) === selectedDiaryDate),
        )
        .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));

    const getDiaryPreviewText = (htmlContent: string) => {
        if (!htmlContent) return "";
        return htmlContent
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    };

    const runEditorCommand = (
        editorRef: RefObject<HTMLDivElement | null>,
        setDraft: (value: string) => void,
        command: string,
        value?: string,
    ) => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        document.execCommand(command, false, value);
        setDraft(editorRef.current.innerHTML);
    };

    const handleDiaryEditorInput = (
        editorRef: RefObject<HTMLDivElement | null>,
        setDraft: (value: string) => void,
    ) => {
        if (!editorRef.current) return;
        setDraft(editorRef.current.innerHTML);
    };

    const handleDiaryEditorPaste = (event: ClipboardEvent<HTMLDivElement>) => {
        event.preventDefault();
        const text = event.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
    };

    useEffect(() => {
        if (!addDiaryEditorRef.current) return;
        if (addDiaryEditorRef.current.innerHTML !== addDiaryDraft) {
            addDiaryEditorRef.current.innerHTML = addDiaryDraft;
        }
    }, [addDiaryDraft]);

    useEffect(() => {
        if (!isUpdateDiaryModalOpen) return;

        const rafId = requestAnimationFrame(() => {
            if (!updateDiaryEditorRef.current) return;
            if (updateDiaryEditorRef.current.innerHTML !== updateDiaryDraft) {
                updateDiaryEditorRef.current.innerHTML = updateDiaryDraft;
            }
        });

        return () => cancelAnimationFrame(rafId);
    }, [isUpdateDiaryModalOpen, updateDiaryDraft, selectedDiaryEntryForUpdate?.id]);

    const openAddDiaryModal = () => {
        setAddDiaryDraft("");
        setAddDiaryDate(new Date());
        setIsAddDiaryModalOpen(true);
    };

    const openUpdateDiaryModal = (entry: ClientDiaryEntry) => {
        setSelectedDiaryEntryForUpdate(entry);
        setUpdateDiaryDraft(entry.content || "");
        setUpdateDiaryDate(parseDateString(normalizeDiaryEntryDate(entry.entryDate)));
        setIsUpdateDiaryModalOpen(true);
    };

    const openViewDiaryModal = (entry: ClientDiaryEntry) => {
        setSelectedDiaryEntryForView(entry);
        setIsViewDiaryModalOpen(true);
    };

    const handleCreateDiaryEntry = async () => {
        const normalizedDraft = getDiaryPreviewText(addDiaryDraft);
        if (!selectedClientForDiary || !normalizedDraft || !addDiaryDate) return;

        setIsDiarySubmitting(true);
        try {
            const response = await fetch(`/api/clients/${selectedClientForDiary.id}/diary`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    entryDate: formatDateString(addDiaryDate),
                    content: addDiaryDraft,
                }),
            });

            if (!response.ok) {
                console.error("Failed to create diary entry");
                return;
            }

            setAddDiaryDraft("");
            setSelectedDiaryDate(formatDateString(addDiaryDate));
            setIsAddDiaryModalOpen(false);
            await fetchDiaryEntries(selectedClientForDiary.id, formatDateString(addDiaryDate));
        } catch (error) {
            console.error("Error creating diary entry:", error);
        } finally {
            setIsDiarySubmitting(false);
        }
    };

    const handleUpdateDiaryEntry = async () => {
        const normalizedDraft = getDiaryPreviewText(updateDiaryDraft);
        if (!selectedDiaryEntryForUpdate || !selectedClientForDiary || !normalizedDraft || !updateDiaryDate) return;

        setIsDiarySubmitting(true);
        try {
            const response = await fetch(
                `/api/clients/${selectedClientForDiary.id}/diary/${selectedDiaryEntryForUpdate.id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        entryDate: formatDateString(updateDiaryDate),
                        content: updateDiaryDraft,
                    }),
                },
            );

            if (!response.ok) {
                console.error("Failed to update diary entry");
                return;
            }

            setSelectedDiaryDate(formatDateString(updateDiaryDate));
            setIsUpdateDiaryModalOpen(false);
            setSelectedDiaryEntryForUpdate(null);
            await fetchDiaryEntries(selectedClientForDiary.id, formatDateString(updateDiaryDate));
        } catch (error) {
            console.error("Error updating diary entry:", error);
        } finally {
            setIsDiarySubmitting(false);
        }
    };

    return (
        <div className="w-full container mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 max-w-7xl">
            <div className="mb-6 md:mb-8">
                <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-6">
                    <div>
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold break-words">Client Management</h1>
                        <p className="text-sm sm:text-base text-muted-foreground mt-2">Manage and organize your client details</p>
                    </div>
                    <Link href='/client/create' className="w-full md:w-auto">
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
                        {loading ? (
                            <>
                                <div className="h-[200px] w-full bg-gray-200 rounded-2xl mb-4"></div>

                                <div className="flex flex-col md:flex-row justify-between gap-4">
                                    <div className="h-5 w-full md:w-1/2 bg-gray-200 rounded-xl mb-3"></div>
                                    <div className="h-5 w-full md:w-1/2 bg-gray-200 rounded-xl mb-3"></div>
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
                                        <TableHead className="text-xs sm:text-sm">Tasks</TableHead>
                                        <TableHead className="text-xs sm:text-sm">Retainership</TableHead>
                                        <TableHead className="text-xs sm:text-sm text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {currentClients.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">
                                                No clients found matching your criteria.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        currentClients.map((client) => (
                                            <TableRow className="cursor-pointer hover:bg-muted/50" key={client.id} onClick={() => handleRowClick(client)}>
                                                <TableCell>
                                                    <div className="flex items-center space-x-3 ">
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
                                                        <div className="w-60">
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
                                                <TableCell>{getCommunicationBadge(client.preferredCommunication || "")}</TableCell>
                                                <TableCell>
                                                    {/* Task Status Badges */}
                                                    <div className="flex flex-col gap-1">
                                                        {client.statusCounts && Object.entries(client.statusCounts).length > 0 ? (
                                                            Object.entries(client.statusCounts).map(([status, count]) => getStatusBadge(status, count))
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">No tasks</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className="bg-gray-200 text-black">{(client as Client & { retainershipCount?: number })?.retainershipCount ?? 0}</Badge>
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
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/client/${client.id}/edit`}>
                                                                    <Edit className="mr-2 h-4 w-4" />
                                                                    Edit Client
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/client/${client.id}/tasks`}>
                                                                    <Eye className="mr-2 h-4 w-4" />
                                                                    View Tasks
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="text-destructive"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setClientToDelete(client);
                                                                }}
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Delete Client
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openClientDiary(client);
                                                                }}
                                                            >
                                                                <NotebookPen className="mr-2 h-4 w-4" />
                                                                Client Diary
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
                                        <TableHead className="text-xs">Client</TableHead><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Contact</TableHead><TableHead className="text-xs text-right">Actions</TableHead>
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
                                            <TableRow className="cursor-pointer hover:bg-muted/50" key={client.id} onClick={() => handleRowClick(client)}>
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
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/client/${client.id}/tasks`}>
                                                                    <Eye className="mr-2 h-3 w-3" />
                                                                    <span className="text-xs">View Tasks</span>
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
                                                            <DropdownMenuItem
                                                                className="text-xs"
                                                                onClick={() => openClientDiary(client)}
                                                            >
                                                                <NotebookPen className="mr-2 h-3 w-3" />
                                                                Client Diary
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

            <Dialog
                open={isDiaryOpen}
                onOpenChange={(open) => {
                    setIsDiaryOpen(open);
                    if (!open) {
                        setSelectedDiaryDate("");
                        setSelectedDiaryEntryForUpdate(null);
                        setSelectedDiaryEntryForView(null);
                        setAddDiaryDraft("");
                        setUpdateDiaryDraft("");
                    }
                }}
            >
                <DialogContent className="lg:w-[90vw] lg:max-w-[90vw] max-h-[90vh] items-start overflow-x-auto p-4 sm:p-6">
                    <DialogHeader className="">
                        <DialogTitle className="flex items-center gap-2">
                            <NotebookPen className="h-5 w-5" />
                            Client Diary
                        </DialogTitle>
                        <DialogDescription>
                            {selectedClientForDiary
                                ? `Diary for ${getClientDisplayName(selectedClientForDiary)}. Choose Add New or Update Existing.`
                                : "Select a client to manage diary notes."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="h-full min-h-0 border rounded-lg p-4 overflow-auto bg-slate-50/60 space-y-4">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                            <div className="space-y-2">
                                <Label>Filter by date</Label>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Popover open={isFilterCalendarOpen} onOpenChange={setIsFilterCalendarOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className={cn(
                                                    "w-[240px] justify-start text-left font-normal",
                                                    !selectedDiaryDate && "text-muted-foreground",
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {selectedDiaryDate
                                                    ? parseDateString(selectedDiaryDate)?.toLocaleDateString()
                                                    : "Select filter date"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <CalendarComponent
                                                mode="single"
                                                selected={selectedDiaryDate ? parseDateString(selectedDiaryDate) : undefined}
                                                onSelect={(date) => {
                                                    setSelectedDiaryDate(date ? formatDateString(date) : "");
                                                    setIsFilterCalendarOpen(false);
                                                }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setSelectedDiaryDate("")}
                                        disabled={!selectedDiaryDate}
                                    >
                                        All Dates
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {selectedDiaryDate ? `Showing entries for ${selectedDiaryDate}` : "Showing entries for all dates"}
                                </p>
                            </div>

                            <Button type="button" onClick={openAddDiaryModal} className="w-full lg:w-auto" disabled={isDiaryLoading || isDiarySubmitting}>
                                <PlusCircle className="h-4 w-4 mr-2" />
                                Add New Entry
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm">Entries ({diaryEntriesForSelection.length})</Label>
                            {isDiaryLoading ? (
                                <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground bg-white flex items-center justify-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading diary entries...
                                </div>
                            ) : diaryEntriesForSelection.length === 0 ? (
                                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground bg-white">
                                    {selectedDiaryDate
                                        ? "No diary entries for selected date. Use Add New Entry to create one."
                                        : "No diary entries found yet. Use Add New Entry to create your first one."}
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[58vh] overflow-auto pr-1">
                                    {diaryEntriesForSelection.map((entry, index) => (
                                        <div key={entry.id} className="rounded-md border p-3 bg-white">
                                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-xs text-muted-foreground">Date: {normalizeDiaryEntryDate(entry.entryDate)}</p>
                                                    <p className="text-xs text-muted-foreground">Entry {diaryEntriesForSelection.length - index}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Updated: {new Date(entry.updatedAt).toLocaleString()}
                                                    </p>
                                                    <p className="text-sm mt-2 line-clamp-3">{getDiaryPreviewText(entry.content)}</p>
                                                </div>
                                                <div className="flex w-full sm:w-auto flex-col gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full sm:w-auto"
                                                        onClick={() => openViewDiaryModal(entry)}
                                                    >
                                                        <Eye className="h-4 w-4 mr-2" />
                                                        View
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full sm:w-auto"
                                                        disabled={isDiarySubmitting}
                                                        onClick={() => openUpdateDiaryModal(entry)}
                                                    >
                                                        <Edit className="h-4 w-4 mr-2" />
                                                        Update Existing
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={() => setIsDiaryOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={isAddDiaryModalOpen}
                onOpenChange={(open) => {
                    setIsAddDiaryModalOpen(open);
                    if (!open) {
                        setAddDiaryDraft("");
                        setAddDiaryDate(new Date());
                    }
                }}
            >
                <DialogContent className="w-[90vw] lg:max-w-[90vw] max-h-[90vh] overflow-x-auto p-4 sm:p-6">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <PlusCircle className="h-5 w-5" />
                            Add New Diary Entry
                        </DialogTitle>
                        <DialogDescription>
                            Create a new rich text diary entry.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col min-h-0 h-full gap-3">
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="space-y-2">
                                <Label>Entry Date</Label>
                                <Popover open={isAddCalendarOpen} onOpenChange={setIsAddCalendarOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className={cn(
                                                "w-[240px] justify-start text-left font-normal",
                                                !addDiaryDate && "text-muted-foreground",
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {addDiaryDate ? addDiaryDate.toLocaleDateString() : "Select entry date"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <CalendarComponent
                                            mode="single"
                                            selected={addDiaryDate}
                                            onSelect={(date) => {
                                                setAddDiaryDate(date);
                                                setIsAddCalendarOpen(false);
                                            }}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 rounded-md border p-2 bg-muted/30">
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(addDiaryEditorRef, setAddDiaryDraft, "bold")}>
                                <Bold className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(addDiaryEditorRef, setAddDiaryDraft, "italic")}>
                                <Italic className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(addDiaryEditorRef, setAddDiaryDraft, "underline")}>
                                <Underline className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(addDiaryEditorRef, setAddDiaryDraft, "insertUnorderedList")}>
                                <List className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(addDiaryEditorRef, setAddDiaryDraft, "insertOrderedList")}>
                                <ListOrdered className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(addDiaryEditorRef, setAddDiaryDraft, "formatBlock", "<h1>")}>
                                <Heading1 className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(addDiaryEditorRef, setAddDiaryDraft, "formatBlock", "<h2>")}>
                                <Heading2 className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(addDiaryEditorRef, setAddDiaryDraft, "undo")}>
                                <Undo2 className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(addDiaryEditorRef, setAddDiaryDraft, "removeFormat")}>
                                <Eraser className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="relative flex-1 min-h-[420px] rounded-md border bg-background">
                            <div
                                ref={addDiaryEditorRef}
                                contentEditable
                                suppressContentEditableWarning
                                onInput={() => handleDiaryEditorInput(addDiaryEditorRef, setAddDiaryDraft)}
                                onPaste={handleDiaryEditorPaste}
                                className="h-full w-full overflow-auto p-4 text-sm leading-7 focus-visible:outline-none"
                            />
                            {!getDiaryPreviewText(addDiaryDraft) && (
                                <p className="pointer-events-none absolute left-4 top-4 text-sm text-muted-foreground">
                                    Write client diary notes here...
                                </p>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={() => setIsAddDiaryModalOpen(false)} disabled={isDiarySubmitting}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleCreateDiaryEntry} disabled={isDiarySubmitting || !getDiaryPreviewText(addDiaryDraft) || !addDiaryDate || !selectedClientForDiary}>
                            {isDiarySubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            {isDiarySubmitting ? "Saving..." : "Save Entry"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={isViewDiaryModalOpen}
                onOpenChange={(open) => {
                    setIsViewDiaryModalOpen(open);
                    if (!open) {
                        setSelectedDiaryEntryForView(null);
                    }
                }}
            >
                <DialogContent className="w-[90vw] lg:max-w-[90vw] max-h-[90vh] overflow-x-auto p-4 sm:p-6">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Eye className="h-5 w-5" />
                            View Diary Entry
                        </DialogTitle>
                        <DialogDescription>
                            {selectedDiaryEntryForView
                                ? `Date: ${normalizeDiaryEntryDate(selectedDiaryEntryForView.entryDate)} | Last updated: ${new Date(selectedDiaryEntryForView.updatedAt).toLocaleString()}`
                                : "Select a diary entry to view details."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-[260px] max-h-[62vh] overflow-auto rounded-md border bg-background p-4">
                        {selectedDiaryEntryForView ? (
                            <div
                                className="prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: selectedDiaryEntryForView.content || "" }}
                            />
                        ) : (
                            <p className="text-sm text-muted-foreground">No diary entry selected.</p>
                        )}
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={() => setIsViewDiaryModalOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={isUpdateDiaryModalOpen}
                onOpenChange={(open) => {
                    setIsUpdateDiaryModalOpen(open);
                    if (!open) {
                        setSelectedDiaryEntryForUpdate(null);
                        setUpdateDiaryDraft("");
                        setUpdateDiaryDate(new Date());
                    }
                }}
            >
                <DialogContent className="w-[90vw] lg:max-w-[90vw] max-h-[90vh] overflow-x-auto p-4 sm:p-6">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Edit className="h-5 w-5" />
                            Update Existing Entry
                        </DialogTitle>
                        <DialogDescription>
                            Edit content and date, then save updates.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col min-h-0 h-full gap-3">
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="space-y-2">
                                <Label>Entry Date</Label>
                                <Popover open={isUpdateCalendarOpen} onOpenChange={setIsUpdateCalendarOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className={cn(
                                                "w-[240px] justify-start text-left font-normal",
                                                !updateDiaryDate && "text-muted-foreground",
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {updateDiaryDate ? updateDiaryDate.toLocaleDateString() : "Select entry date"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <CalendarComponent
                                            mode="single"
                                            selected={updateDiaryDate}
                                            onSelect={(date) => {
                                                setUpdateDiaryDate(date);
                                                setIsUpdateCalendarOpen(false);
                                            }}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 rounded-md border p-2 bg-muted/30">
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(updateDiaryEditorRef, setUpdateDiaryDraft, "bold")}>
                                <Bold className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(updateDiaryEditorRef, setUpdateDiaryDraft, "italic")}>
                                <Italic className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(updateDiaryEditorRef, setUpdateDiaryDraft, "underline")}>
                                <Underline className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(updateDiaryEditorRef, setUpdateDiaryDraft, "insertUnorderedList")}>
                                <List className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(updateDiaryEditorRef, setUpdateDiaryDraft, "insertOrderedList")}>
                                <ListOrdered className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(updateDiaryEditorRef, setUpdateDiaryDraft, "formatBlock", "<h1>")}>
                                <Heading1 className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(updateDiaryEditorRef, setUpdateDiaryDraft, "formatBlock", "<h2>")}>
                                <Heading2 className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(updateDiaryEditorRef, setUpdateDiaryDraft, "undo")}>
                                <Undo2 className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(updateDiaryEditorRef, setUpdateDiaryDraft, "removeFormat")}>
                                <Eraser className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="relative flex-1 min-h-[420px] rounded-md border bg-background">
                            <div
                                ref={updateDiaryEditorRef}
                                contentEditable
                                suppressContentEditableWarning
                                onInput={() => handleDiaryEditorInput(updateDiaryEditorRef, setUpdateDiaryDraft)}
                                onPaste={handleDiaryEditorPaste}
                                className="h-full w-full overflow-auto p-4 text-sm leading-7 focus-visible:outline-none"
                            />
                            {!getDiaryPreviewText(updateDiaryDraft) && (
                                <p className="pointer-events-none absolute left-4 top-4 text-sm text-muted-foreground">
                                    Write client diary notes here...
                                </p>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={() => setIsUpdateDiaryModalOpen(false)} disabled={isDiarySubmitting}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleUpdateDiaryEntry} disabled={isDiarySubmitting || !getDiaryPreviewText(updateDiaryDraft) || !updateDiaryDate || !selectedDiaryEntryForUpdate}>
                            {isDiarySubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            {isDiarySubmitting ? "Updating..." : "Update Entry"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}