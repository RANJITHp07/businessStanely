"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, FileText, User, Phone, Mail, AlertCircle, Users } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

// Mock data for clients
const mockClients = [
    {
        id: "1",
        name: "Acme Corporation",
        contactPerson: "John Anderson",
        email: "john.anderson@acme.com",
        phone: "+1 (555) 123-4567",
        clientType: "Corporate",
    },
    {
        id: "2",
        name: "Sarah Mitchell",
        contactPerson: "Sarah Mitchell",
        email: "sarah.mitchell@email.com",
        phone: "+1 (555) 234-5678",
        clientType: "Individual",
    },
    {
        id: "3",
        name: "TechStart Inc.",
        contactPerson: "Michael Chen",
        email: "michael.chen@techstart.com",
        phone: "+1 (555) 345-6789",
        clientType: "Corporate",
    },
    {
        id: "4",
        name: "Robert Williams",
        contactPerson: "Robert Williams",
        email: "robert.williams@email.com",
        phone: "+1 (555) 456-7890",
        clientType: "Individual",
    },
    {
        id: "5",
        name: "Global Enterprises",
        contactPerson: "Lisa Thompson",
        email: "lisa.thompson@global.com",
        phone: "+1 (555) 567-8901",
        clientType: "Corporate",
    },
]

// Mock data for agents
const mockAgents = [
    { id: "1", name: "John Smith", type: "Senior Partner" },
    { id: "2", name: "Sarah Johnson", type: "Partner" },
    { id: "3", name: "Michael Brown", type: "Associate" },
    { id: "4", name: "Emily Davis", type: "Junior Associate" },
    { id: "5", name: "Robert Wilson", type: "Paralegal" },
    { id: "6", name: "Jennifer Martinez", type: "Legal Assistant" },
]

const taskPriorities = [
    { value: "low", label: "Low", color: "bg-green-100 text-green-800 border-green-200" },
    { value: "medium", label: "Medium", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    { value: "high", label: "High", color: "bg-red-100 text-red-800 border-red-200" },
]

export default function CreateTask() {
    const [formData, setFormData] = useState({
        taskName: "",
        clientId: "",
        contactNumber: "",
        emailId: "",
        priority: "",
        assignedAgent: "",
        description: "",
    })

    const [selectedClient, setSelectedClient] = useState<(typeof mockClients)[0] | null>(null)
    const [completionDate, setCompletionDate] = useState<Date>()

    // Auto-fill contact number and email when client is selected
    useEffect(() => {
        if (formData.clientId) {
            const client = mockClients.find((c) => c.id === formData.clientId)
            if (client) {
                setSelectedClient(client)
                setFormData((prev) => ({
                    ...prev,
                    contactNumber: client.phone,
                    emailId: client.email,
                }))
            }
        } else {
            setSelectedClient(null)
            setFormData((prev) => ({
                ...prev,
                contactNumber: "",
                emailId: "",
            }))
        }
    }, [formData.clientId])

    const handleInputChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }))
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        console.log("Task submitted:", {
            ...formData,
            selectedClient,
            completionDate,
        })
        // Handle form submission here
        alert("Task created successfully!")
    }

    const getPriorityBadge = (priority: string) => {
        const priorityConfig = taskPriorities.find((p) => p.value === priority)
        if (!priorityConfig) return null

        return (
            <Badge className={`${priorityConfig.color} border`}>
                <AlertCircle className="w-3 h-3 mr-1" />
                {priorityConfig.label}
            </Badge>
        )
    }

    const getClientTypeBadge = (type: string) => {
        return (
            <Badge variant={type === "Corporate" ? "default" : "secondary"} className="text-xs">
                {type}
            </Badge>
        )
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Create New Task</h1>
                <p className="text-muted-foreground mt-2">
                    Create and assign a new task with client information and completion date.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Task Basic Information */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Task Information
                        </CardTitle>
                        <CardDescription>Enter the basic task details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="task-name">Task Name *</Label>
                            <Input
                                id="task-name"
                                placeholder="Enter task name (e.g., Contract Review, Legal Research)"
                                value={formData.taskName}
                                onChange={(e) => handleInputChange("taskName", e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Task Description *</Label>
                            <Textarea
                                id="description"
                                placeholder="Describe the task in detail, including any specific requirements or instructions..."
                                value={formData.description}
                                onChange={(e) => handleInputChange("description", e.target.value)}
                                rows={4}
                                required
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Client Information */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Client Information
                        </CardTitle>
                        <CardDescription>Select client and their contact details will be auto-filled</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="client">Select Client *</Label>
                            <Select value={formData.clientId} onValueChange={(value) => handleInputChange("clientId", value)}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Choose a client" />
                                </SelectTrigger>
                                <SelectContent>
                                    {mockClients.map((client) => (
                                        <SelectItem key={client.id} value={client.id}>
                                            <div className="flex items-center justify-between w-full">
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarFallback className="text-xs">
                                                            {client.name
                                                                .split(" ")
                                                                .map((n) => n[0])
                                                                .join("")}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <span className="font-medium">{client.name}</span>
                                                        {client.contactPerson !== client.name && (
                                                            <span className="text-sm text-muted-foreground ml-2">({client.contactPerson})</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {getClientTypeBadge(client.clientType)}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Auto-filled Contact Information */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="contact-number">Contact Number *</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="contact-number"
                                        placeholder="Contact number will auto-fill"
                                        value={formData.contactNumber}
                                        onChange={(e) => handleInputChange("contactNumber", e.target.value)}
                                        className="pl-10"
                                        required
                                    />
                                </div>
                                {selectedClient && (
                                    <p className="text-xs text-muted-foreground">Auto-filled from {selectedClient.name}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email-id">Email ID *</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="email-id"
                                        type="email"
                                        placeholder="Email will auto-fill"
                                        value={formData.emailId}
                                        onChange={(e) => handleInputChange("emailId", e.target.value)}
                                        className="pl-10"
                                        required
                                    />
                                </div>
                                {selectedClient && (
                                    <p className="text-xs text-muted-foreground">Auto-filled from {selectedClient.name}</p>
                                )}
                            </div>
                        </div>

                        {/* Selected Client Preview */}
                        {selectedClient && (
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarFallback className="bg-blue-100 text-blue-600">
                                            {selectedClient.name
                                                .split(" ")
                                                .map((n) => n[0])
                                                .join("")}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <h4 className="font-medium text-blue-900">{selectedClient.name}</h4>
                                        <p className="text-sm text-blue-600">Contact: {selectedClient.contactPerson}</p>
                                    </div>
                                    {getClientTypeBadge(selectedClient.clientType)}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Task Priority, Assignment & Completion Date */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Priority, Assignment & Schedule
                        </CardTitle>
                        <CardDescription>Set task priority, assign to an agent, and set completion date</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="priority">Task Priority *</Label>
                                <Select value={formData.priority} onValueChange={(value) => handleInputChange("priority", value)}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select priority level" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {taskPriorities.map((priority) => (
                                            <SelectItem key={priority.value} value={priority.value}>
                                                <div className="flex items-center gap-2">
                                                    <AlertCircle className="w-4 h-4" />
                                                    {priority.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {formData.priority && <div className="mt-2">{getPriorityBadge(formData.priority)}</div>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="assigned-agent">Assign Task To *</Label>
                                <Select
                                    value={formData.assignedAgent}
                                    onValueChange={(value) => handleInputChange("assignedAgent", value)}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select an agent" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {mockAgents.map((agent) => (
                                            <SelectItem key={agent.id} value={agent.id}>
                                                <div className="flex items-center gap-2">
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
                                                        <span className="text-sm text-muted-foreground ml-2">({agent.type})</span>
                                                    </div>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Completion Date */}
                        <div className="space-y-2">
                            <Label>Task Completion Date *</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !completionDate && "text-muted-foreground",
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {completionDate ? format(completionDate, "PPP") : "Select completion date"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={completionDate} onSelect={setCompletionDate} initialFocus />
                                </PopoverContent>
                            </Popover>
                            <p className="text-xs text-muted-foreground">Choose the date when this task should be completed</p>
                        </div>

                        {/* Assignment Preview */}
                        {formData.assignedAgent && (
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarFallback className="bg-green-100 text-green-600">
                                            {mockAgents
                                                .find((a) => a.id === formData.assignedAgent)
                                                ?.name.split(" ")
                                                .map((n) => n[0])
                                                .join("")}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h4 className="font-medium text-green-900">
                                            Assigned to: {mockAgents.find((a) => a.id === formData.assignedAgent)?.name}
                                        </h4>
                                        <p className="text-sm text-green-600">
                                            Role: {mockAgents.find((a) => a.id === formData.assignedAgent)?.type}
                                        </p>
                                        {completionDate && (
                                            <p className="text-sm text-green-600">Due: {format(completionDate, "EEEE, MMMM do, yyyy")}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Submit Buttons */}
                <div className="flex justify-end gap-4">
                    <Button  className="bg-[#f42b03] hover:bg-[#f42b03] shadow-none hover:shadow-lg transition-shadow duration-300 text-white hover:text-white cursor-pointer"  type="button" variant="outline">
                        Cancel
                    </Button>
                    <Button type="submit"  className=" cursor-pointer shadow-none hover:shadow-lg transition-shadow duration-300" >
                        Create Task
                    </Button>
                </div>
            </form>
        </div>
    )
}
