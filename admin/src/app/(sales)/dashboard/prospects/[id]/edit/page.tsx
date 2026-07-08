"use client"
import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CalendarIcon, Check, Mail, Phone, MapPin, FileText, UserPlus, Bell, Banknote } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Agent, Prospect } from "@/types"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "react-toastify"
import { hasAdvisorRole } from "@/lib/agentRole"


export default function EditProspectPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params?.id as string
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<Partial<Prospect>>({})
  const [teamMembers, setTeamMembers] = useState<Agent[]>([])
  const [open, setOpen] = useState(false)
  const [reminderDate, setReminderDate] = useState<Date>()
  const [assignedTo, setAssignedTo] = useState("")
  const [leadSources, setLeadSources] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      setLoading(true);

      try {
        // 1️⃣ Fetch lead sources first
        const leadRes = await fetch("/api/lead_source");
        if (!leadRes.ok) throw new Error("Failed to fetch lead sources");
        const leadData = await leadRes.json();
        setLeadSources(leadData);

        // 2️⃣ Fetch prospect, current agent, and all agents concurrently
        const [prospectRes, allAgentsRes] = await Promise.all([
          fetch(`/api/prospects/${id}`),
          fetch("/api/agents"),
        ]);

        const prospectData = await prospectRes.json();
        const allAgentsData = await allAgentsRes.json();

        // 3️⃣ Set prospect form data AFTER lead sources are available
        const prospect = prospectData.prospect || {};
        setFormData({
          name: prospect.name ?? "",
          phoneNumber: prospect.phoneNumber ?? "",
          address: prospect.address ?? "",
          email: prospect.email ?? "",
          leadSource: leadData.find((lead: any) => lead.id === prospect.leadSourceId)?.name || "",
          description: prospect.description ?? "",
          notes: prospect.notes ?? "",
          status: prospect.status ?? "",
          amount: prospect.amount?.toString() ?? "",
          service: prospect.service
        });

        setReminderDate(prospect.nextFollowUp ? new Date(prospect.nextFollowUp) : undefined);
        setAssignedTo(prospect.assignedAgentId ?? "");

        // 4️⃣ Determine team members
        let teamMembersList: any[] = [];

        teamMembersList = allAgentsData.filter((a: any) => hasAdvisorRole(a.agentRole));

        setTeamMembers(teamMembersList);
      } catch (err) {
        setLeadSources([]);
        setTeamMembers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const searchQuery = searchParams.get("opportunities") || "";
    const payload = {
      ...formData,
      assignedAgentId: assignedTo || undefined,
      nextFollowUp: reminderDate ? reminderDate.toISOString() : undefined,
      leadSourceId: leadSources.find((source) => source.name == formData.leadSource)?.id,
      archived: !!searchQuery
    }
    try {
      setIsSubmitting(true)
      const res = await fetch(`/api/prospects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to update prospect")

      toast.success("Updated successfully")
      router.back()
    } catch (err) {
      toast.error("Failed to update prospect")
    } finally {
      setIsSubmitting(false)
    }
  }

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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-[#e3f2fd]">
      <div className="mx-auto ">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Edit Lead</h1>
          <p className="text-muted-foreground mt-2">Update lead details</p>
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

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="flex items-center gap-2">
                    <Phone className="size-4" />
                    <span>Phone Number</span>
                    <span className="text-destructive">*</span>
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

              {/* Email */}
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
                    id="service"
                    name="service"
                    type="text"
                    placeholder="Service"
                    value={formData.service}
                    onChange={handleInputChange}
                    className="w-full"
                  />


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
                <Label htmlFor="assign">Assign To</Label>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="assign"
                      variant="outline"
                      role="combobox"
                      aria-expanded={open}
                      className="w-full justify-between font-normal bg-transparent"
                    >
                      {assignedTo
                        ? teamMembers.find((member) => member.id === assignedTo)?.name
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
                          {teamMembers.map((member) => (
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


          {/* Submit Buttons */}
          <div className="flex justify-end items-center gap-4">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              className="bg-[#f42b03] hover:bg-[#f42b03] shadow-none hover:shadow-lg transition-shadow duration-300 text-white hover:text-white cursor-pointer"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className=" text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300" >
              {isSubmitting ? "Updating..." : " Update Lead"}
            </Button>
          </div>
        </form>
      </div >
    </div >
  )
}
