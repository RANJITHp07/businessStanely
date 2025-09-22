'use client'
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { User, Search, Plus, X } from "lucide-react"
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"
import { Badge } from "@/components/ui/badge"
import { fetchWithAuth } from "@/lib/fetchWithAuth"

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
    const [clients, setClients] = useState<Client[]>([]); // Fetch clients dynamically
    const [agents, setAgents] = useState<Agent[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false)
    const router = useRouter()
    const [agentSearches, setAgentSearches] = useState<Record<string, string>>({});
    const [showAgentDropdowns, setShowAgentDropdowns] = useState<Record<string, boolean>>({});
    const [legislationItems, setLegislationItems] = useState<LegislationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [loadingAgents, setLoadingAgents] = useState(true);
    const [agentError, setAgentError] = useState<string | null>(null);

    // Filtered clients based on search
    const filteredClients = clientSearch
        ? clients.filter(
              (client) =>
                  client &&
                  ((client.name?.toLowerCase() || "").includes(clientSearch.toLowerCase()) ||
                      (client.email?.toLowerCase() || "").includes(clientSearch.toLowerCase()))
          )
        : []; // Show no suggestions if search is empty

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
        const newItem: LegislationItem = {
            id: Date.now().toString(),
            title: "",
            description: "",
            assignedAgent: "",
        };
        setLegislationItems([...legislationItems, newItem]);
    };

    const updateLegislationItem = (id: string, field: keyof LegislationItem, value: string) => {
        setLegislationItems((items) => items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
    };

    const handleAgentSearch = (itemId: string, searchValue: string) => {
        setAgentSearches((prev) => ({ ...prev, [itemId]: searchValue }));
        setShowAgentDropdowns((prev) => ({ ...prev, [itemId]: true }));
        updateLegislationItem(itemId, "assignedAgent", searchValue);
    };

    const handleAgentSelect = (itemId: string, agent: Agent) => {
        setAgentSearches((prev) => ({ ...prev, [itemId]: agent.name }));
        setShowAgentDropdowns((prev) => ({ ...prev, [itemId]: false }));
        updateLegislationItem(itemId, "assignedAgent", agent.name);
    };

    const getFilteredAgents = (itemId: string) => {
        const search = agentSearches[itemId]?.toLowerCase() || "";
        return search
            ? agents.filter(
                  (agent) =>
                      agent.name.toLowerCase().includes(search) ||
                      agent.email.toLowerCase().includes(search)
              )
            : []; // Show no suggestions if search is empty
    };

    const removeLegislationItem = (id: string) => {
        setLegislationItems((items) => items.filter((item) => item.id !== id));
        setAgentSearches((prev) => {
            const newState = { ...prev };
            delete newState[id];
            return newState;
        });
        setShowAgentDropdowns((prev) => {
            const newState = { ...prev };
            delete newState[id];
            return newState;
        });
    };

    useEffect(() => {
        // Fetch clients and agents from the API
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
                    <CardContent className="space-y-4">
                        {legislationItems.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <p>No legislation items added yet.</p>
                                <p className="text-sm">Click &quot;Add Legislation&quot; to get started.</p>
                            </div>
                        ) : (
                            legislationItems.map((item, index) => (
                                <Card key={item.id} className="relative">
                                    <CardHeader className="pb-4">
                                        <div className="flex items-center justify-between">
                                            <Badge variant="secondary">Legislation {index + 1}</Badge>
                                            <Button type="button" variant="ghost" size="sm" onClick={() => removeLegislationItem(item.id)}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Legislation Title</Label>
                                            <Input
                                                value={item.title}
                                                onChange={(e) => updateLegislationItem(item.id, "title", e.target.value)}
                                                placeholder="Enter legislation title"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Description</Label>
                                            <Textarea
                                                value={item.description}
                                                onChange={(e) => updateLegislationItem(item.id, "description", e.target.value)}
                                                placeholder="Describe the legislation requirements"
                                                rows={3}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Assigned Agent</Label>
                                            <div className="relative">
                                                <Input
                                                    value={agentSearches[item.id] || item.assignedAgent}
                                                    onChange={(e) => handleAgentSearch(item.id, e.target.value)}
                                                    onFocus={() => setShowAgentDropdowns((prev) => ({ ...prev, [item.id]: true }))}
                                                    placeholder="Type agent name or select from list..."
                                                    className="pr-10"
                                                />
                                                {showAgentDropdowns[item.id] && getFilteredAgents(item.id).length > 0 && (
                                                    <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                                                        {getFilteredAgents(item.id).map((agent) => (
                                                            <div
                                                                key={agent.id}
                                                                className="px-4 py-3 hover:bg-muted cursor-pointer border-b border-border last:border-b-0"
                                                                onClick={() => handleAgentSelect(item.id, agent)}
                                                            >
                                                                <div className="font-medium">{agent.name}</div>
                                                                <div className="text-sm text-muted-foreground">{agent.email}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
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

        </div>
    )
}

export default Create
