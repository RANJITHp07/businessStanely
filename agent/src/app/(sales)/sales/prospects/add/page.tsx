"use client"

import React, { useState, useEffect } from "react"
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
import { CalendarIcon, Check} from "lucide-react"
import { cn } from "@/lib/utils"

// Lead source options
const leadSources = [
    "Website",
    "Referral",
    "Social Media",
    "Cold Call",
    "Email Campaign",
    "Trade Show",
    "Partner",
    "Other",
]

export default function NewProspectPage() {
    const agent = useAgentContext();
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [assignedTo, setAssignedTo] = useState("")
    const [assignTouched, setAssignTouched] = useState(false)
    const [reminderDate, setReminderDate] = useState<Date>()
    const [formData, setFormData] = useState({
        name: "",
        phoneNumber: "",
        address: "",
        email: "",
        leadSource: "",
        description: "",
        amount: "",
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAssignTouched(true);
        // For Client Advisor/Manager, assignedTo is required
        if ((agent?.agentType === "Client Advisor" || agent?.agentType === "Client Manager") && !assignedTo) {
            alert("Please assign this prospect to yourself or another agent.");
            return;
        }
        const payload = {
            ...formData,
            amount: formData.amount ? parseFloat(formData.amount) : undefined,
            assignedAgentId: assignedTo || undefined,
            nextFollowUp: reminderDate ? reminderDate.toISOString() : undefined,
        };
        try {
            const res = await fetch('/api/prospects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error('Failed to create prospect');
            router.push('/sales/prospects/table');
        } catch (err) {
            alert('Failed to create prospect');
        }
    }
            type TeamMember = {
                id: string;
                name: string;
                email: string;
            };
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
                        setTeamMembers(await allRes.json())
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
    let teamMembersWithSelf = teamMembers;
    if (agent && (agent.agentType === "Client Advisor" || agent.agentType === "Client Manager")) {
        // Remove any existing entry for self
        const filtered = teamMembers.filter(m => m.id !== agent.id);
        teamMembersWithSelf = [
            { id: agent.id, name: agent.name + " (You)", email: agent.email },
            ...filtered
        ];
    }

    return (
        <div className="min-h-screen  p-4 md:p-8 bg-[#e3f2fd]">
            <div className="mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-foreground">Create New Prospect</h1>
                    <p className="text-muted-foreground mt-2">Add a new prospect to your pipeline</p>
                </div>

                {/* Form */}
                <Card>
                    <CardHeader>
                        <CardTitle>Prospect Information</CardTitle>
                        <CardDescription>Fill in the details below to create a new prospect</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="flex gap-2">
                                {/* Name */}
                                <div className="space-y-2 w-1/2">
                                    <Label htmlFor="name">
                                        Name <span className="text-destructive">*</span>
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

                                {/* Phone Number */}
                                <div className="space-y-2 w-1/2">
                                    <Label htmlFor="phoneNumber">
                                        Phone Number <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="phoneNumber"
                                        name="phoneNumber"
                                        type="tel"
                                        placeholder="Enter phone number"
                                        value={formData.phoneNumber}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                            </div>


                            {/* Email & Amount Row */}
                            <div className="flex gap-2">
                                {/* Email */}
                                <div className="space-y-2 w-1/2">
                                    <Label htmlFor="email">
                                        Email <span className="text-destructive">*</span>
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
                                {/* Amount */}
                                <div className="space-y-2 w-1/2">
                                    <Label htmlFor="amount">Amount</Label>
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

                            {/* Address */}
                            <div className="space-y-2">
                                <Label htmlFor="address">Address</Label>
                                <Textarea
                                    id="address"
                                    name="address"
                                    placeholder="Enter address"
                                    value={formData.address}
                                    onChange={handleInputChange}
                                />
                            </div>


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
                                        {leadSources.map((source) => (
                                            <SelectItem key={source} value={source}>
                                                {source}
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
                                            className={cn("w-full justify-between font-normal bg-transparent", (assignTouched && (agent?.agentType === "Client Advisor" || agent?.agentType === "Client Manager") && !assignedTo) && "border-red-500")}
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

                            {/* Submit Buttons */}
                            <div className="flex items-center gap-4 pt-4">
                                <Button type="submit" className="flex-1">
                                    Create Prospect
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1 bg-transparent"
                                    onClick={() => router.push("/sales/prospects")}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
