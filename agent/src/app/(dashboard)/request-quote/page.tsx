"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Eye,
    FileText,
    Plus,
    Search,
    Send,
    ShieldCheck,
    ShieldX,
} from "lucide-react";
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

const statusBadgeClass = (status?: string) => {
    if (status === "Accepted") return "bg-green-100 text-green-800 border-green-200";
    if (status === "Rejected") return "bg-red-100 text-red-800 border-red-200";
    return "bg-blue-100 text-blue-800 border-blue-200";
};

export default function RequestQuotePage() {
    const { agent, isLoading: authLoading } = useAuth();
    const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
    const [agents, setAgents] = useState<AgentOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedQuote, setSelectedQuote] = useState<QuoteRequest | null>(null);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [assignedAgentId, setAssignedAgentId] = useState("");
    const [modalAgentSearch, setModalAgentSearch] = useState("");
    const [showModalAgentDropdown, setShowModalAgentDropdown] = useState(false);

    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const isExecutionAgent = agent?.agentRole === "Execution Agent";
    const isAdvisorAgent = agent?.agentRole === "Advisor Agent";

    const advisorAgents = useMemo(
        () => agents.filter((item) => item.agentRole === "Advisor Agent"),
        [agents],
    );

    const filteredAdvisorAgentsForModal = useMemo(() => {
        const query = modalAgentSearch.trim().toLowerCase();
        if (!query) return [];
        return advisorAgents.filter((item) =>
            item.name.toLowerCase().includes(query) ||
            item.email.toLowerCase().includes(query),
        );
    }, [advisorAgents, modalAgentSearch]);

    const selectedAgent = useMemo(
        () => advisorAgents.find((item) => item.id === assignedAgentId) || null,
        [advisorAgents, assignedAgentId],
    );

    const filteredQuotes = useMemo(() => {
        return quotes.filter((quote) => {
            const normalizedSearch = searchTerm.trim().toLowerCase();
            const statusMatches = statusFilter === "all" || (quote.status || "Requested") === statusFilter;
            const searchMatches =
                !normalizedSearch ||
                quote.title.toLowerCase().includes(normalizedSearch) ||
                (quote.description || "").toLowerCase().includes(normalizedSearch) ||
                (quote.createdBy || "").toLowerCase().includes(normalizedSearch) ||
                (quote.assignedTo?.name || "").toLowerCase().includes(normalizedSearch);

            return statusMatches && searchMatches;
        });
    }, [quotes, searchTerm, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / itemsPerPage));

    const paginatedQuotes = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredQuotes.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredQuotes, currentPage, itemsPerPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, itemsPerPage]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const requests: Promise<Response>[] = [
                fetch("/api/request-quote", { credentials: "include", cache: "no-store" }),
            ];

            if (isExecutionAgent) {
                requests.push(fetch("/api/agents", { credentials: "include", cache: "no-store" }));
            }

            const [quotesResponse, agentsResponse] = await Promise.all(requests);

            if (!quotesResponse.ok) {
                throw new Error("Failed to fetch quote requests");
            }

            const quotesData = await quotesResponse.json();
            setQuotes(Array.isArray(quotesData.quoteRequests) ? quotesData.quoteRequests : []);

            if (agentsResponse) {
                if (!agentsResponse.ok) {
                    throw new Error("Failed to fetch agents");
                }

                const agentsData = await agentsResponse.json();
                setAgents(Array.isArray(agentsData) ? agentsData : []);
            } else {
                setAgents([]);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load quote request data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (authLoading || !agent) return;
        fetchInitialData();
    }, [authLoading, agent?.id, isExecutionAgent]);

    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(Number.parseInt(value, 10));
    };

    const openCreateModal = () => {
        setTitle("");
        setDescription("");
        setAssignedAgentId("");
        setModalAgentSearch("");
        setShowModalAgentDropdown(false);
        setIsModalOpen(true);
    };

    const handleModalAgentSelect = (selected: AgentOption) => {
        setAssignedAgentId(selected.id);
        setModalAgentSearch(selected.name);
        setShowModalAgentDropdown(false);
    };

    const openQuoteDetails = (quote: QuoteRequest) => {
        setSelectedQuote(quote);
        setIsDetailsModalOpen(true);
    };

    const updateQuoteInState = (updated: QuoteRequest) => {
        setQuotes((previous) => previous.map((quote) => (quote.id === updated.id ? updated : quote)));
        setSelectedQuote(updated);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!isExecutionAgent) {
            toast.error("Only execution agents can create quote requests");
            return;
        }

        if (!title.trim()) {
            toast.error("Title is required");
            return;
        }

        if (!assignedAgentId) {
            toast.error("Please select an advisor agent");
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
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData?.error || "Failed to create quote request");
            }

            const data = await response.json();
            if (data?.quoteRequest) {
                setQuotes((previous) => [data.quoteRequest, ...previous]);
            }

            setIsModalOpen(false);
            setTitle("");
            setDescription("");
            setAssignedAgentId("");
            setModalAgentSearch("");
            toast.success("Quote request created successfully");
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "Failed to create quote request");
        } finally {
            setSubmitting(false);
        }
    };

    const handleQuoteAction = async (quoteId: string, action: "accept" | "reject") => {
        setActionLoadingId(quoteId);
        try {
            const response = await fetch(`/api/request-quote/${quoteId}/${action}`, {
                method: "PATCH",
                credentials: "include",
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData?.error || `Failed to ${action} quote request`);
            }

            const data = await response.json();
            if (data?.quoteRequest) {
                updateQuoteInState(data.quoteRequest);
            }

            toast.success(`Quote request ${action}ed successfully`);
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : `Failed to ${action} quote request`);
        } finally {
            setActionLoadingId(null);
        }
    };

    const canActionQuote = (quote: QuoteRequest) => {
        return Boolean(
            isAdvisorAgent &&
            agent?.id &&
            quote.assignedTo?.id === agent.id &&
            (quote.status || "Requested") === "Requested",
        );
    };

    return (
        <div className="container mx-auto p-6 max-w-7xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-[28px] md:text-3xl font-bold">Quote Request</h1>
                    <p className="text-[16px] text-muted-foreground mt-1">
                        {isExecutionAgent
                            ? "Create quote requests and assign them to advisor agents."
                            : "Review quote requests assigned to you and accept or reject them."}
                    </p>
                </div>
                {isExecutionAgent && (
                    <Button
                        type="button"
                        onClick={openCreateModal}
                        className="bg-[#003459] hover:bg-[#003459] text-white"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add New Quote Request
                    </Button>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5" />
                        Search Quotes
                    </CardTitle>
                    <CardDescription>
                        {isExecutionAgent ? "Search the quote requests you created." : "Search quote requests assigned to you."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2 space-y-2">
                            <Label htmlFor="quote-search">Search</Label>
                            <Input
                                id="quote-search"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Search title, description, creator or advisor"
                            />
                        </div>
                        <div className="space-y-2">
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
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{isExecutionAgent ? "Created Quotes" : "My Quote Requests"}</CardTitle>
                    <CardDescription>
                        {isExecutionAgent
                            ? "Quotes created by you for advisor agents."
                            : "Quotes assigned to you that you can review and respond to."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading || authLoading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : filteredQuotes.length === 0 ? (
                        <p className="text-muted-foreground">No quote requests found.</p>
                    ) : (
                        <>
                            <p className="text-sm text-muted-foreground mb-3">
                                Showing {paginatedQuotes.length} of {filteredQuotes.length} quote requests
                            </p>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Title</TableHead>
                                            <TableHead>Created By</TableHead>
                                            <TableHead>Assigned To</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedQuotes.map((quote) => (
                                            <TableRow key={quote.id} className="cursor-pointer" onClick={() => openQuoteDetails(quote)}>
                                                <TableCell>
                                                    <Badge className={`${statusBadgeClass(quote.status)} border`}>
                                                        {quote.status || "Requested"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-medium">{quote.title}</TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{quote.createdBy || "Unknown"}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {format(new Date(quote.createdAt), "dd MMM yyyy, hh:mm a")}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {quote.assignedTo ? (
                                                        <div>
                                                            <div className="font-medium">{quote.assignedTo.name || "Unknown"}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {quote.assignedTo.agentRole || quote.assignedTo.agentType || "Unknown"}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">Unassigned</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="max-w-[320px]">
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
                                                        <Eye className="h-4 w-4 mr-2" />
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
                                        <p className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</p>
                                        <div className="flex gap-1">
                                            <Button variant="outline" size="icon" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                                                <ChevronsLeft className="h-4 w-4" />
                                            </Button>
                                            <Button variant="outline" size="icon" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1}>
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <Button variant="outline" size="icon" onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                            <Button variant="outline" size="icon" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
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
                            Enter quote details and assign only an advisor agent.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="quote-title">Title of Quote Request *</Label>
                            <Input
                                id="quote-title"
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                placeholder="Ex: Annual Compliance Package Quote"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="quote-description">Description</Label>
                            <Textarea
                                id="quote-description"
                                rows={5}
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                placeholder="Write quote request details here..."
                            />
                        </div>

                        <div className="space-y-2 w-full">
                            <Label htmlFor="assign-agent">Assign Advisor Agent *</Label>
                            <div className="relative">
                                <Input
                                    id="assign-agent"
                                    value={modalAgentSearch}
                                    onChange={(event) => {
                                        setModalAgentSearch(event.target.value);
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
                                        {filteredAdvisorAgentsForModal.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                className="w-full text-left px-3 py-2 hover:bg-muted border-b border-border last:border-b-0"
                                                onClick={() => handleModalAgentSelect(item)}
                                            >
                                                <div className="font-medium">{item.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {item.email} ({item.agentRole || item.agentType})
                                                </div>
                                            </button>
                                        ))}
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
                        <DialogTitle>Quote Request Details</DialogTitle>
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
                                        <Badge className={`${statusBadgeClass(selectedQuote.status)} border`}>
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

                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        {selectedQuote && canActionQuote(selectedQuote) && (
                            <>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={actionLoadingId === selectedQuote.id}
                                    onClick={() => handleQuoteAction(selectedQuote.id, "reject")}
                                >
                                    <ShieldX className="h-4 w-4 mr-2" />
                                    Reject
                                </Button>
                                <Button
                                    type="button"
                                    disabled={actionLoadingId === selectedQuote.id}
                                    onClick={() => handleQuoteAction(selectedQuote.id, "accept")}
                                >
                                    <ShieldCheck className="h-4 w-4 mr-2" />
                                    Accept
                                </Button>
                            </>
                        )}
                        <Button type="button" variant="outline" onClick={() => setIsDetailsModalOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
