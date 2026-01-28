"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useAgentContext } from "@/lib/agent-context"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarIcon, Check, Mail, Phone, MapPin, Banknote, FileText, UserPlus, Bell } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "react-toastify"
import type { CountryData } from "react-phone-input-2"
import PhoneInput from "react-phone-input-2"
import "react-phone-input-2/lib/style.css"
import { Badge } from "@/components/ui/badge"

type LeadSource = {
    id: string
    name: string
}

export default function NewProspectPage() {
    const agent = useAgentContext()
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [assignedTo, setAssignedTo] = useState("")
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<any | null>(null);
    const [categorySearchQuery, setCategorySearchQuery] = useState("");
    const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
    const [assignTouched, setAssignTouched] = useState(false)
    const [reminderDate, setReminderDate] = useState<Date>()
    const [leadSources, setLeadSources] = useState<LeadSource[]>([])
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: "",
        phoneNumber: "",
        address: "",
        email: "",
        leadSource: "",
        description: "",
        amount: "",
        dialCode: "",
        serviceId: ""
    })

    const handleSubmit = async (e: React.FormEvent) => {
        setLoading(true)
        e.preventDefault()
        setAssignTouched(true)
        // For Client Advisor/Manager, assignedTo is required
        if ((agent?.agentType === "Client Advisor" || agent?.agentType === "Client Manager") && !assignedTo) {
            toast.error("Please assign this prospect to yourself or another agent.")
            return
        }
        const payload = {
            ...formData,
            dialCode: formData.dialCode,
            serviceId: formData.serviceId,
            amount: formData.amount ? Number.parseFloat(formData.amount) : undefined,
            assignedAgentId: assignedTo || undefined,
            nextFollowUp: reminderDate ? reminderDate.toISOString() : undefined,
            leadSourceId: leadSources.find((source) => source.name == formData.leadSource)?.id
        }
        try {
            const res = await fetch("/api/prospects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            if (!res.ok) throw new Error("Failed to create prospect")
            toast.success("Successfully created prospect")
            router.push("/sales/prospects/table")
        } catch (err) {
            toast.error("Failed to create prospect")
        } finally {
            setLoading(false)
        }
    }

    type TeamMember = {
        id: string
        name: string
        email: string
    }
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
    // Fetch agent info and subordinates if needed
    useEffect(() => {
        async function fetchTeam() {
            // Get current agent info
            const agentRes = await fetch("/api/agents/me")
            if (!agentRes.ok) return setTeamMembers([])
            const agent = await agentRes.json()
            if (agent.agentRole === "Advisor Agent" && agent.agentType === "Client Manager") {
                // Fetch subordinates
                const subRes = await fetch("/api/agents/me/subordinates")
                if (subRes.ok) {
                    const subs = await subRes.json()
                    setTeamMembers(subs)
                    return
                }
            }
            // Fallback: fetch all agents
            const allRes = await fetch("/api/agents")
            if (allRes.ok) {
                if (agent.agentRole === "Advisor Agent" && agent.agentType === "Lead Maker") {
                    const allAgentsData = await allRes.json();

                    const filteredAgents = Array.isArray(allAgentsData)
                        ? allAgentsData.filter((agent) => agent.agentRole === "Advisor Agent")
                        : [];

                    setTeamMembers(filteredAgents);
                }
            } else {
                setTeamMembers([])
            }
        }
        fetchTeam()
    }, [])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        })
    }

    // Always show self as first option in teamMembersWithSelf, marked as (You), and remove duplicates
    let teamMembersWithSelf = teamMembers
    if (agent && (agent.agentType === "Client Advisor" || agent.agentType === "Client Manager")) {
        // Remove any existing entry for self
        const filtered = teamMembers.filter((m) => m.id !== agent.id)
        teamMembersWithSelf = [{ id: agent.id, name: agent.name + " (You)", email: agent.email }, ...filtered]
    }

    useEffect(() => {
        const fetchTaskCategories = async () => {
            try {
                const res = await fetch("/api/task-categories")
                const data = await res.json()
                setCategories(data)
            } finally {
                setLoading(false)
            }
        }

        fetchTaskCategories()
    }, [])

    const filteredCategories = Array.isArray(categories)
        ? categories.filter((category) => {
            // Only show approved and pending categories, not rejected ones
            if (!category || typeof category !== 'object') return false;
            if (category.status === "rejected") return false;
            return (
                typeof category.name === 'string' &&
                category.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
            );
        })
        : [];

    const handleCategorySelection = (category: any) => {
        setFormData((prev) => ({ ...prev, serviceId: category.id }));
        setCategorySearchQuery(category.name);
        setShowCategorySuggestions(false);
        setSelectedCategory(category);
    };

    useEffect(() => {
        async function fetchLeadSources() {
            try {
                const res = await fetch("/api/lead_source")
                if (!res.ok) throw new Error("Failed to fetch lead sources")
                const data = await res.json()
                setLeadSources(data)
            } catch (error) {
                console.error(error)
                setLeadSources([])
            }
        }

        fetchLeadSources()
    }, [])

    return (
        <div className="min-h-screen p-4 md:p-8 bg-[#e3f2fd]">
            <div className="mx-auto ">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-foreground">Create New Prospect</h1>
                    <p className="text-muted-foreground mt-2">Add a new prospect to your pipeline</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <UserPlus className="size-5 text-primary" />
                                <CardTitle>Contact Information</CardTitle>
                            </div>
                            <CardDescription>Basic contact details for the prospect</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Name & Phone */}
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="flex items-center gap-2">
                                        <span>Name</span>
                                        <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="name"
                                        name="name"
                                        placeholder="Enter prospect name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="phoneNumber" className="flex items-center gap-2">
                                        <Phone className="h-4 w-4" />
                                        <span>Phone Number</span>
                                        <span className="text-destructive">*</span>
                                    </Label>

                                    <PhoneInput
                                        country={"in"}
                                        value={formData.phoneNumber}
                                        onChange={(phone, country) => {
                                            console.log(country, phone)
                                            setFormData({ ...formData, phoneNumber: phone, dialCode: (country as CountryData).dialCode })

                                        }
                                        }
                                        inputProps={{
                                            name: "phoneNumber",
                                            required: true,
                                        }}
                                        inputStyle={{
                                            width: "100%",
                                            height: "2.5rem",
                                            borderRadius: "0.5rem",
                                        }}
                                        buttonStyle={{
                                            borderRadius: "0.5rem 0 0 0.5rem",
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Email & Amount */}
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="flex items-center gap-2">
                                        <Mail className="size-4" />
                                        <span>Email</span>
                                        <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        placeholder="Enter email address"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="amount" className="flex items-center gap-2">
                                        <Banknote className="size-4" />
                                        <span>Amount</span>
                                    </Label>
                                    <Input
                                        id="amount"
                                        name="amount"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="Enter amount (optional)"
                                        value={formData.amount}
                                        onChange={handleInputChange}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 relative">
                                <Label htmlFor="taskCategory">Service</Label>
                                <div className="relative">
                                    <Input
                                        id="taskCategory"
                                        type="text"
                                        placeholder="Type to search services..."
                                        value={categorySearchQuery}
                                        onChange={(e) => {
                                            setCategorySearchQuery(e.target.value);
                                            if (e.target.value.trim()) {
                                                setShowCategorySuggestions(true);
                                            } else {
                                                setShowCategorySuggestions(false);
                                            }
                                        }}
                                        onFocus={() => {
                                            if (categorySearchQuery.trim()) {
                                                setShowCategorySuggestions(true);
                                            }
                                        }}
                                        className="w-full"
                                    />

                                    {/* Category Suggestions Dropdown - Only show when searching */}
                                    {showCategorySuggestions &&
                                        categorySearchQuery.trim() &&
                                        filteredCategories.length > 0 && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                                                {filteredCategories.map((category) => (
                                                    <div
                                                        key={category.id}
                                                        className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                                        onClick={() => {
                                                            handleCategorySelection(category);
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div>
                                                                <span className="font-medium">{category.name}</span>
                                                                {category.description && (
                                                                    <div className="text-xs text-gray-500 mt-1">
                                                                        {category.description}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <Badge
                                                            className={`text-xs ${category.status === "approved"
                                                                ? "bg-green-100 text-green-800"
                                                                : "bg-yellow-100 text-yellow-800"
                                                                }`}
                                                        >
                                                            {category.status}
                                                        </Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                    {/* No results message - Only when searching */}
                                    {showCategorySuggestions &&
                                        categorySearchQuery &&
                                        filteredCategories.length === 0 && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-3">
                                                <span className="text-gray-500">No services found</span>
                                            </div>
                                        )}
                                </div>
                            </div>

                            {/* Address */}
                            <div className="space-y-2">
                                <Label htmlFor="address" className="flex items-center gap-2">
                                    <MapPin className="size-4" />
                                    <span>Address</span>
                                </Label>
                                <Textarea
                                    id="address"
                                    name="address"
                                    placeholder="Enter address"
                                    value={formData.address}
                                    onChange={handleInputChange}
                                    rows={2}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <FileText className="size-5 text-primary" />
                                <CardTitle>Lead Details</CardTitle>
                            </div>
                            <CardDescription>Source and description of the lead</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Lead Source */}
                            <div className="space-y-2">
                                <Label htmlFor="leadSource">
                                    Lead Source <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    value={formData.leadSource}
                                    onValueChange={(value) => setFormData({ ...formData, leadSource: value })}
                                    required
                                >
                                    <SelectTrigger id="leadSource" className="w-full">
                                        <SelectValue placeholder="Select lead source" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {leadSources.length === 0 && (
                                            <SelectItem value="no-data" disabled>
                                                No lead sources available
                                            </SelectItem>
                                        )}

                                        {leadSources.map((source) => (
                                            <SelectItem key={source.id} value={source.name}>
                                                {source.name}
                                            </SelectItem>
                                        ))}

                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    name="description"
                                    placeholder="Enter prospect description or notes"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    rows={4}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {
                        agent && !(agent.agentRole === "Advisor Agent" && agent.agentType === "Lead Maker") &&
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <Bell className="size-5 text-primary" />
                                    <CardTitle>Follow-up & Assignment</CardTitle>
                                </div>
                                <CardDescription>Set reminders and assign to team members</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Reminder */}
                                <div className="space-y-2">
                                    <Label htmlFor="reminder">Set Reminder</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                id="reminder"
                                                variant="outline"
                                                className={cn(
                                                    "w-full justify-start text-left font-normal",
                                                    !reminderDate && "text-muted-foreground",
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 size-4" />
                                                {reminderDate ? reminderDate.toLocaleDateString() : <span>Pick a reminder date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" selected={reminderDate} onSelect={setReminderDate} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Assign */}
                                <div className="space-y-2">
                                    <Label htmlFor="assign">
                                        Assign To
                                        {(agent?.agentType === "Client Advisor" || agent?.agentType === "Client Manager") && (
                                            <span className="text-destructive">*</span>
                                        )}
                                    </Label>
                                    <Popover open={open} onOpenChange={setOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                id="assign"
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={open}
                                                className={cn(
                                                    "w-full justify-between font-normal bg-transparent",
                                                    assignTouched &&
                                                    (agent?.agentType === "Client Advisor" || agent?.agentType === "Client Manager") &&
                                                    !assignedTo &&
                                                    "border-red-500",
                                                )}
                                            >
                                                {assignedTo
                                                    ? teamMembersWithSelf.find((member) => member.id === assignedTo)?.name
                                                    : "Select team member..."}
                                                <Check className={cn("ml-2 size-4 shrink-0 opacity-0", assignedTo && "opacity-100")} />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-full p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Search team members..." />
                                                <CommandList>
                                                    <CommandEmpty>No team member found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {teamMembersWithSelf.map((member) => (
                                                            <CommandItem
                                                                key={member.id}
                                                                value={member.name}
                                                                onSelect={() => {
                                                                    setAssignedTo(member.id === assignedTo ? "" : member.id)
                                                                    setOpen(false)
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn("mr-2 size-4", assignedTo === member.id ? "opacity-100" : "opacity-0")}
                                                                />
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium">{member.name}</span>
                                                                    <span className="text-xs text-muted-foreground">{member.email}</span>
                                                                </div>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </CardContent>
                        </Card>
                    }

                    <div className="flex items-center justify-end gap-4">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={loading}
                            className="bg-[#f42b03] hover:bg-[#f42b03] shadow-none hover:shadow-lg transition-shadow duration-300 text-white hover:text-white cursor-pointer"
                            onClick={() => router.push("/sales/prospects")}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading} className=" text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300" >
                            {loading ? "Creating..." : "Create Prospect"}
                        </Button>
                    </div>
                </form>
            </div >

        </div >
    )
}
