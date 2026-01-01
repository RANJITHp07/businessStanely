"use client";
import type React from "react";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CalendarIcon, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Agent, Prospect } from "@/types";


const leadSources = [
  "Website",
  "Referral",
  "Social Media",
  "Cold Call",
  "Email Campaign",
  "Trade Show",
  "Partner",
  "Other",
];

export default function EditProspectPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [formData, setFormData] = useState<Partial<Prospect>>({});
  const [teamMembers, setTeamMembers] = useState<Agent[]>([]);
  const [open, setOpen] = useState(false);
  const [reminderDate, setReminderDate] = useState<Date>();
  const [assignedTo, setAssignedTo] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/prospects/${id}`).then((res) => res.json()),
      fetch("/api/agents").then((res) => res.json()),
    ])
      .then(([prospectData, agentsData]) => {
        const prospect = prospectData.prospect || {};
        setFormData({
          name: prospect.name ?? "",
          phoneNumber: prospect.phoneNumber ?? "",
          address: prospect.address ?? "",
          email: prospect.email ?? "",
          leadSource: prospect.leadSource ?? "",
          description: prospect.description ?? "",
          notes: prospect.notes ?? "",
          status: prospect.status ?? "",
        });
        setReminderDate(prospect.nextFollowUp ? new Date(prospect.nextFollowUp) : undefined);
        setAssignedTo(prospect.assignedTo ?? "");
        setTeamMembers(agentsData.agents || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      assignedTo,
      nextFollowUp: reminderDate ? reminderDate.toISOString() : undefined,
    };
    try {
      const res = await fetch(`/api/prospects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update prospect");
      router.push(`/sales/prospects/${id}`);
    } catch (err) {
      alert("Failed to update prospect");
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen  p-4 md:p-8 bg-[#e3f2fd]">
      <div className="mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Edit Prospect</h1>
          <p className="text-muted-foreground mt-2">Update prospect details</p>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Prospect Information</CardTitle>
            <CardDescription>Update the details below to edit this prospect</CardDescription>
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

              {/* Email */}
              <div className="space-y-2">
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
                      <Check className={cn("ml-2 size-4 shrink-0 opacity-0", assignedTo && "opacity-100")}/>
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

              {/* Submit Buttons */}
              <div className="flex items-center gap-4 pt-4">
                <Button type="submit" className="flex-1">
                  Update Prospect
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 bg-transparent"
                  onClick={() => router.push(`/sales/prospects/${id}`)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
