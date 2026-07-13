"use client";
import { useState, useEffect, useCallback } from "react";
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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    UserCheck,
    UserPlus,
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
import { hasAdvisorRole } from "@/lib/agentRole";
import { sanitizeInactiveAgentEmail } from "@/lib/agentEmail";
import { useTablePage } from "@/hooks/useTablePage";

const advisorTypesSet = new Set(["Lead Maker", "Client Advisor", "Client Manager"]);

const getAdvisorType = (agent: Agent): string => {
    if (agent.advisorAgentType) return agent.advisorAgentType;
    return advisorTypesSet.has(agent.agentType) ? agent.agentType : "";
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientAdvisor {
    id: string;
    name: string;
    email: string;
    phoneNumber?: string;
    specializations: string[];
    photo?: string;
    status?: string;
}

interface ClientAdvisorsModalProps {
    leadMaker: Agent | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// ─── ClientAdvisorsModal Component ────────────────────────────────────────────

function ClientAdvisorsModal({ leadMaker, open, onOpenChange }: ClientAdvisorsModalProps) {
    const [assignedAdvisors, setAssignedAdvisors] = useState<ClientAdvisor[]>([]);
    const [allAdvisors, setAllAdvisors] = useState<ClientAdvisor[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [tab, setTab] = useState<"assigned" | "add">("assigned");

    const fetchData = useCallback(async () => {
        if (!leadMaker) return;
        setLoading(true);
        try {
            // Fetch assigned advisors for this lead maker
            const res = await fetchWithAuth(`/api/agents/auto-assign?leadMakerId=${leadMaker.id}`);
            if (res.ok) {
                const data = await res.json();
                setAssignedAdvisors(data.clientAdvisors ?? []);
                setSelectedIds(new Set((data.clientAdvisors ?? []).map((a: ClientAdvisor) => a.id)));
            }

            // Fetch active and deleted advisors so deleted entries are visible in Add/Remove panel.
            const [allRes, inactiveRes] = await Promise.all([
                fetchWithAuth("/api/agents"),
                fetchWithAuth("/api/agents?status=inactive"),
            ]);

            if (allRes.ok && inactiveRes.ok) {
                const activeData = await allRes.json();
                const inactiveData = await inactiveRes.json();
                const mergedById = new Map<string, Agent>();

                [...activeData, ...inactiveData].forEach((agent: Agent) => {
                    mergedById.set(agent.id, agent);
                });

                const normalizedAdvisors: ClientAdvisor[] = Array.from(mergedById.values())
                    .filter(
                        (a: Agent) => getAdvisorType(a) !== "Lead Maker" && hasAdvisorRole(a.agentRole),
                    )
                    .map((a: Agent) => ({
                        id: a.id,
                        name: a.name,
                        email: a.email,
                        phoneNumber: a.phoneNumber,
                        specializations: a.specializations || [],
                        photo: a.photo || undefined,
                        status: a.status,
                    }));

                setAllAdvisors(normalizedAdvisors);
            }
        } catch (err) {
            console.error("Error fetching client advisors:", err);
        } finally {
            setLoading(false);
        }
    }, [leadMaker]);

    useEffect(() => {
        if (open) {
            setTab("assigned");
            setSearchTerm("");
            fetchData();
        }
    }, [open, fetchData]);

    const toggleAdvisor = (id: string) => {
        const advisor = allAdvisors.find((a) => a.id === id);
        if (advisor?.status === "inactive") return;

        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    console.log(Array.from(selectedIds))

    const handleSave = async () => {
        if (!leadMaker) return;
        setSaving(true);
        try {
            const res = await fetchWithAuth("/api/agents/auto-assign", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    leadMakerId: leadMaker.id,
                    clientAdvisorIds: Array.from(selectedIds).filter((id) => {
                        const advisor = allAdvisors.find((a) => a.id === id);
                        return advisor?.status !== "inactive";
                    }),
                }),
            });
            if (res.ok) {
                const data = await res.json();
                // Refresh assigned list from updated data
                const updatedIds = new Set<string>(data.leadMaker.clientAdvisorIds ?? []);
                setAssignedAdvisors(allAdvisors.filter((a) => updatedIds.has(a.id)));
                setSelectedIds(updatedIds);
                setTab("assigned");
            }
        } catch (err) {
            console.error("Error saving client advisors:", err);
        } finally {
            setSaving(false);
        }
    };

    const filteredAdvisors = allAdvisors.filter(
        (a) =>
            a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            sanitizeInactiveAgentEmail(a.email).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const hasChanges =
        selectedIds.size !== assignedAdvisors.length ||
        assignedAdvisors.some((a) => !selectedIds.has(a.id));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg w-full">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <UserCheck className="h-5 w-5 text-[#003459]" />
                        Client Advisors
                        {leadMaker && (
                            <span className="text-muted-foreground font-normal text-sm">
                                — {leadMaker.name.charAt(0).toUpperCase() + leadMaker.name.slice(1)}
                            </span>
                        )}
                    </DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm">
                        View and manage assigned Client Advisors for this Lead Maker.
                    </DialogDescription>
                </DialogHeader>

                {/* Tabs */}
                <div className="flex border-b mb-3">
                    <button
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "assigned"
                            ? "border-[#003459] text-[#003459]"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                        onClick={() => setTab("assigned")}
                    >
                        Assigned ({assignedAdvisors.length})
                    </button>
                    <button
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${tab === "add"
                            ? "border-[#003459] text-[#003459]"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                        onClick={() => setTab("add")}
                    >
                        <UserPlus className="h-3.5 w-3.5" />
                        Add / Remove
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <>
                        {/* Assigned Tab */}
                        {tab === "assigned" && (
                            <ScrollArea className="max-h-72 pr-2">
                                {assignedAdvisors.length === 0 ? (
                                    <div className="text-center py-8 text-sm text-muted-foreground">
                                        No Client Advisors assigned yet.
                                        <br />
                                        <button
                                            className="mt-2 text-[#003459] underline text-xs"
                                            onClick={() => setTab("add")}
                                        >
                                            Add advisors
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {assignedAdvisors.map((advisor) => (
                                            <div
                                                key={advisor.id}
                                                className="flex items-center gap-3 p-2 rounded-lg border bg-muted/30"
                                            >
                                                <Avatar className="h-8 w-8 flex-shrink-0">
                                                    <AvatarImage src={advisor.photo || ""} />
                                                    <AvatarFallback className="text-xs">
                                                        {advisor.name
                                                            .toUpperCase()
                                                            .split(" ")
                                                            .map((n) => n[0])
                                                            .join("")}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-medium text-sm truncate">
                                                        {advisor.name.charAt(0).toUpperCase() + advisor.name.slice(1)}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground truncate">
                                                        {sanitizeInactiveAgentEmail(advisor.email)}
                                                    </div>
                                                </div>
                                                {advisor.specializations?.length > 0 && (
                                                    <Badge variant="outline" className="text-xs flex-shrink-0">
                                                        {advisor.specializations[0]}
                                                    </Badge>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        )}

                        {/* Add / Remove Tab */}
                        {tab === "add" && (
                            <>
                                <div className="relative mb-3">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search advisors..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 text-sm"
                                    />
                                </div>
                                <ScrollArea className="max-h-64 pr-2">
                                    {filteredAdvisors.length === 0 ? (
                                        <div className="text-center py-8 text-sm text-muted-foreground">
                                            No advisors found.
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            {filteredAdvisors.map((advisor) => {
                                                const checked = selectedIds.has(advisor.id);
                                                const isDeleted = advisor.status === "inactive";
                                                return (
                                                    <label
                                                        key={advisor.id}
                                                        className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${checked
                                                            ? "bg-[#003459]/5 border-[#003459]/30"
                                                            : "hover:bg-muted/40 border-transparent"
                                                            }`}
                                                    >
                                                        <Checkbox
                                                            checked={checked}
                                                            disabled={isDeleted}
                                                            onCheckedChange={() => toggleAdvisor(advisor.id)}
                                                            className="flex-shrink-0"
                                                        />
                                                        <Avatar className="h-8 w-8 flex-shrink-0">
                                                            <AvatarImage src={advisor.photo || ""} />
                                                            <AvatarFallback className="text-xs">
                                                                {advisor.name
                                                                    .toUpperCase()
                                                                    .split(" ")
                                                                    .map((n) => n[0])
                                                                    .join("")}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="font-medium text-sm truncate">
                                                                {advisor.name.charAt(0).toUpperCase() + advisor.name.slice(1)}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground truncate">
                                                                {sanitizeInactiveAgentEmail(advisor.email)}
                                                            </div>
                                                        </div>
                                                        {isDeleted && (
                                                            <Badge variant="outline" className="text-xs text-red-600 border-red-300">
                                                                Deleted
                                                            </Badge>
                                                        )}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </ScrollArea>

                                <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2">
                                    <Button
                                        variant="outline"
                                        className="w-full sm:w-auto"
                                        onClick={() => {
                                            setSelectedIds(new Set(assignedAdvisors.map((a) => a.id)));
                                            setTab("assigned");
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="w-full sm:w-auto bg-[#003459] hover:bg-[#003459] text-white shadow-none hover:shadow-md transition-shadow"
                                        onClick={handleSave}
                                        disabled={saving || !hasChanges}
                                    >
                                        {saving ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            "Save Changes"
                                        )}
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ─── Main AgentsTable Component ───────────────────────────────────────────────

export default function AgentsTable() {
    const router = useRouter();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedType, setSelectedType] = useState("All Types");
    const [selectedJurisdiction, setSelectedJurisdiction] = useState("All Jurisdictions");
    const { currentPage, setCurrentPage, itemsPerPage, setItemsPerPage, clampToTotalPages } =
        useTablePage("admin-sales-dashboard-agent-page");
    const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
    const [loading, setLoading] = useState(true);
    const [transferAgentId, setTransferAgentId] = useState<string | null>(null);
    const [agentSearchQuery, setAgentSearchQuery] = useState("");
    const [showAgentSuggestions, setShowAgentSuggestions] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Client Advisors Modal state
    const [clientAdvisorsAgent, setClientAdvisorsAgent] = useState<Agent | null>(null);
    const [clientAdvisorsModalOpen, setClientAdvisorsModalOpen] = useState(false);

    useEffect(() => {
        const fetchAgents = async () => {
            try {
                const response = await fetchWithAuth("/api/agents");
                if (response.ok) {
                    const data = await response.json();
                    setAgents(data.filter((agent: Agent) => hasAdvisorRole(agent.agentRole)));
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
        const displayEmail = sanitizeInactiveAgentEmail(agent.email);
        const matchesSearch =
            agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            displayEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
            agent.specializations
                .join(", ")
                .toLowerCase()
                .includes(searchTerm.toLowerCase());

        const matchesType =
            selectedType === "All Types" || getAdvisorType(agent) === selectedType;
        const matchesJurisdiction =
            selectedJurisdiction === "All Jurisdictions" ||
            agent.jurisdiction === selectedJurisdiction;

        return matchesSearch && matchesType && matchesJurisdiction;
    });

    // Apply sorting to filtered agents
    const sortedAgents = filteredAgents;

    const transferCandidates = agents.filter((agent) => {
        if (!agentToDelete) return false;

        const matchesSearch = agent.name
            .toLowerCase()
            .includes(agentSearchQuery.toLowerCase());

        const deletingLeadMaker = getAdvisorType(agentToDelete) === "Lead Maker";
        const isValidType = deletingLeadMaker
            ? getAdvisorType(agent) === "Lead Maker"
            : true;

        return matchesSearch && agent.id !== agentToDelete.id && isValidType;
    });

    const resetFilters = () => {
        setSearchTerm("");
        setSelectedType("All Types");
        setSelectedJurisdiction("All Jurisdictions");
    };

    // Pagination logic
    const totalPages = Math.ceil(sortedAgents.length / itemsPerPage);

    useEffect(() => {
        clampToTotalPages(totalPages)
    }, [totalPages, clampToTotalPages]);
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
            setIsSubmitting(true);
            const response = await fetchWithAuth(`/api/agents/${agentToDelete.id}/advisor-transfer`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ transferAgentId }),
            });

            if (response.ok) {
                setAgents(agents.filter((agent) => agent.id !== agentToDelete.id));
                setAgentToDelete(null);
            } else {
                console.error("Failed to delete agent");
            }
        } catch (error) {
            console.error("Error deleting agent:", error);
        } finally {
            setIsSubmitting(false);
            setTransferAgentId(null);
            setAgentSearchQuery("");
            setShowAgentSuggestions(false);
        }
    };

    const handleOpenClientAdvisors = (e: React.MouseEvent, agent: Agent) => {
        e.stopPropagation();
        setClientAdvisorsAgent(agent);
        setClientAdvisorsModalOpen(true);
    };

    const getAgentTypeBadge = (agent: Agent) => {
        const type = getAdvisorType(agent) || agent.agentType;
        const colors: Record<string, string> = {
            "Senior Partner": "bg-purple-100 text-purple-800",
            Partner: "bg-blue-100 text-blue-800",
            Associate: "bg-green-100 text-green-800",
            "Junior Associate": "bg-yellow-100 text-yellow-800",
            Paralegal: "bg-orange-100 text-orange-800",
            "Legal Assistant": "bg-gray-100 text-gray-800",
        };

        const isLeadMaker = type === "Lead Maker";

        return (
            <Badge
                className={`${colors[type] || "bg-gray-100 text-gray-800"} ${isLeadMaker
                    ? "cursor-pointer hover:ring-2 hover:ring-[#003459]/40 transition-all"
                    : ""
                    }`}
                onClick={isLeadMaker ? (e) => handleOpenClientAdvisors(e, agent) : undefined}
                title={isLeadMaker ? "Click to manage Client Advisors" : undefined}
            >
                {type}
                {isLeadMaker && <UserCheck className="ml-1 h-3 w-3 inline-block" />}
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
                                </div>
                            </>
                        ) : (
                            <>
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
                                </div>
                            </>
                        )}
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

                {loading ? (
                    <div className="flex justify-center items-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <>
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
                                                        onClick={() => router.push(`/agent/${agent.id}?tab=leads`)}
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
                                                                        {sanitizeInactiveAgentEmail(agent.email)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{getAgentTypeBadge(agent)}</TableCell>
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
                                                                        <Link href={`/agent/${agent.id}?tab=leads`}>
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
                                                                    {getAdvisorType(agent) === "Lead Maker" && (
                                                                        <>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem
                                                                                onClick={(e) => handleOpenClientAdvisors(e, agent)}
                                                                            >
                                                                                <UserCheck className="mr-2 h-4 w-4" />
                                                                                Client Advisors
                                                                            </DropdownMenuItem>
                                                                        </>
                                                                    )}
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
                                                        onClick={() => router.push(`/agent/${agent.id}?tab=leads`)}
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
                                                                        {sanitizeInactiveAgentEmail(agent.email)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-xs">{getAgentTypeBadge(agent)}</TableCell>
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
                                                                        <Link href={`/agent/${agent.id}?tab=leads`}>
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
                                                                    {getAdvisorType(agent) === "Lead Maker" && (
                                                                        <>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem
                                                                                onClick={(e) => handleOpenClientAdvisors(e, agent)}
                                                                            >
                                                                                <UserCheck className="mr-2 h-3 w-3" />
                                                                                <span className="text-xs">Client Advisors</span>
                                                                            </DropdownMenuItem>
                                                                        </>
                                                                    )}
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
                    </>
                )}
            </Card>

            {/* Delete Confirmation Dialog */}
            <AlertDialog
                open={!!agentToDelete}
                onOpenChange={() => {
                    setAgentToDelete(null);
                    setTransferAgentId(null);
                    setAgentSearchQuery("");
                    setShowAgentSuggestions(false);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone.
                            <br />
                            <br />
                            <strong>
                                All leads, related opportunities context, and team members will be
                                transferred to the selected advisor below.
                            </strong>
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-2 mt-4">
                        <Label htmlFor="transfer-advisor">Transfer To *</Label>

                        <div className="relative">
                            <Input
                                id="transfer-advisor"
                                type="text"
                                placeholder="Type to search advisors..."
                                value={agentSearchQuery}
                                onChange={(e) => {
                                    if (e.target.value === "") {
                                        setTransferAgentId(null);
                                    }
                                    setAgentSearchQuery(e.target.value);
                                    setShowAgentSuggestions(!!e.target.value.trim());
                                }}
                                onFocus={() => {
                                    if (agentSearchQuery.trim()) setShowAgentSuggestions(true);
                                }}
                            />

                            {showAgentSuggestions &&
                                agentSearchQuery.trim() &&
                                transferCandidates.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                                        {transferCandidates.map((agent) => (
                                            <div
                                                key={agent.id}
                                                className="flex items-center gap-2 p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                                                onClick={() => {
                                                    setAgentSearchQuery(agent.name);
                                                    setTransferAgentId(agent.id);
                                                    setShowAgentSuggestions(false);
                                                }}
                                            >
                                                <Avatar className="h-6 w-6">
                                                    <AvatarFallback className="text-xs">
                                                        {agent.name
                                                            .split(" ")
                                                            .map((n) => n[0])
                                                            .join("")}
                                                    </AvatarFallback>
                                                </Avatar>

                                                <div>
                                                    <span className="font-medium">{agent.name}</span>
                                                    <span className="text-sm text-muted-foreground ml-2">
                                                        ({getAdvisorType(agent) || agent.agentType})
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                            {showAgentSuggestions &&
                                agentSearchQuery.trim() &&
                                transferCandidates.length === 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-md p-3">
                                        <span className="text-gray-500">No advisors found</span>
                                    </div>
                                )}
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setAgentToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={!transferAgentId || isSubmitting}
                        >
                            {isSubmitting ? "Transferring..." : "Delete & Transfer"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Client Advisors Modal */}
            <ClientAdvisorsModal
                leadMaker={clientAdvisorsAgent}
                open={clientAdvisorsModalOpen}
                onOpenChange={(open) => {
                    setClientAdvisorsModalOpen(open);
                    if (!open) setClientAdvisorsAgent(null);
                }}
            />
        </div>
    );
}