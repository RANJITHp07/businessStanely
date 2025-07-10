"use client"

import type React from "react"

import { useState } from "react"
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload, X, User, FileText, Users } from "lucide-react"

const agentTypes = ["Senior Partner", "Partner", "Associate", "Junior Associate", "Paralegal", "Legal Assistant"]

const specializations = [
    "Corporate Law",
    "Criminal Law",
    "Family Law",
    "Real Estate Law",
    "Personal Injury",
    "Immigration Law",
    "Tax Law",
    "Employment Law",
    "Intellectual Property",
    "Environmental Law",
    "Healthcare Law",
    "Bankruptcy Law",
]

const jurisdictions = [
    "Federal",
    "New York",
    "California",
    "Texas",
    "Florida",
    "Illinois",
    "Pennsylvania",
    "Ohio",
    "Georgia",
    "North Carolina",
    "Michigan",
    "New Jersey",
]

// Mock data for existing agents
const existingAgents = [
    { id: "1", name: "John Smith", type: "Senior Partner" },
    { id: "2", name: "Sarah Johnson", type: "Partner" },
    { id: "3", name: "Michael Brown", type: "Associate" },
    { id: "4", name: "Emily Davis", type: "Associate" },
]

import { Agent } from "@/types";

interface AgentFormProps {
    agent?: Agent;
}

export default function AgentForm({ agent }: AgentFormProps) {
    const [selectedSpecializations, setSelectedSpecializations] = useState<string[]>(agent?.specializations || [])
    const [selectedSubordinates, setSelectedSubordinates] = useState<string[]>([])
    const [photoPreview, setPhotoPreview] = useState<string | null>(agent?.photo || null)
    const [formData, setFormData] = useState({
        name: agent?.name || "",
        email: agent?.email || "",
        phoneNumber: agent?.phoneNumber || "",
        secondaryPhoneNumber: agent?.secondaryPhoneNumber || "",
        agentType: agent?.agentType || "",
        barAssociationId: agent?.barAssociationId || "",
        jurisdiction: agent?.jurisdiction || "",
    })

    const [agentSearch, setAgentSearch] = useState("")

    const filteredAgents = existingAgents.filter(
        (agent) =>
            agent.name.toLowerCase().includes(agentSearch.toLowerCase()) ||
            agent.type.toLowerCase().includes(agentSearch.toLowerCase()),
    )

    const handleSpecializationChange = (specialization: string, checked: boolean) => {
        if (checked) {
            setSelectedSpecializations([...selectedSpecializations, specialization])
        } else {
            setSelectedSpecializations(selectedSpecializations.filter((s) => s !== specialization))
        }
    }

    const handleSubordinateChange = (agentId: string, checked: boolean) => {
        if (checked) {
            setSelectedSubordinates([...selectedSubordinates, agentId])
        } else {
            setSelectedSubordinates(selectedSubordinates.filter((id) => id !== agentId))
        }
    }

    const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onload = (e) => {
                setPhotoPreview(e.target?.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    const removePhoto = () => {
        setPhotoPreview(null)
    }

    const handleInputChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const url = agent ? `/api/agents/${agent.id}` : "/api/agents";
        const method = agent ? "PUT" : "POST";

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...formData,
                    specializations: selectedSpecializations,
                    subordinates: selectedSubordinates,
                    photo: photoPreview,
                }),
            });

            if (response.ok) {
                alert(`Agent ${agent ? 'updated' : 'created'} successfully!`);
            } else {
                const errorData = await response.json();
                alert(`Failed to ${agent ? 'update' : 'create'} agent: ${errorData.error}`);
            }
        } catch (error) {
            console.error("Error submitting form:", error);
            alert("An unexpected error occurred. Please try again.");
        }
    }

    return (
        <div className="mx-auto p-6 max-w-10xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">{agent ? "Edit Agent" : "Create New Agent"}</h1>
                <p className="text-muted-foreground mt-2">
                    {agent ? "Update the agent's details and assignments." : "Add a new agent to your organization with their details and assignments."}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Personal Information */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Personal Information
                        </CardTitle>
                        <CardDescription>Basic details about the agent</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Photo Upload */}
                        <div className="space-y-2">
                            <Label>Profile Photo</Label>
                            <div className="flex items-center gap-4">
                                <Avatar className="h-20 w-20">
                                    <AvatarImage src={photoPreview || ""} />
                                    <AvatarFallback>
                                        <User className="h-8 w-8" />
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="photo-upload" className="cursor-pointer">
                                        <div className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50">
                                            <Upload className="h-4 w-4" />
                                            <span className="text-sm">Upload Photo</span>
                                        </div>
                                        <Input
                                            id="photo-upload"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handlePhotoUpload}
                                        />
                                    </Label>
                                    {photoPreview && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={removePhoto}
                                            className="w-fit bg-transparent"
                                        >
                                            <X className="h-4 w-4 mr-1" />
                                            Remove
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Full Name *</Label>
                                <Input
                                    id="name"
                                    placeholder="Enter full name"
                                    value={formData.name}
                                    onChange={(e) => handleInputChange("name", e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address *</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="Enter email address"
                                    value={formData.email}
                                    onChange={(e) => handleInputChange("email", e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number *</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    placeholder="Enter phone number"
                                    value={formData.phoneNumber}
                                    onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="secondary-phone">Secondary Phone Number</Label>
                                <Input
                                    id="secondary-phone"
                                    type="tel"
                                    placeholder="Enter secondary phone number"
                                    value={formData.secondaryPhoneNumber}
                                    onChange={(e) => handleInputChange("secondaryPhoneNumber", e.target.value)}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Professional Information */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Professional Information
                        </CardTitle>
                        <CardDescription>Agent type, specializations, and credentials</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="agent-type">Agent Type *</Label>
                                <Select value={formData.agentType} onValueChange={(value) => handleInputChange("agentType", value)}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select agent type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {agentTypes.map((type) => (
                                            <SelectItem key={type} value={type}>
                                                {type}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="jurisdiction">Jurisdiction *</Label>
                                <Select
                                    value={formData.jurisdiction}
                                    onValueChange={(value) => handleInputChange("jurisdiction", value)}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select jurisdiction" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {jurisdictions.map((jurisdiction) => (
                                            <SelectItem key={jurisdiction} value={jurisdiction}>
                                                {jurisdiction}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="bar-id">Bar Association ID *</Label>
                            <Input
                                id="bar-id"
                                placeholder="Enter bar association ID"
                                value={formData.barAssociationId}
                                onChange={(e) => handleInputChange("barAssociationId", e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-3">
                            <Label>Specializations *</Label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {specializations.map((specialization) => (
                                    <div key={specialization} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={specialization}
                                            checked={selectedSpecializations.includes(specialization)}
                                            onCheckedChange={(checked) => handleSpecializationChange(specialization, checked as boolean)}
                                        />
                                        <Label htmlFor={specialization} className="text-sm font-normal">
                                            {specialization}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                            {selectedSpecializations.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {selectedSpecializations.map((spec) => (
                                        <Badge key={spec} variant="secondary">
                                            {spec}
                                            <button
                                                type="button"
                                                onClick={() => handleSpecializationChange(spec, false)}
                                                className="ml-2 hover:text-destructive"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Team Management */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Team Management
                        </CardTitle>
                        <CardDescription>Assign agents to work under this agent</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Search Input */}
                        <div className="space-y-2">
                            <Label htmlFor="agent-search">Search Agents</Label>
                            <Input
                                id="agent-search"
                                placeholder="Search by name or type..."
                                value={agentSearch}
                                onChange={(e) => setAgentSearch(e.target.value)}
                                className="max-w-md"
                            />
                        </div>

                        {/* Selected Agents Display */}
                        {selectedSubordinates.length > 0 && (
                            <div className="space-y-3">
                                <Label>Selected Agents ({selectedSubordinates.length})</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {selectedSubordinates.map((agentId) => {
                                        const agent = existingAgents.find((a) => a.id === agentId)
                                        return agent ? (
                                            <div
                                                key={agent.id}
                                                className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
                                            >
                                                <div className="flex items-center space-x-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarFallback className="bg-blue-100 text-blue-600">
                                                            {agent.name
                                                                .split(" ")
                                                                .map((n) => n[0])
                                                                .join("")}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-medium text-blue-900">{agent.name}</p>
                                                        <p className="text-sm text-blue-600">{agent.type}</p>
                                                    </div>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleSubordinateChange(agent.id, false)}
                                                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : null
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Available Agents */}
                        <div className="space-y-3">
                            <Label>Available Agents</Label>
                            {filteredAgents.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-4 text-center">
                                    {agentSearch ? "No agents found matching your search." : "No agents available."}
                                </p>
                            ) : (
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {filteredAgents.map((agent) => (
                                        <div
                                            key={agent.id}
                                            className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${selectedSubordinates.includes(agent.id) ? "bg-gray-50 border-gray-300" : "hover:bg-gray-50"
                                                }`}
                                        >
                                            <div className="flex items-center space-x-3">
                                                <Checkbox
                                                    id={agent.id}
                                                    checked={selectedSubordinates.includes(agent.id)}
                                                    onCheckedChange={(checked) => handleSubordinateChange(agent.id, checked as boolean)}
                                                />
                                                <Avatar className="h-8 w-8">
                                                    <AvatarFallback>
                                                        {agent.name
                                                            .split(" ")
                                                            .map((n) => n[0])
                                                            .join("")}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <Label htmlFor={agent.id} className="font-medium cursor-pointer">
                                                        {agent.name}
                                                    </Label>
                                                    <p className="text-sm text-muted-foreground">{agent.type}</p>
                                                </div>
                                            </div>
                                            {selectedSubordinates.includes(agent.id) && (
                                                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                                    Selected
                                                </Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Submit Button */}
                <div className="flex justify-end gap-4">
                    <Button type="button" variant="outline">
                        Cancel
                    </Button>
                    <Button type="submit">{agent ? "Update Agent" : "Create Agent"}</Button>
                </div>
            </form>
        </div>
    )
}

