'use client'
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { User, Search, Plus, Edit, Trash2, MoreHorizontal } from "lucide-react"
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"
import { Badge } from "@/components/ui/badge"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

// Define the exact types for clients and agents
interface Client {
    id: string;
    name: string;
    email: string;
}

interface Agent {
    id: string;
    name: string;
    email: string;
}

interface LegislationItem {
    id: string;
    title: string;
    description: string;
    assignedAgent: string;
}

interface CreateProps {
    admin?: {
        id: string;
        name?: string;
    } | null;
    initialData?: {
        id: string;
        name: string;
        description: string;
    };
}

function Create({ admin, initialData }: CreateProps) {
    const [formData, setFormData] = useState({
        name: initialData?.name || "",
        description: initialData?.description || "",
        clientId: "",
    })
    const [clientSearch, setClientSearch] = useState("");
    const [showClientDropdown, setShowClientDropdown] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false)
    const router = useRouter()
    const [legislationItems, setLegislationItems] = useState<LegislationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [loadingAgents, setLoadingAgents] = useState(true);
    const [agentError, setAgentError] = useState<string | null>(null);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLegislationId, setEditingLegislationId] = useState<string | null>(null);
    const [modalFormData, setModalFormData] = useState({
        title: "",
        description: "",
        assignedAgent: "",
    });
    const [modalAgentSearch, setModalAgentSearch] = useState("");
    const [showModalAgentDropdown, setShowModalAgentDropdown] = useState(false);

    // Filtered clients based on search
    const filteredClients = clientSearch
        ? clients.filter(
            (client) =>
                client &&
                ((client.name?.toLowerCase() || "").includes(clientSearch.toLowerCase()) ||
                    (client.email?.toLowerCase() || "").includes(clientSearch.toLowerCase()))
        )
        : [];

    // Filtered agents for modal
    const filteredModalAgents = modalAgentSearch
        ? agents.filter(
            (agent) =>
                agent.name.toLowerCase().includes(modalAgentSearch.toLowerCase()) ||
                agent.email.toLowerCase().includes(modalAgentSearch.toLowerCase())
        )
        : [];

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) {
            toast.error("Retainership title (name) is required");
            return;
        }

        try {
            setIsSubmitting(true);
            const isEditing = !!admin?.id;

            const response = await fetch(
                isEditing ? `/api/retainerships/${admin.id}` : '/api/retainerships',
                {
                    method: isEditing ? 'PUT' : 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ...formData,
                        clientId: formData.clientId,
                        legislation: legislationItems.map(item => ({
                            title: item.title,
                            description: item.description,
                            assignedAgent: item.assignedAgent,
                        })),
                    }),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error("API Error:", errorData);
                throw new Error(errorData.error || `Failed to ${isEditing ? 'update' : 'create'} retainership`);
            }

            toast.success(`Retainership ${isEditing ? 'updated' : 'created'} successfully!`);
            router.push('/retainership');
        } catch (error) {
            console.error("Error creating retainership:", error);
            const errorMessage = error instanceof Error ? error.message : "Failed to create retainership";
            toast.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleClientSelect = (client: { id: string; name: string; email: string; }) => {
        setFormData((prev) => ({ ...prev, clientId: client.id }));
        setClientSearch(client.name);
        setShowClientDropdown(false);
    };

    const addLegislationItem = () => {
        setEditingLegislationId(null);
        setModalFormData({
            title: "",
            description: "",
            assignedAgent: "",
        });
        setModalAgentSearch("");
        setIsModalOpen(true);
    };

    const editLegislationItem = (item: LegislationItem) => {
        setEditingLegislationId(item.id);
        setModalFormData({
            title: item.title,
            description: item.description,
            assignedAgent: item.assignedAgent,
        });
        setModalAgentSearch(item.assignedAgent);
        setIsModalOpen(true);
    };

    const saveLegislationItem = () => {
        if (!modalFormData.title.trim()) {
            toast.error("Legislation title is required");
            return;
        }

        if (editingLegislationId) {
            // Update existing item
            setLegislationItems((items) =>
                items.map((item) =>
                    item.id === editingLegislationId
                        ? { ...item, ...modalFormData }
                        : item
                )
            );
        } else {
            // Add new item
            const newItem: LegislationItem = {
                id: Date.now().toString(),
                ...modalFormData,
            };
            setLegislationItems([...legislationItems, newItem]);
        }

        setIsModalOpen(false);
        setModalFormData({
            title: "",
            description: "",
            assignedAgent: "",
        });
        setModalAgentSearch("");
    };

    const handleModalAgentSelect = (agent: Agent) => {
        setModalFormData((prev) => ({ ...prev, assignedAgent: agent.name }));
        setModalAgentSearch(agent.name);
        setShowModalAgentDropdown(false);
    };

    const removeLegislationItem = (id: string) => {
        setLegislationItems((items) => items.filter((item) => item.id !== id));
    };

    useEffect(() => {
        const fetchClientsAndAgents = async () => {
            try {
                setLoading(true);
                const [clientsResponse, agentsResponse] = await Promise.all([
                    fetchWithAuth("/api/clients"),
                    fetchWithAuth("/api/team-members"),
                ]);

                if (!clientsResponse.ok || !agentsResponse.ok) {
                    throw new Error("Failed to fetch data");
                }

                const clientsData: Client[] = await clientsResponse.json();
                const agentsData: Agent[] = await agentsResponse.json();

                setClients(clientsData);
                setAgents(agentsData);
            } catch (err) {
                setError(err instanceof Error ? err.message : "An error occurred");
            } finally {
                setLoading(false);
            }
        };

        fetchClientsAndAgents();
    }, []);

    useEffect(() => {
        async function fetchAgents() {
            try {
                setLoadingAgents(true);
                const response = await fetchWithAuth("/api/team-members");

                if (!response.ok) {
                    throw new Error("Failed to fetch agents");
                }

                const agentsData: Agent[] = await response.json();
                setAgents(agentsData);
            } catch (err) {
                setAgentError(err instanceof Error ? err.message : "An error occurred");
            } finally {
                setLoadingAgents(false);
            }
        }

        fetchAgents();
    }, []);

    if (loading || loadingAgents) return <p>Loading...</p>;
    if (error) return <p>Error: {error}</p>;
    if (agentError) return <p>Error: {agentError}</p>;

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">
                    {admin ? "Edit Retainership" : "Create New Retainership"}
                </h1>
                <p className="text-muted-foreground mt-2">
                    {admin
                        ? "Edit retainership to organize your tasks effectively"
                        : "Add a new retainership to organize your tasks effectively."}
                </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Retainership Information
                        </CardTitle>
                        <CardDescription>Basic details about the retainership</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <Label htmlFor="username">Retainership *</Label>
                            <Input
                                id="username"
                                value={formData.name}
                                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder="Enter retainership name"
                                required
                            />
                        </div>
                        <div className="space-y-2 mt-3">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                                placeholder="Enter retainership description (optional)"
                                rows={4}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Client Information</CardTitle>
                        <CardDescription>Select a client for this retainership</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="client-search">Client</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="client-search"
                                    value={clientSearch}
                                    onChange={(e) => {
                                        setClientSearch(e.target.value);
                                        setShowClientDropdown(true);
                                    }}
                                    onFocus={() => setShowClientDropdown(true)}
                                    placeholder="Search for a client..."
                                    className="pl-10"
                                    required
                                />
                                {showClientDropdown && clientSearch && filteredClients.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                                        {filteredClients.map((client) => (
                                            <div
                                                key={client.id}
                                                className="px-4 py-3 hover:bg-muted cursor-pointer border-b border-border last:border-b-0"
                                                onClick={() => handleClientSelect(client)}
                                            >
                                                <div className="font-medium">{client.name || "Unknown Name"}</div>
                                                <div className="text-sm text-muted-foreground">{client.email}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {showClientDropdown && clientSearch && filteredClients.length === 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                                        <div className="px-4 py-3 text-muted-foreground">
                                            No clients found
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Legislation Subcategories</CardTitle>
                                <CardDescription>Add specific legislation areas and assign agents</CardDescription>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={addLegislationItem}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Legislation
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {legislationItems.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <p>No legislation items added yet.</p>
                                <p className="text-sm">Click &quot;Add Legislation&quot; to get started.</p>
                            </div>
                        ) : (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Title</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead>Assigned Agent</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {legislationItems.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">{item.title}</TableCell>
                                                <TableCell>
                                                    <div className="max-w-xs">
                                                        <p className="text-sm truncate" title={item.description}>
                                                            {item.description || "-"}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">{item.assignedAgent || "Unassigned"}</Badge>
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
                                                            <DropdownMenuItem onClick={() => editLegislationItem(item)}>
                                                                <Edit className="mr-2 h-4 w-4" />
                                                                Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="text-destructive"
                                                                onClick={() => removeLegislationItem(item.id)}
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-4">
                    <Button
                        className="bg-[#f42b03] hover:bg-[#f42b03] shadow-none hover:shadow-lg transition-shadow duration-300 text-white hover:text-white cursor-pointer"
                        type="button"
                        variant="outline"
                        onClick={() => router.push('/retainership')}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="cursor-pointer shadow-none hover:shadow-lg transition-shadow duration-300"
                        type="submit"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Processing..." : admin ? "Update Retainership" : "Create Retainership"}
                    </Button>
                </div>
            </form>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{editingLegislationId ? "Edit Legislation" : "Add New Legislation"}</DialogTitle>
                        <DialogDescription>
                            {editingLegislationId
                                ? "Update the legislation details below."
                                : "Fill in the details for the new legislation item."}
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
                        <Button type="button" onClick={saveLegislationItem}>
                            {editingLegislationId ? "Update" : "Add"} Legislation
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default Create