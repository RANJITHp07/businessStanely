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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { CalendarIcon, FileText, User, Phone, Mail, AlertCircle, Users, Plus } from "lucide-react"
import { format, isBefore, startOfDay } from "date-fns"
import { cn } from "@/lib/utils"

import { Client, Agent, Task } from "@/types"
import { useParams, useRouter } from "next/navigation"
import { toast } from "react-toastify"

const taskPriorities = [
    { value: "low", label: "Low", color: "bg-green-100 text-green-800 border-green-200" },
    { value: "medium", label: "Medium", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    { value: "high", label: "High", color: "bg-red-100 text-red-800 border-red-200" },
]

export default function TaskForm() {
    const [formData, setFormData] = useState({
        title: "",
        clientId: "",
        priority: "",
        assignedToId: "",
        description: "",
    })
    const [clients, setClients] = useState<Client[]>([])
    const [agents, setAgents] = useState<Agent[]>([])
    const [selectedClient, setSelectedClient] = useState<Client | null>(null)
    const [dueDate, setDueDate] = useState<Date>()
    const [isEditMode, setIsEditMode] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedClientType, setSelectedClientType] = useState("")
    
    // New client form state
    const [newClientData, setNewClientData] = useState({
        firstName: "",
        lastName: "",
        organizationName: "",
        authorizedPersonName: "",
        email: "",
        phoneNumber: "",
    })
    
    const params = useParams()
    const router = useRouter()
    const { id } = params

    useEffect(() => {
        const fetchClientsAndAgents = async () => {
            try {
                const [clientsRes, agentsRes] = await Promise.all([
                    fetch("/api/clients"),
                    fetch("/api/agents"),
                ]);
                const clientsData = await clientsRes.json();
                const agentsData = await agentsRes.json();
                setClients(clientsData);
                setAgents(agentsData);
            } catch (error) {
                console.error("Failed to fetch clients or agents", error);
            }
        };
        fetchClientsAndAgents();

        if (id) {
            setIsEditMode(true)
            const fetchTask = async () => {
                try {
                    const response = await fetch(`/api/tasks/${id}`)
                    if (response.ok) {
                        const task: Task = await response.json()
                        setFormData({
                            title: task.title,
                            clientId: task.client?.id || "",
                            priority: task.priority,
                            assignedToId: task.assignedTo?.id || "",
                            description: task.description || "",
                        })
                        if (task.dueDate) {
                            setDueDate(new Date(task.dueDate))
                        }
                    }
                } catch (error) {
                    console.error("Failed to fetch task", error)
                }
            }
            fetchTask()
        }
    }, [id]);

    // Auto-fill contact number and email when client is selected
    useEffect(() => {
        if (formData.clientId) {
            const client = clients.find((c) => c.id === formData.clientId)
            if (client) {
                setSelectedClient(client)
            }
        } else {
            setSelectedClient(null)
        }
    }, [formData.clientId, clients])

    const handleInputChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }))
    }

    const handleNewClientInputChange = (field: string, value: string) => {
        setNewClientData((prev) => ({ ...prev, [field]: value }))
    }

    const handleAddClientClick = () => {
        setIsModalOpen(true)
        // Reset form data when opening modal
        setSelectedClientType("")
        setNewClientData({
            firstName: "",
            lastName: "",
            organizationName: "",
            authorizedPersonName: "",
            email: "",
            phoneNumber: "",
        })
    }

    const handleCreateClient = async () => {
        try {
            const clientData = {
                clientType: selectedClientType,
                ...(selectedClientType === "individual" ? {
                    firstName: newClientData.firstName,
                    lastName: newClientData.lastName,
                } : {
                    organizationName: newClientData.organizationName,
                    authorizedPersonName: newClientData.authorizedPersonName,
                }),
                email: newClientData.email,
                phoneNumber: newClientData.phoneNumber,
            }

            const response = await fetch("/api/clients", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(clientData),
            })

            if (response.ok) {
                const newClient = await response.json()
                setClients((prev) => [...prev, newClient])
                setFormData((prev) => ({ ...prev, clientId: newClient.id }))
                setIsModalOpen(false)
                toast.success("Client created successfully!")
            } else {
                const errorData = await response.json()
                toast.error(errorData.error || "Failed to create client")
            }
        } catch (error) {
            console.error("Error creating client:", error)
            toast.error("An unexpected error occurred while creating client")
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const url = isEditMode ? `/api/tasks/${id}` : '/api/tasks'
        const method = isEditMode ? 'PUT' : 'POST'

        if (!isEditMode && agents.length === 0) {
            alert("Cannot create a task without any agents in the system.");
            return;
        }

        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...formData,
                    dueDate,
                    status: 'To Do',
                    createdById: !isEditMode ? agents[0].id : undefined,
                }),
            });

            if (response.ok) {
                toast.success(`Task ${isEditMode ? 'updated' : 'created'} successfully!`)
                router.push('/task')
            } else {
                const errorData = await response.json();
                toast.error(errorData.error)
            }
        } catch (error) {
            console.error("Error submitting form:", error);
            alert("An unexpected error occurred. Please try again.");
        }
    }

    const getPriorityBadge = (priority: string | null) => {
        if (!priority) return null;
        const priorityConfig = taskPriorities.find((p) => p.value === priority.toLowerCase())
        if (!priorityConfig) return null

        return (
            <Badge className={`${priorityConfig.color} border`}>
                <AlertCircle className="w-3 h-3 mr-1" />
                {priorityConfig.label}
            </Badge>
        )
    }

    const getClientTypeBadge = (type: string | null) => {
        if (!type) return null;
        return (
            <Badge variant={type === "organization" ? "default" : "secondary"} className="text-xs mx-2">
                {type}
            </Badge>
        )
    }

    const isCreateClientFormValid = () => {
        if (!selectedClientType || !newClientData.email || !newClientData.phoneNumber) return false
        
        if (selectedClientType === "individual") {
            return newClientData.firstName && newClientData.lastName
        } else {
            return newClientData.organizationName && newClientData.authorizedPersonName
        }
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">{isEditMode ? "Edit Task" : "Create New Task"}</h1>
                <p className="text-muted-foreground mt-2">
                    {isEditMode ? "Update the details of the existing task." : "Create and assign a new task with client information and completion date."}
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
                                value={formData.title}
                                onChange={(e) => handleInputChange("title", e.target.value)}
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
                    <CardHeader className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                Client Information
                            </CardTitle>
                            <CardDescription>
                                Select client and their contact details will be auto-filled
                            </CardDescription>
                        </div>

                        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                            <DialogTrigger asChild>
                                <Button type="button" onClick={handleAddClientClick}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Client
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Add New Client</DialogTitle>
                                    <DialogDescription>
                                        Select the client type and fill in the details
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    {/* Client Type Selection */}
                                    <div className="space-y-2">
                                        <Label htmlFor="client-type">Client Type *</Label>
                                        <Select value={selectedClientType} onValueChange={setSelectedClientType}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Choose client type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="individual">
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-4 w-4" />
                                                        Individual
                                                    </div>
                                                </SelectItem>
                                                <SelectItem value="organization">
                                                    <div className="flex items-center gap-2">
                                                        <Users className="h-4 w-4" />
                                                        Organization
                                                    </div>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Individual Form Fields */}
                                    {selectedClientType === "individual" && (
                                        <>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="firstName">First Name *</Label>
                                                    <Input
                                                        id="firstName"
                                                        placeholder="Enter first name"
                                                        value={newClientData.firstName}
                                                        onChange={(e) => handleNewClientInputChange("firstName", e.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="lastName">Last Name *</Label>
                                                    <Input
                                                        id="lastName"
                                                        placeholder="Enter last name"
                                                        value={newClientData.lastName}
                                                        onChange={(e) => handleNewClientInputChange("lastName", e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="email">Email *</Label>
                                                <div className="relative">
                                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        id="email"
                                                        type="email"
                                                        placeholder="Enter email address"
                                                        value={newClientData.email}
                                                        onChange={(e) => handleNewClientInputChange("email", e.target.value)}
                                                        className="pl-10"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="phoneNumber">Phone Number *</Label>
                                                <div className="relative">
                                                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        id="phoneNumber"
                                                        placeholder="Enter phone number"
                                                        value={newClientData.phoneNumber}
                                                        onChange={(e) => handleNewClientInputChange("phoneNumber", e.target.value)}
                                                        className="pl-10"
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Organization Form Fields */}
                                    {selectedClientType === "organization" && (
                                        <>
                                            <div className="space-y-2">
                                                <Label htmlFor="organizationName">Organization Name *</Label>
                                                <Input
                                                    id="organizationName"
                                                    placeholder="Enter organization name"
                                                    value={newClientData.organizationName}
                                                    onChange={(e) => handleNewClientInputChange("organizationName", e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="authorizedPersonName">Authorized Person *</Label>
                                                <Input
                                                    id="authorizedPersonName"
                                                    placeholder="Enter authorized person name"
                                                    value={newClientData.authorizedPersonName}
                                                    onChange={(e) => handleNewClientInputChange("authorizedPersonName", e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="email">Email *</Label>
                                                <div className="relative">
                                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        id="email"
                                                        type="email"
                                                        placeholder="Enter email address"
                                                        value={newClientData.email}
                                                        onChange={(e) => handleNewClientInputChange("email", e.target.value)}
                                                        className="pl-10"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="phoneNumber">Phone Number *</Label>
                                                <div className="relative">
                                                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        id="phoneNumber"
                                                        placeholder="Enter phone number"
                                                        value={newClientData.phoneNumber}
                                                        onChange={(e) => handleNewClientInputChange("phoneNumber", e.target.value)}
                                                        className="pl-10"
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                                
                                {/* Modal Actions */}
                                <div className="flex justify-end gap-3 pt-4 border-t">
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        onClick={() => setIsModalOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button 
                                        type="button" 
                                        onClick={handleCreateClient}
                                        disabled={!isCreateClientFormValid()}
                                    >
                                        Create Client
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="client">Select Client *</Label>
                            <Select value={formData.clientId} onValueChange={(value) => handleInputChange("clientId", value)}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Choose a client" />
                                </SelectTrigger>
                                <SelectContent>
                                    {clients.map((client) => (
                                        <SelectItem key={client.id} value={client.id}>
                                            <div className="flex items-center justify-between w-full">
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarFallback className="text-xs">
                                                            {(client.clientType === 'individual' ? `${client.firstName ?? ''} ${client.lastName ?? ''}` : client.organizationName)
                                                                ?.split(" ")
                                                                .map((n) => n[0])
                                                                .join("")}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <span className="font-medium">{client.clientType === 'individual' ? `${client.firstName} ${client.lastName}` : client.organizationName}</span>
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
                                        value={selectedClient?.phoneNumber || ''}
                                        readOnly
                                        className="pl-10"
                                        required
                                    />
                                </div>
                                {selectedClient && (
                                    <p className="text-xs text-muted-foreground">Auto-filled from {selectedClient.clientType === 'individual' ? `${selectedClient.firstName} ${selectedClient.lastName}` : selectedClient.organizationName}</p>
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
                                        value={selectedClient?.email || ''}
                                        readOnly
                                        className="pl-10"
                                        required
                                    />
                                </div>
                                {selectedClient && (
                                    <p className="text-xs text-muted-foreground">Auto-filled from {selectedClient.clientType === 'individual' ? `${selectedClient.firstName} ${selectedClient.lastName}` : selectedClient.organizationName}</p>
                                )}
                            </div>
                        </div>

                        {/* Selected Client Preview */}
                        {selectedClient && (
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarFallback className="bg-blue-100 text-blue-600">
                                            {(selectedClient.clientType === 'individual' ? `${selectedClient.firstName} ${selectedClient.lastName}` : selectedClient.organizationName)
                                                ?.split(" ")
                                                .map((n) => n[0])
                                                .join("")}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 mx-2">
                                        <h4 className="font-medium text-blue-900">{selectedClient.clientType === 'individual' ? `${selectedClient.firstName} ${selectedClient.lastName}` : selectedClient.organizationName}</h4>
                                        {/* <p className="text-sm text-blue-600">Contact: {selectedClient.authorizedPersonName || 'N/A'}</p> */}
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
                                    value={formData.assignedToId}
                                    onValueChange={(value) => handleInputChange("assignedToId", value)}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select an agent" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {agents.map((agent) => (
                                            <SelectItem key={agent.id} value={agent.id}>
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarFallback className="text-xs">
                                                            {agent.name
                                                                .toUpperCase()
                                                                .split(" ")
                                                                .map((n) => n[0])
                                                                .join("")}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <span className="font-medium">{agent.name.charAt(0).toUpperCase() + agent.name.slice(1)}
                                                        </span>
                                                        <span className="text-sm text-muted-foreground ml-2">({agent.agentType})</span>
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
                                            !dueDate && "text-muted-foreground",
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dueDate ? format(dueDate, "PPP") : "Select completion date"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" disabled={(date) => isBefore(startOfDay(date), startOfDay(new Date()))} selected={dueDate} onSelect={setDueDate} initialFocus />
                                </PopoverContent>
                            </Popover>
                            <p className="text-xs text-muted-foreground">Choose the date when this task should be completed</p>
                        </div>

                        {/* Assignment Preview */}
                        {formData.assignedToId && (
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarFallback className="bg-green-100 text-green-600">
                                            {agents
                                                .find((a) => a.id === formData.assignedToId)
                                                ?.name.split(" ")
                                                .map((n) => n[0])
                                                .join("")
                                            }
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h4 className="font-medium text-green-900">
                                            Assigned to: {agents.find((a) => a.id === formData.assignedToId)?.name}
                                        </h4>
                                        <p className="text-sm text-green-600">
                                            Role: {agents.find((a) => a.id === formData.assignedToId)?.agentType}
                                        </p>
                                        {dueDate && (
                                            <p className="text-sm text-green-600">Due: {format(dueDate, "EEEE, MMMM do, yyyy")}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Submit Buttons */}
                <div className="flex justify-end gap-4">
                    <Button className="bg-[#f42b03] hover:bg-[#f42b03] shadow-none hover:shadow-lg transition-shadow duration-300 text-white hover:text-white cursor-pointer" type="button" variant="outline">
                        Cancel
                    </Button>
                    <Button type="submit" className=" cursor-pointer shadow-none hover:shadow-lg transition-shadow duration-300" >
                        {isEditMode ? "Update Task" : "Create Task"}
                    </Button>
                </div>
            </form>
        </div>
    )
}