"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileText, Filter, Plus, RefreshCcw, Search, Send } from "lucide-react";
import { toast } from "react-toastify";

type AgentOption = {
    id: string;
    name: string;
    email: string;
    agentType: string;
    agentRole?: string;
};

type QuoteRequest = {
    id: string;
    title: string;
    description: string;
    createdBy: string;
    creatorType?: "admin" | "agent" | "unknown";
    createdAt: string;
    status?: string;
    assignedTo: AgentOption | null;
    acceptedBy?: AgentOption | null;
    acceptedAt?: string | null;
};

export default function RequestQuotePage() {
    const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
    const [agents, setAgents] = useState<AgentOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [assignedAgentId, setAssignedAgentId] = useState("");
    const [createdBy, setCreatedBy] = useState("");

    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [assignedAdvisorFilter, setAssignedAdvisorFilter] = useState("all");
    const [advisorFilterSearch, setAdvisorFilterSearch] = useState("");
    const [showAdvisorFilterDropdown, setShowAdvisorFilterDropdown] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [modalAgentSearch, setModalAgentSearch] = useState("");
    const [showModalAgentDropdown, setShowModalAgentDropdown] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedQuote, setSelectedQuote] = useState<QuoteRequest | null>(null);

    const advisorAgents = useMemo(
        () => agents.filter((agent) => (agent.agentRole || agent.agentType || "").trim().toLowerCase() === "advisor agent"),
        [agents],
    );

    const filteredAdvisorAgentsForFilter = useMemo(() => {
        const query = advisorFilterSearch.trim().toLowerCase();
        if (!query) return [];
        return advisorAgents.filter((agent) =>
            agent.name.toLowerCase().includes(query) ||
            agent.email.toLowerCase().includes(query),
        );
    }, [advisorAgents, advisorFilterSearch]);

    const filteredAdvisorAgentsForModal = useMemo(() => {
        const query = modalAgentSearch.trim().toLowerCase();
        if (!query) return [];
        return advisorAgents.filter((agent) =>
            agent.name.toLowerCase().includes(query) ||
            agent.email.toLowerCase().includes(query),
        );
    }, [advisorAgents, modalAgentSearch]);

    const selectedAgent = useMemo(
        () => advisorAgents.find((agent) => agent.id === assignedAgentId) || null,
        [advisorAgents, assignedAgentId],
    );

    const filteredQuotes = useMemo(() => {
        return quotes.filter((quote) => {
            const statusLabel = quote.status || "Requested";
            const matchesSearch =
                quote.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (quote.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                (quote.createdBy || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                (quote.assignedTo?.name || "").toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = statusFilter === "all" || statusLabel === statusFilter;
            const matchesAdvisor =
                assignedAdvisorFilter === "all" ||
                quote.assignedTo?.id === assignedAdvisorFilter;

            return matchesSearch && matchesStatus && matchesAdvisor;
        });
    }, [quotes, searchTerm, statusFilter, assignedAdvisorFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / itemsPerPage));
    const paginatedQuotes = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredQuotes.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredQuotes, currentPage, itemsPerPage]);

    useEffect(() => {
        const userStr = localStorage.getItem("user");
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                setCreatedBy(user?.username || user?.email || "Admin");
            } catch {
                setCreatedBy("Admin");
            }
        } else {
            setCreatedBy("Admin");
        }
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [quotesResponse, agentsResponse] = await Promise.all([
                fetch("/api/request-quote", { credentials: "include", cache: "no-store" }),
                fetch("/api/agents", { credentials: "include", cache: "no-store" }),
            ]);

            if (!quotesResponse.ok) {
                throw new Error("Failed to fetch quote requests");
            }

            if (!agentsResponse.ok) {
                throw new Error("Failed to fetch agents");
            }

            const quotesData = await quotesResponse.json();
            const agentsData = await agentsResponse.json();

            setQuotes(Array.isArray(quotesData.quoteRequests) ? quotesData.quoteRequests : []);
            setAgents(Array.isArray(agentsData) ? agentsData : []);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load quote request data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, assignedAdvisorFilter, itemsPerPage]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchInitialData();
        setRefreshing(false);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!title.trim()) {
            toast.error("Title is required");
            return;
        }
        if (!assignedAgentId) {
            toast.error("Please select an agent to assign");
            return;
        }

        setSubmitting(true);
        try {
            const response = await fetch("/api/request-quote", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                    title,
                    description,
                    assignedAgentId,
                    createdBy,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData?.error || "Failed to create quote request");
            }

            const data = await response.json();
            if (data?.quoteRequest) {
                setQuotes((prev) => [data.quoteRequest, ...prev]);
            }

            setTitle("");
            setDescription("");
            setAssignedAgentId("");
            setModalAgentSearch("");
            setShowModalAgentDropdown(false);
            setIsModalOpen(false);
            toast.success("Quote request created successfully");
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "Failed to create quote request");
        } finally {
            setSubmitting(false);
        }
    };

    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(Number.parseInt(value, 10));
    };

    const resetFilters = () => {
        setSearchTerm("");
        setStatusFilter("all");
        setAssignedAdvisorFilter("all");
        setAdvisorFilterSearch("");
        setShowAdvisorFilterDropdown(false);
    };

    const openCreateModal = () => {
        setTitle("");
        setDescription("");
        setAssignedAgentId("");
        setModalAgentSearch("");
        setShowModalAgentDropdown(false);
        setIsModalOpen(true);
    };

    const handleAdvisorFilterSelect = (agent: AgentOption) => {
        setAssignedAdvisorFilter(agent.id);
        setAdvisorFilterSearch(agent.name);
        setShowAdvisorFilterDropdown(false);
    };

    const handleModalAgentSelect = (agent: AgentOption) => {
        setAssignedAgentId(agent.id);
        setModalAgentSearch(agent.name);
        setShowModalAgentDropdown(false);
    };

    const openQuoteDetails = (quote: QuoteRequest) => {
        setSelectedQuote(quote);
        setIsDetailsModalOpen(true);
    };

    return (
        <div className="container mx-auto p-6 max-w-7xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-[28px] md:text-3xl font-bold">Quote Request</h1>
                    <p className="text-[16px] text-muted-foreground mt-1">
                        Create and track requested quotes with owner and assignee details.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        onClick={openCreateModal}
                        className="bg-[#003459] hover:bg-[#003459] text-white"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add New Quote Request
                    </Button>
                    {/* <Button
                        type="button"
                        variant="outline"
                        onClick={handleRefresh}
                        disabled={refreshing || loading}
                        className="w-fit"
                    >
                        <RefreshCcw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                        Refresh
                    </Button> */}
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filters & Search
                    </CardTitle>
                    <CardDescription>
                        Search quote requests and filter by status or assigned advisor.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2 space-y-2">
                            <Label htmlFor="quote-search">Search</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="quote-search"
                                    className="pl-10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search title, description, creator, advisor..."
                                />
                            </div>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>Status</Label>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Statuses</SelectItem>
                                    <SelectItem value="Requested">Requested</SelectItem>
                                    <SelectItem value="Accepted">Accepted</SelectItem>
                                    <SelectItem value="Rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Advisor Agent</Label>
                            <div className="relative">
                                <Input
                                    value={advisorFilterSearch}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setAdvisorFilterSearch(value);
                                        setShowAdvisorFilterDropdown(true);
                                        if (!value.trim()) {
                                            setAssignedAdvisorFilter("all");
                                        }
                                    }}
                                    onFocus={() => {
                                        if (advisorFilterSearch.trim()) {
                                            setShowAdvisorFilterDropdown(true);
                                        }
                                    }}
                                    placeholder="Type advisor name or email"
                                />
                                {showAdvisorFilterDropdown && advisorFilterSearch.trim() && filteredAdvisorAgentsForFilter.length > 0 && (
                                    <div className="absolute z-20 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-56 overflow-auto">
                                        {filteredAdvisorAgentsForFilter.map((agent) => (
                                            <button
                                                key={agent.id}
                                                type="button"
                                                className="w-full text-left px-3 py-2 hover:bg-muted border-b border-border last:border-b-0"
                                                onClick={() => handleAdvisorFilterSelect(agent)}
                                            >
                                                <div className="font-medium">{agent.name}</div>
                                                <div className="text-xs text-muted-foreground">{agent.email}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {showAdvisorFilterDropdown && advisorFilterSearch.trim() && filteredAdvisorAgentsForFilter.length === 0 && (
                                    <div className="absolute z-20 w-full mt-1 bg-background border border-border rounded-md shadow-lg px-3 py-2 text-sm text-muted-foreground">
                                        No advisor agent found
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {assignedAdvisorFilter === "all" ? "Showing all advisors" : "Filtering by selected advisor"}
                            </p>
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <Button type="button" variant="outline" onClick={resetFilters}>
                            Reset Filters
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Requested Quotes Showcase</CardTitle>
                    <CardDescription>
                        List of quote requests with creator, assignee, title, and description.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : filteredQuotes.length === 0 ? (
                        <p className="text-muted-foreground">No quote requests found for the current filters.</p>
                    ) : (
                        <>
                            <p className="text-sm text-muted-foreground mb-3">
                                Showing {paginatedQuotes.length} of {filteredQuotes.length} quote requests
                            </p>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Requested Quote</TableHead>
                                            <TableHead>Who Created</TableHead>
                                            <TableHead>Assigned To</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Title</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedQuotes.map((quote) => (
                                            <TableRow
                                                key={quote.id}
                                                onClick={() => openQuoteDetails(quote)}
                                                className="cursor-pointer"
                                            >
                                                <TableCell>
                                                    <Badge
                                                        className={`${quote.status === "Accepted"
                                                            ? "bg-green-100 text-green-800 border-green-200"
                                                            : quote.status === "Rejected"
                                                                ? "bg-red-100 text-red-800 border-red-200"
                                                                : "bg-blue-100 text-blue-800 border-blue-200"
                                                            } border`}
                                                    >
                                                        {quote.status || "Requested"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{quote.createdBy || "Unknown"}</div>
                                                    <div className="text-xs text-muted-foreground capitalize">
                                                        {quote.creatorType || "unknown"}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {format(new Date(quote.createdAt), "dd MMM yyyy, hh:mm a")}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {quote.assignedTo ? (
                                                        <div>
                                                            <div className="font-medium">{quote.assignedTo.name}</div>
                                                            <div className="text-xs text-muted-foreground">{quote.assignedTo.agentType}</div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">Unassigned</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm">{quote.status || "Requested"}</span>
                                                </TableCell>
                                                <TableCell className="font-medium">{quote.title}</TableCell>
                                                <TableCell className="max-w-[380px]">
                                                    <p className="line-clamp-2 text-sm text-muted-foreground">
                                                        {quote.description || "No description"}
                                                    </p>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            openQuoteDetails(quote);
                                                        }}
                                                    >
                                                        View
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {totalPages > 1 && (
                                <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm text-muted-foreground">Rows per page</p>
                                        <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                                            <SelectTrigger className="w-[90px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="5">5</SelectItem>
                                                <SelectItem value="10">10</SelectItem>
                                                <SelectItem value="20">20</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <p className="text-sm text-muted-foreground">
                                            Page {currentPage} of {totalPages}
                                        </p>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => setCurrentPage(1)}
                                                disabled={currentPage === 1}
                                            >
                                                <ChevronsLeft className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                                disabled={currentPage === 1}
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                                disabled={currentPage === totalPages}
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => setCurrentPage(totalPages)}
                                                disabled={currentPage === totalPages}
                                            >
                                                <ChevronsRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[620px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Add New Quote Request
                        </DialogTitle>
                        <DialogDescription>
                            Enter quote details and assign only an Advisor Agent.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 py-2">
                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="quote-title">Title of Quote Request *</Label>
                                <Input
                                    id="quote-title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ex: Annual Compliance Package Quote"
                                />
                            </div>

                            {/* <div className="space-y-2">
                                <Label htmlFor="created-by">Who Created</Label>
                                <Input id="created-by" value={createdBy} readOnly className="bg-muted" />
                            </div> */}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="quote-description">Description</Label>
                            <Textarea
                                id="quote-description"
                                rows={5}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Write quote request details here..."
                            />
                        </div>

                        <div className="space-y-2 w-full">
                            <Label htmlFor="assign-agent">Who To Assign (Advisor Agent only) *</Label>
                            <div className="relative">
                                <Input
                                    id="assign-agent"
                                    value={modalAgentSearch}
                                    onChange={(e) => {
                                        setModalAgentSearch(e.target.value);
                                        setAssignedAgentId("");
                                        setShowModalAgentDropdown(true);
                                    }}
                                    onFocus={() => {
                                        if (modalAgentSearch.trim()) {
                                            setShowModalAgentDropdown(true);
                                        }
                                    }}
                                    placeholder="Type advisor name or email"
                                />
                                {showModalAgentDropdown && modalAgentSearch.trim() && filteredAdvisorAgentsForModal.length > 0 && (
                                    <div className="absolute z-20 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-56 overflow-auto">
                                        {filteredAdvisorAgentsForModal.map((agent) => (
                                            <button
                                                key={agent.id}
                                                type="button"
                                                className="w-full text-left px-3 py-2 hover:bg-muted border-b border-border last:border-b-0"
                                                onClick={() => handleModalAgentSelect(agent)}
                                            >
                                                <div className="font-medium">{agent.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {agent.email} ({agent.agentRole || agent.agentType})
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {showModalAgentDropdown && modalAgentSearch.trim() && filteredAdvisorAgentsForModal.length === 0 && (
                                    <div className="absolute z-20 w-full mt-1 bg-background border border-border rounded-md shadow-lg px-3 py-2 text-sm text-muted-foreground">
                                        No advisor agent found
                                    </div>
                                )}
                            </div>
                            {selectedAgent && (
                                <p className="text-xs text-muted-foreground">
                                    Selected: {selectedAgent.name} ({selectedAgent.email})
                                </p>
                            )}
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={submitting || advisorAgents.length === 0}>
                                <Send className="h-4 w-4 mr-2" />
                                {submitting ? "Submitting..." : "Submit Quote Request"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
                <DialogContent className="sm:max-w-[680px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between gap-2">
                            <span>Quote Request Details</span>
                        </DialogTitle>
                        <DialogDescription>
                            View the complete details for this quote request.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedQuote && (
                        <div className="space-y-5 py-1">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="rounded-lg border bg-muted/30 p-3">
                                    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</Label>
                                    <div className="mt-2">
                                        <Badge
                                            className={`${selectedQuote.status === "Accepted"
                                                ? "bg-green-100 text-green-800 border-green-200"
                                                : selectedQuote.status === "Rejected"
                                                    ? "bg-red-100 text-red-800 border-red-200"
                                                    : "bg-blue-100 text-blue-800 border-blue-200"
                                                } border`}
                                        >
                                            {selectedQuote.status || "Requested"}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="rounded-lg border bg-muted/30 p-3">
                                    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Requested At</Label>
                                    <p className="mt-2 text-sm font-semibold">
                                        {format(new Date(selectedQuote.createdAt), "dd MMM yyyy, hh:mm a")}
                                    </p>
                                </div>
                                <div className="rounded-lg border bg-muted/30 p-3">
                                    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Assigned To</Label>
                                    {selectedQuote.assignedTo ? (
                                        <>
                                            <p className="mt-2 text-sm font-semibold">{selectedQuote.assignedTo.name}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {selectedQuote.assignedTo.agentRole || selectedQuote.assignedTo.agentType}
                                            </p>
                                        </>
                                    ) : (
                                        <p className="mt-2 text-sm text-muted-foreground">Unassigned</p>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-xl border p-4 space-y-3">
                                <div>
                                    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Title</Label>
                                    <p className="mt-1.5 text-base font-semibold leading-snug">{selectedQuote.title}</p>
                                </div>
                                <div>
                                    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Description</Label>
                                    <p className="mt-1.5 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                        {selectedQuote.description || "No description"}
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-xl border p-4">
                                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">People & Ownership</Label>
                                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Created By</p>
                                        <p className="text-sm font-medium mt-1">{selectedQuote.createdBy || "Unknown"}</p>
                                        <p className="text-xs text-muted-foreground capitalize mt-0.5">{selectedQuote.creatorType || "unknown"}</p>
                                    </div>
                                    {/* <div>
                                        <p className="text-xs text-muted-foreground">Accepted By</p>
                                        {selectedQuote.acceptedBy ? (
                                            <>
                                                <p className="text-sm font-medium mt-1">{selectedQuote.acceptedBy.name}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{selectedQuote.acceptedBy.email}</p>
                                                {selectedQuote.acceptedAt && (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Accepted on {format(new Date(selectedQuote.acceptedAt), "dd MMM yyyy, hh:mm a")}
                                                    </p>
                                                )}
                                            </>
                                        ) : (
                                            <p className="text-sm text-muted-foreground mt-1">Not accepted yet</p>
                                        )}
                                    </div> */}
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsDetailsModalOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
