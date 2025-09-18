"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Search, Plus, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"

// Mock data for clients and agents
const mockClients = [
    { id: "1", name: "Acme Corporation", email: "contact@acme.com" },
    { id: "2", name: "TechStart Inc.", email: "hello@techstart.com" },
    { id: "3", name: "Global Solutions Ltd.", email: "info@globalsolutions.com" },
    { id: "4", name: "Innovation Partners", email: "team@innovation.com" },
]

const mockAgents = [
    { id: "1", name: "Sarah Johnson", specialization: "Corporate Law" },
    { id: "2", name: "Michael Chen", specialization: "Intellectual Property" },
    { id: "3", name: "Emily Rodriguez", specialization: "Contract Law" },
    { id: "4", name: "David Thompson", specialization: "Regulatory Compliance" },
]

interface LegislationItem {
    id: string
    title: string
    description: string
    assignedAgent: string
}

export default function CreateRetainershipPage() {
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [selectedClient, setSelectedClient] = useState("")
    const [clientSearch, setClientSearch] = useState("")
    const [showClientDropdown, setShowClientDropdown] = useState(false)
    const [legislationItems, setLegislationItems] = useState<LegislationItem[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [agentSearches, setAgentSearches] = useState<Record<string, string>>({})
    const [showAgentDropdowns, setShowAgentDropdowns] = useState<Record<string, boolean>>({})
    const router = useRouter()

    // Filter clients based on search
    const filteredClients = mockClients.filter(
        (client) =>
            client.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
            client.email.toLowerCase().includes(clientSearch.toLowerCase()),
    )

    const handleClientSelect = (client: (typeof mockClients)[0]) => {
        setSelectedClient(client.id)
        setClientSearch(client.name)
        setShowClientDropdown(false)
    }

    const addLegislationItem = () => {
        const newItem: LegislationItem = {
            id: Date.now().toString(),
            title: "",
            description: "",
            assignedAgent: "",
        }
        setLegislationItems([...legislationItems, newItem])
    }

    const updateLegislationItem = (id: string, field: keyof LegislationItem, value: string) => {
        setLegislationItems((items) => items.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
    }

    const handleAgentSearch = (itemId: string, searchValue: string) => {
        setAgentSearches((prev) => ({ ...prev, [itemId]: searchValue }))
        setShowAgentDropdowns((prev) => ({ ...prev, [itemId]: true }))
        updateLegislationItem(itemId, "assignedAgent", searchValue)
    }

    const handleAgentSelect = (itemId: string, agent: (typeof mockAgents)[0]) => {
        setAgentSearches((prev) => ({ ...prev, [itemId]: agent.name }))
        setShowAgentDropdowns((prev) => ({ ...prev, [itemId]: false }))
        updateLegislationItem(itemId, "assignedAgent", agent.name)
    }

    const getFilteredAgents = (itemId: string) => {
        const search = agentSearches[itemId] || ""
        return mockAgents.filter(
            (agent) =>
                agent.name.toLowerCase().includes(search.toLowerCase()) ||
                agent.specialization.toLowerCase().includes(search.toLowerCase()),
        )
    }

    const removeLegislationItem = (id: string) => {
        setLegislationItems((items) => items.filter((item) => item.id !== id))
        setAgentSearches((prev) => {
            const newState = { ...prev }
            delete newState[id]
            return newState
        })
        setShowAgentDropdowns((prev) => {
            const newState = { ...prev }
            delete newState[id]
            return newState
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title || !description || !selectedClient) return

        setIsSubmitting(true)

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1000))

        console.log("Creating retainership:", {
            title,
            description,
            clientId: selectedClient,
            legislationItems,
        })

        setIsSubmitting(false)
        router.back()
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto py-8 px-4 max-w-4xl">
                <div className="flex items-center gap-4 mb-8">
                    <Button variant="ghost" size="sm" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Create Retainership</h1>
                        <p className="text-muted-foreground mt-2">Set up a new client retainership agreement</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Main Retainership Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Retainership Details</CardTitle>
                            <CardDescription>Enter the basic information for the retainership agreement</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="retainer-title">Retainership Title</Label>
                                <Input
                                    id="retainer-title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Enter retainership title"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="retainer-description">Description</Label>
                                <Textarea
                                    id="retainer-description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Describe the scope and terms of the retainership"
                                    rows={4}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="client-search">Client</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="client-search"
                                        value={clientSearch}
                                        onChange={(e) => {
                                            setClientSearch(e.target.value)
                                            setShowClientDropdown(true)
                                        }}
                                        onFocus={() => setShowClientDropdown(true)}
                                        placeholder="Search for a client..."
                                        className="pl-10"
                                        required
                                    />
                                    {showClientDropdown && filteredClients.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                                            {filteredClients.map((client) => (
                                                <div
                                                    key={client.id}
                                                    className="px-4 py-3 hover:bg-muted cursor-pointer border-b border-border last:border-b-0"
                                                    onClick={() => handleClientSelect(client)}
                                                >
                                                    <div className="font-medium">{client.name}</div>
                                                    <div className="text-sm text-muted-foreground">{client.email}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Legislation Subcategories */}
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
                                    <p className="text-sm">Click "Add Legislation" to get started.</p>
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
                                                                    <div className="text-sm text-muted-foreground">{agent.specialization}</div>
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

                    {/* Submit Actions */}
                    <div className="flex gap-4 pt-4">
                        <Button type="button" variant="outline" onClick={() => router.back()} className="flex-1">
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || !title || !description || !selectedClient}
                            className="flex-1"
                        >
                            {isSubmitting ? "Creating..." : "Create Retainership"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
