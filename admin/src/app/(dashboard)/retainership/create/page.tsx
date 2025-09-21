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
import { Badge } from '@/components/ui/badge'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

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

function Create({ admin, initialData }: CreateProps) {
    const [formData, setFormData] = useState({
        name: initialData?.name || "",
        description: initialData?.description || "",
    })
    const [clientSearch, setClientSearch] = useState('');
    const [showClientDropdown, setShowClientDropdown] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [agentSearches, setAgentSearches] = useState<Record<string, string>>({});
    const [showAgentDropdowns, setShowAgentDropdowns] = useState<Record<string, boolean>>({});
    const [legislationItems, setLegislationItems] = useState<LegislationItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false)
    const router = useRouter()

    // Fetch clients and agents from the API
    useEffect(() => {
        const fetchClientsAndAgents = async () => {
            try {
                const [clientsResponse, agentsResponse] = await Promise.all([
                    fetchWithAuth('/api/clients'),
                    fetchWithAuth('/api/agents'),
                ]);

                if (!clientsResponse.ok || !agentsResponse.ok) {
                    throw new Error('Failed to fetch data');
                }

                const clientsData: Client[] = await clientsResponse.json();
                const agentsData: Agent[] = await agentsResponse.json();

                setClients(clientsData);
                setAgents(agentsData);
            } catch (err) {
                toast.error(err instanceof Error ? err.message : 'An error occurred');
            }
        };

        fetchClientsAndAgents();
    }, []);

    // Filter clients based on search input
    const filteredClients = clients.filter(client =>
        (client.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
         client.email?.toLowerCase().includes(clientSearch.toLowerCase()))
    );

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name) {
            toast.error("Retainership name is required")
            return
        }

        // Add debug log to confirm redirect
        try {
            setIsSubmitting(true);
            // Determine if we're creating or updating
            const isEditing = !!admin?.id

            // Update the payload to use agent IDs instead of names for assignedAgent
            const payload = {
                ...formData,
                legislation: legislationItems.map(item => ({
                    title: item.title,
                    description: item.description,
                    assignedAgent: item.assignedAgent, // Ensure this is the agent ID
                })),
            };

            // Call API to create/update retainership
            const response = await fetch(
                isEditing ? `/api/retainerships/${admin.id}` : '/api/retainerships', 
                {
                    method: isEditing ? 'PUT' : 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                }
            )
            
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || `Failed to ${isEditing ? 'update' : 'create'} retainership`)
            }
            
            toast.success(`Retainership ${isEditing ? 'updated' : 'created'} successfully!`)
            console.log('Redirecting to /retainership'); // Debug log
            router.push('/retainership')
        } catch (error) {
            console.error("Error creating retainership:", error)
            const errorMessage = error instanceof Error ? error.message : "Failed to create retainership"
            toast.error(errorMessage)
        } finally {
            setIsSubmitting(false)
        }
    }

    // Handle client selection from dropdown
    const handleClientSelect = (client: Client) => {
        setFormData((prev) => ({ ...prev, clientId: client.id }));
        setClientSearch(client.name);
        setShowClientDropdown(false);
    };

    // Add a new legislation item
    const addLegislationItem = () => {
        setLegislationItems((prev) => [
            ...prev,
            { id: Date.now().toString(), title: '', description: '', assignedAgent: '' },
        ]);
    };

    // Remove a legislation item
    const removeLegislationItem = (id: string) => {
        setLegislationItems((prev) => prev.filter((item) => item.id !== id));
    };

    // Update a legislation item
    const updateLegislationItem = (id: string, field: 'title' | 'description', value: string) => {
        setLegislationItems((prev) =>
            prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
        );
    };

    // Handle agent search in legislation items
    const handleAgentSearch = (itemId: string, query: string) => {
        setAgentSearches((prev) => ({ ...prev, [itemId]: query }));
        setShowAgentDropdowns((prev) => ({ ...prev, [itemId]: true }));
    };

    // Update getFilteredAgents to return an empty array if the search query is empty
    const getFilteredAgents = (itemId: string) => {
        const query = agentSearches[itemId]?.toLowerCase() || '';
        if (!query) return []; // Return an empty array if the search query is empty
        return agents.filter(agent =>
            agent.name.toLowerCase().includes(query)
        );
    };

    // Handle agent selection for a legislation item
    const handleAgentSelect = (itemId: string, agent: Agent) => {
        const updatedLegislationItems = legislationItems.map(item => {
            if (item.id === itemId) {
                return { ...item, assignedAgent: agent.id };
            }
            return item;
        });
        setLegislationItems(updatedLegislationItems);
        setAgentSearches((prev) => ({ ...prev, [itemId]: agent.name }));
        setShowAgentDropdowns((prev) => ({ ...prev, [itemId]: false }));
    };

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
                        <div >
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
                                                <div className="font-medium">{client.name || 'Unknown Name'}</div>
                                                <div className="text-sm text-muted-foreground">{client.email}</div>
                                            </div>
                                        ))}
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
                                                onChange={(e) => updateLegislationItem(item.id, 'title', e.target.value)}
                                                placeholder="Enter legislation title"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Description</Label>
                                            <Textarea
                                                value={item.description}
                                                onChange={(e) => updateLegislationItem(item.id, 'description', e.target.value)}
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
