"use client"

import { useState, useEffect } from "react"
import { use } from "react"
import { toast } from "react-toastify"

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Eye, PlusCircle, Pen } from "lucide-react";

// Importing Retainership, Task, and UserInfo types from the types file
import { Retainership } from "@/types";
import { Calendar, Clock, FileText, Tag, User } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import { useRouter } from "next/navigation"

export default function RetainershipDetail({ params }: { params: Promise<{ id: string }> | { id: string } }) {
    // Helper to render the creator label (name + (Owner/Admin/Agent))
    const renderCreatedBy = () => {
        if (!retainership?.createdBy) return "Unknown";
        return (
            <span>
                {retainership.createdBy}
                {retainership.createdByType === "agent" && (
                    <span className="ml-1 text-xs text-blue-600">(Agent)</span>
                )}
                {retainership.createdByType === "user" && retainership.createdByRole === "owner" && (
                    <span className="ml-1 text-xs text-purple-600">(Owner)</span>
                )}
                {retainership.createdByType === "user" && retainership.createdByRole === "admin" && (
                    <span className="ml-1 text-xs text-green-600">(Admin)</span>
                )}
            </span>
        );
    };

    const router = useRouter()
    const resolvedParams = params instanceof Promise ? use(params) : params;
    const [isEdit, setIsEdit] = useState(false)
    const [retainership, setRetainership] = useState<Retainership | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalAgentSearch, setModalAgentSearch] = useState("");
    const [agents, setAgents] = useState<any[]>([]);
    const [showModalAgentDropdown, setShowModalAgentDropdown] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [modalFormData, setModalFormData] = useState<any>({
        title: "",
        description: "",
        assignedAgent: "",
    });
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        const fetchData = async () => {
            try {
                const retainershipId = resolvedParams.id;
                const retainershipResponse = await fetch(`/api/retainerships/${retainershipId}`);

                if (!retainershipResponse.ok) {
                    throw new Error("Failed to fetch retainership");
                }

                const retainershipData = await retainershipResponse.json();
                setRetainership({
                    ...retainershipData,
                    client: retainershipData.client || null
                });

                const tasksResponse = await fetch(`/api/tasks?retainershipId=${retainershipId}`);

                if (tasksResponse.ok) {
                } else {
                    console.error("Error fetching tasks:", await tasksResponse.text());
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
                toast.error(`Failed to load retainership: ${errorMessage}`);
                setRetainership(null);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [resolvedParams.id]);

    useEffect(() => {
        const fetchClientsAndAgents = async () => {
            try {
                const [agentsResponse] = await Promise.all([
                    fetchWithAuth('/api/agents'),
                ]);

                if (!agentsResponse.ok) {
                    throw new Error('Failed to fetch data');
                }

                const agentsData: any = await agentsResponse.json();

                setAgents(agentsData);
            } catch (err) {
                toast.error(err instanceof Error ? err.message : 'An error occurred');
            }
        };

        fetchClientsAndAgents();
    }, []);

    const filteredModalAgents = modalAgentSearch
        ? agents.filter(
            (agent) =>
                agent.name.toLowerCase().includes(modalAgentSearch.toLowerCase()) ||
                agent.email.toLowerCase().includes(modalAgentSearch.toLowerCase())
        )
        : [];

    const handleModalAgentSelect = (agent: any) => {
        setModalFormData((prev) => ({ ...prev, assignedAgent: agent.name }));
        setModalAgentSearch(agent.name);
        setShowModalAgentDropdown(false);
    };

    const handleSubmit = async () => {
        try {
            setIsSubmitting(true)
            if (isEdit) {
                const res = await fetch(`/api/legislation/${modalFormData.id}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        title: modalFormData.title,
                        description: modalFormData.description,
                        assignedAgentId: agents.find(agent => agent.name === modalFormData.assignedAgent)?.id,
                    }),
                });

                if (!res.ok) {
                    const errorText = await res.text();
                    throw new Error(errorText || "Failed to create legislation");
                }

                const data = await res.json();

                setRetainership((prev) => {
                    if (!prev) return prev;

                    const agent = agents.find(a => a.name === modalFormData.assignedAgent);

                    return {
                        ...prev,
                        legislation: prev.legislation.map((leg) =>
                            leg.id === data.id
                                ? {
                                    ...leg,
                                    title: modalFormData.title,
                                    description: modalFormData.description,
                                    assignedAgentId: agent?.id ?? "",
                                    assignedAgent: agent
                                        ? {
                                            id: agent.id,
                                            name: agent.name,
                                            email: agent.email,
                                        }
                                        : undefined,
                                }
                                : leg
                        ),
                    };
                });


            } else {
                const res = await fetch("/api/legislation", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        title: modalFormData.title,
                        retainershipId: resolvedParams.id,
                        description: modalFormData.description,
                        assignedAgentId: agents.find(agent => agent.name === modalFormData.assignedAgent)?.id,
                    }),
                });

                if (!res.ok) {
                    const errorText = await res.text();
                    throw new Error(errorText || "Failed to create legislation");
                }

                const data = await res.json();

                setRetainership((prev) => {
                    if (!prev) return prev;

                    const agent = agents.find(
                        (a) => a.name === modalFormData.assignedAgent
                    );
                    return {
                        ...prev,
                        legislation: [
                            {
                                id: data?.id,
                                title: modalFormData.title,
                                description: modalFormData.description,
                                assignedAgentId: agent?.id ?? "",
                                assignedAgent: agent
                                    ? {
                                        id: agent.id,
                                        name: agent.name,
                                        email: agent.email,
                                    }
                                    : undefined,
                            },
                            ...prev.legislation,
                        ],
                    };
                });

                toast.success("Legislation added successfully");
            }
        } catch (error) {
            toast.error("Something went wrong");
        } finally {
            setIsSubmitting(false)
            setIsModalOpen(false)
            setModalFormData({
                title: "",
                description: "",
                assignedAgent: "",
            })
            setIsEdit(false)
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto p-6 max-w-7xl">
                {/* Header Skeleton */}
                <div className="mb-8">
                    <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
                        <div>
                            <Skeleton className="h-8 w-40 mb-2" />
                            <Skeleton className="h-5 w-80" />
                        </div>
                        <Skeleton className="h-10 w-32 mt-[20px] md:mt-0" />
                    </div>
                    <Card>
                        <CardContent className="p-6">
                            <div className="space-y-4">
                                <Skeleton className="h-6 w-1/2 mb-2" />
                                <Skeleton className="h-4 w-full mb-4" />
                                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 p-0 md:p-4 bg-muted/30 rounded-lg">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-4 w-40 md:ml-auto" />
                                </div>
                            </div>

                        </CardContent>

                    </Card>

                    <Card className="mt-[20px]">
                        <CardContent className="p-6 mt-[30px]">
                            <div className="space-y-4">
                                <Skeleton className="h-6 w-1/2 mb-2" />
                                <Skeleton className="h-4 w-full mb-4" />
                                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 p-0 md:p-4 bg-muted/30 rounded-lg">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-4 w-40 md:ml-auto" />
                                </div>
                            </div>

                        </CardContent>

                    </Card>
                </div>


            </div>
        )
    }

    if (!retainership) {
        return (
            <div className="container mx-auto p-6 max-w-7xl">
                <div className="text-center py-20">
                    <p className="text-muted-foreground">Retainership not found</p>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-[28px] md:text-3xl font-bold">Retainership Details</h1>
                        <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
                            Comprehensive view of retainership details and associated tasks
                        </p>
                    </div>
                </div>

                <div className="mb-8">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    Retainership Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <Avatar className="h-16 w-16">
                                        <AvatarImage src={retainership.photo || ""} />
                                        <AvatarFallback className="text-lg">
                                            {retainership.name
                                                .toUpperCase()
                                                .split(" ")
                                                .map((n) => n[0])
                                                .join("")}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h2 className="text-2xl font-semibold">{retainership.name}</h2>
                                            <Badge
                                                variant="secondary"
                                                className={retainership.status === "approved"
                                                    ? "bg-green-100 text-green-800"
                                                    : "bg-yellow-100 text-yellow-800"
                                                }
                                            >
                                                {retainership.status === "approved" ? "Approved" : "Pending Approval"}
                                            </Badge>
                                        </div>
                                        <p className="text-muted-foreground mb-4">{retainership.description}</p>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                <span>Created by: {renderCreatedBy()}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                <span>Created: {new Date(retainership.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-muted-foreground" />
                                                <span>Updated: {new Date(retainership.updatedAt).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Tag className="h-4 w-4 text-muted-foreground" />
                                                <span>
                                                    Client: {
                                                        retainership.client
                                                            ? retainership.client.organizationName ||
                                                            `${retainership.client.firstName || ""} ${retainership.client.lastName || ""}`.trim()
                                                            : "Unknown"
                                                    }
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Retainership Legislation
                            </CardTitle>
                            <Button onClick={() => setIsModalOpen(true)}>Add Legislation</Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Legislation Name</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Assigned Agent</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {retainership?.legislation?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                No legislation found for this retainership.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        retainership?.legislation?.map((legislation) => (
                                            <TableRow className="cursor-pointer" key={legislation.id} onClick={() => router.push(`/legislation/${legislation.id}`)}>
                                                <TableCell>
                                                    <div title={legislation.title || ""}>
                                                        {
                                                            legislation.title
                                                                ? (legislation.title.length > 40
                                                                    ? `${legislation.title.slice(0, 40)}...`
                                                                    : legislation.title)
                                                                : "N/A"
                                                        }
                                                    </div>
                                                </TableCell>
                                                <TableCell title={legislation.description || ""}>
                                                    {legislation.description?.slice(0, 60)}
                                                    {(legislation.description?.length ?? 0) > 60 && '...'}
                                                </TableCell>                                                <TableCell>
                                                    {typeof legislation.assignedAgent === "string"
                                                        ? legislation.assignedAgent
                                                        : legislation.assignedAgent?.name || "Unknown"}
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
                                                                <a href={`/legislation/${legislation.id}`} className="flex items-center">
                                                                    <Eye className="mr-2 h-4 w-4" />
                                                                    View Details
                                                                </a>
                                                            </DropdownMenuItem>

                                                            <DropdownMenuItem asChild>
                                                                <button className="flex items-center w-full" onClick={() => {
                                                                    setIsEdit(true)
                                                                    setModalFormData({
                                                                        id: legislation.id,
                                                                        title: legislation.title,
                                                                        description: legislation.description!,
                                                                        assignedAgent: legislation.assignedAgent?.name || legislation.assignedAgent,
                                                                    })
                                                                    setModalAgentSearch(legislation.assignedAgent?.name || legislation?.assignedAgent! as any)
                                                                    setIsModalOpen(true)
                                                                }}>
                                                                    <Pen className="mr-2 h-4 w-4" />
                                                                    Edit
                                                                </button>
                                                            </DropdownMenuItem>

                                                            {retainership.status !== "pending" && (
                                                                <DropdownMenuItem asChild>
                                                                    <a
                                                                        href={`/task/create?legislationId=${legislation.id}&assignedAgent=${legislation.assignedAgentId}&client=${retainership.client?.id}`}
                                                                        className="flex items-center"
                                                                    >
                                                                        <PlusCircle className="mr-2 h-4 w-4" />
                                                                        Create Task
                                                                    </a>
                                                                </DropdownMenuItem>
                                                            )}
                                                        </DropdownMenuContent>

                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card >
            </div >
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{"Add New Legislation"}</DialogTitle>
                        <DialogDescription>
                            {
                                "Fill in the details for the new legislation item."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="modal-title">Legislation Title *</Label>
                            <Input
                                id="modal-title"
                                value={modalFormData.title}
                                onChange={(e) => setModalFormData((prev) => ({ ...prev, title: e.target.value }))}
                                placeholder="Enter legislation title"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="modal-description">Description</Label>
                            <Textarea
                                id="modal-description"
                                value={modalFormData.description}
                                onChange={(e) => setModalFormData((prev) => ({ ...prev, description: e.target.value }))}
                                placeholder="Describe the legislation requirements"
                                rows={3}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="modal-agent">Assigned Agent</Label>
                            <div className="relative">
                                <Input
                                    id="modal-agent"
                                    value={modalAgentSearch}
                                    onChange={(e) => {
                                        setModalAgentSearch(e.target.value);
                                        setModalFormData((prev) => ({ ...prev, assignedAgent: e.target.value }));
                                        setShowModalAgentDropdown(true);
                                    }}
                                    onFocus={() => setShowModalAgentDropdown(true)}
                                    placeholder="Type agent name or select from list..."
                                />
                                {showModalAgentDropdown && modalAgentSearch && filteredModalAgents.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                                        {filteredModalAgents.map((agent) => (
                                            <div
                                                key={agent.id}
                                                className="px-4 py-3 hover:bg-muted cursor-pointer border-b border-border last:border-b-0"
                                                onClick={() => handleModalAgentSelect(agent)}
                                            >
                                                <div className="font-medium">{agent.name}</div>
                                                <div className="text-sm text-muted-foreground">{agent.email}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button disabled={isSubmitting} type="button" onClick={handleSubmit}>
                            {isSubmitting
                                ? (isEdit ? "Updating.." : "Adding..")
                                : (isEdit ? "Edit Legislation" : "Add Legislation")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
