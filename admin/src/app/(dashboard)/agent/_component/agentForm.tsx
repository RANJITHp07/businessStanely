"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, X, User, FileText, Users } from "lucide-react";
import { toast } from "react-toastify";
import { Agent } from "@/types";
import { useRouter } from "next/navigation";

const agentTypes = [
  "Owner",
  "Partner",
  "CEO",
  "Senior Manager",
  "Manager",
  "Senior Executive",
  "Executive",
  "Junior Executive",
  "Trainee",
  "Intern",
];

// Define agent hierarchy - each agent can manage agents below them in the hierarchy
const agentHierarchy: { [key: string]: string[] } = {
  Owner: [
    "Partner",
    "CEO",
    "Senior Manager",
    "Manager",
    "Senior Executive",
    "Executive",
    "Junior Executive",
    "Trainee",
    "Intern",
  ],
  Partner: [
    "CEO",
    "Senior Manager",
    "Manager",
    "Senior Executive",
    "Executive",
    "Junior Executive",
    "Trainee",
    "Intern",
  ],
  CEO: [
    "Senior Manager",
    "Manager",
    "Senior Executive",
    "Executive",
    "Junior Executive",
    "Trainee",
    "Intern",
  ],
  "Senior Manager": [
    "Manager",
    "Senior Executive",
    "Executive",
    "Junior Executive",
    "Trainee",
    "Intern",
  ],
  Manager: [
    "Senior Executive",
    "Executive",
    "Junior Executive",
    "Trainee",
    "Intern",
  ],
  "Senior Executive": ["Executive", "Junior Executive", "Trainee", "Intern"],
  Executive: ["Junior Executive", "Trainee", "Intern"],
  "Junior Executive": ["Trainee", "Intern"],
  Trainee: ["Intern"],
  Intern: [],
};

const specializations = [
  "All",
  "Secretarial & Company Laws",
  "Foreign Exchange Management Laws",
  "Labour Laws",
  "Local Laws",
  "Special Laws",
  "Accounting and Bookkeeping",
  "GST",
  "Individual Tax",
  "Corporate Tax",
  "Other Laws",
];

const allSpecializations = specializations.slice(1);

const jurisdictions = ["All", "India", "UAE", "USA", "Others"];

const allJurisdictions = jurisdictions.slice(1).join(", ");

interface AgentFormProps {
  agent?: Agent;
}

export default function AgentForm({ agent }: AgentFormProps) {
  const [selectedSpecializations, setSelectedSpecializations] = useState<
    string[]
  >(agent?.specializations || []);
  const [selectedSubordinates, setSelectedSubordinates] = useState<string[]>(
    []
  );
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    agent?.photo || null
  );
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: agent?.name || "",
    email: agent?.email || "",
    phoneNumber: agent?.phoneNumber || "",
    secondaryPhoneNumber: agent?.secondaryPhoneNumber || "",
    agentType: agent?.agentType || "",
    barAssociationId: agent?.barAssociationId || "",
    jurisdiction: agent?.jurisdiction || "",
  });
  const [agentSearch, setAgentSearch] = useState("");
  const router = useRouter();

  // Fetch all agents from API
  const fetchAgents = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/agents");
      if (response.ok) {
        const agents = await response.json();
        setAllAgents(agents);
      }
    } catch (error) {
      console.error("Error fetching agents:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch agents on component mount
  useEffect(() => {
    fetchAgents();
  }, []);

  // Initialize subordinates when editing an existing agent
  useEffect(() => {
    if (agent?.subordinates) {
      setSelectedSubordinates(agent.subordinates.map((sub) => sub.id));
    }
  }, [agent]);

  // Get available agents based on selected agent type hierarchy
  const getAvailableAgents = () => {
    if (!formData.agentType) return [];

    const allowedTypes = agentHierarchy[formData.agentType] || [];
    return allAgents.filter((existingAgent) => {
      // Exclude current agent being edited
      if (agent && existingAgent.id === agent.id) return false;

      // Only show agents that are lower in hierarchy
      return allowedTypes.includes(existingAgent.agentType);
    });
  };

  // Filter agents based on search term
  const filteredAgents = getAvailableAgents().filter(
    (existingAgent) =>
      existingAgent.name.toLowerCase().includes(agentSearch.toLowerCase()) ||
      existingAgent.agentType
        .toLowerCase()
        .includes(agentSearch.toLowerCase()) ||
      existingAgent.email.toLowerCase().includes(agentSearch.toLowerCase())
  );

  const handleSpecializationChange = (
    specialization: string,
    checked: boolean
  ) => {
    if (specialization === "All") {
      if (checked) {
        setSelectedSpecializations(allSpecializations);
      } else {
        setSelectedSpecializations([]);
      }
    } else {
      if (checked) {
        setSelectedSpecializations([
          ...selectedSpecializations,
          specialization,
        ]);
      } else {
        setSelectedSpecializations(
          selectedSpecializations.filter((s) => s !== specialization)
        );
      }
    }
  };

  const handleSubordinateChange = (agentId: string, checked: boolean) => {
    if (checked) {
      setSelectedSubordinates([...selectedSubordinates, agentId]);
    } else {
      setSelectedSubordinates(
        selectedSubordinates.filter((id) => id !== agentId)
      );
    }
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhotoPreview(null);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleJurisdictionChange = (value: string) => {
    if (value === "All") {
      setFormData((prev) => ({ ...prev, jurisdiction: allJurisdictions }));
    } else {
      setFormData((prev) => ({ ...prev, jurisdiction: value }));
    }
  };

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
        toast.success(`Agent ${agent ? "updated" : "created"} successfully!`);
        router.push("/agent");
      } else {
        const errorData = await response.json();
        toast.error(`${errorData.error}`);
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("An unexpected error occurred. Please try again.");
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          {agent ? "Edit Agent" : "Create New Agent"}
        </h1>
        <p className="text-muted-foreground mt-2">
          {agent
            ? "Update the agent's details and assignments."
            : "Add a new agent to your organization with their details and assignments."}
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
                  onChange={(e) =>
                    handleInputChange("phoneNumber", e.target.value)
                  }
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
                  onChange={(e) =>
                    handleInputChange("secondaryPhoneNumber", e.target.value)
                  }
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
            <CardDescription>
              Agent type, specializations, and credentials
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agent-type">Agent Type *</Label>
                <Select
                  value={formData.agentType}
                  onValueChange={(value) =>
                    handleInputChange("agentType", value)
                  }
                >
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
                  value={
                    formData.jurisdiction === allJurisdictions
                      ? "All"
                      : formData.jurisdiction
                  }
                  onValueChange={handleJurisdictionChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select jurisdiction" />
                  </SelectTrigger>
                  <SelectContent>
                    {jurisdictions.map((jurisdiction) => (
                      <SelectItem key={jurisdiction} value={jurisdiction}>
                        {jurisdiction === "All" ? (
                          <div className="font-medium">All Jurisdictions</div>
                        ) : (
                          jurisdiction
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.jurisdiction === allJurisdictions && (
                  <div className="text-sm text-blue-600 mt-1">
                    Selected: {allJurisdictions}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bar-id">Employee ID *</Label>
              <Input
                id="bar-id"
                placeholder="Enter bar association ID"
                value={formData.barAssociationId}
                onChange={(e) =>
                  handleInputChange("barAssociationId", e.target.value)
                }
                required
              />
            </div>

            <div className="space-y-3">
              <Label>Specializations *</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {specializations.map((specialization) => (
                  <div
                    key={specialization}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={specialization}
                      checked={
                        specialization === "All"
                          ? selectedSpecializations.length ===
                            allSpecializations.length
                          : selectedSpecializations.includes(specialization)
                      }
                      onCheckedChange={(checked) =>
                        handleSpecializationChange(
                          specialization,
                          checked as boolean
                        )
                      }
                    />
                    <Label
                      htmlFor={specialization}
                      className={`text-sm ${
                        specialization === "All" ? "font-medium" : "font-normal"
                      }`}
                    >
                      {specialization === "All"
                        ? "Select All Specializations"
                        : specialization}
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
            <CardDescription>
              Assign agents to work under this agent.
              {formData.agentType && (
                <div className="mt-2 text-sm text-blue-600">
                  As a <strong>{formData.agentType}</strong>, you can manage:{" "}
                  {agentHierarchy[formData.agentType]?.join(", ") ||
                    "No subordinates available"}
                </div>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!formData.agentType && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  Please select an Agent Type first to see available team
                  members.
                </p>
              </div>
            )}

            {formData.agentType &&
              agentHierarchy[formData.agentType]?.length === 0 && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-600">
                    As an <strong>{formData.agentType}</strong>, you cannot
                    manage any subordinates.
                  </p>
                </div>
              )}

            {formData.agentType &&
              agentHierarchy[formData.agentType]?.length > 0 && (
                <>
                  {/* Search Input */}
                  <div className="space-y-2">
                    <Label htmlFor="agent-search">Search Agents</Label>
                    <Input
                      id="agent-search"
                      placeholder="Search by name, type, or email..."
                      value={agentSearch}
                      onChange={(e) => setAgentSearch(e.target.value)}
                      className="max-w-md"
                    />
                  </div>

                  {/* Selected Agents Display */}
                  {selectedSubordinates.length > 0 && (
                    <div className="space-y-3">
                      <Label>
                        Selected Agents ({selectedSubordinates.length})
                      </Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedSubordinates.map((agentId) => {
                          const selectedAgent = allAgents.find(
                            (a) => a.id === agentId
                          );
                          return selectedAgent ? (
                            <div
                              key={selectedAgent.id}
                              className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
                            >
                              <div className="flex items-center space-x-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage
                                    src={selectedAgent.photo || ""}
                                  />
                                  <AvatarFallback className="bg-blue-100 text-blue-600">
                                    {selectedAgent.name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-blue-900">
                                    {selectedAgent.name}
                                  </p>
                                  <p className="text-sm text-blue-600">
                                    {selectedAgent.agentType}
                                  </p>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleSubordinateChange(
                                    selectedAgent.id,
                                    false
                                  )
                                }
                                className="text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}

                  {/* Available Agents */}
                  <div className="space-y-3">
                    <Label>Available Agents</Label>
                    {loading ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">
                          Loading agents...
                        </p>
                      </div>
                    ) : filteredAgents.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        {agentSearch
                          ? "No agents found matching your search."
                          : getAvailableAgents().length === 0
                          ? "No agents available for this hierarchy level."
                          : "No agents available."}
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {filteredAgents.map((availableAgent) => (
                          <div
                            key={availableAgent.id}
                            className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                              selectedSubordinates.includes(availableAgent.id)
                                ? "bg-gray-50 border-gray-300"
                                : "hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <Checkbox
                                id={availableAgent.id}
                                checked={selectedSubordinates.includes(
                                  availableAgent.id
                                )}
                                onCheckedChange={(checked) =>
                                  handleSubordinateChange(
                                    availableAgent.id,
                                    checked as boolean
                                  )
                                }
                              />
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={availableAgent.photo || ""} />
                                <AvatarFallback>
                                  {availableAgent.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <Label
                                  htmlFor={availableAgent.id}
                                  className="font-medium cursor-pointer"
                                >
                                  {availableAgent.name}
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                  {availableAgent.agentType} •{" "}
                                  {availableAgent.email}
                                </p>
                              </div>
                            </div>
                            {selectedSubordinates.includes(
                              availableAgent.id
                            ) && (
                              <Badge
                                variant="secondary"
                                className="bg-blue-100 text-blue-800"
                              >
                                Selected
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            onClick={() => router.push("/agent")}
            className="bg-[#f42b03] hover:bg-[#f42b03] shadow-none hover:shadow-lg transition-shadow duration-300 text-white hover:text-white cursor-pointer"
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            className=" cursor-pointer shadow-none hover:shadow-lg transition-shadow duration-300"
            type="submit"
          >
            {agent ? "Update Agent" : "Create Agent"}
          </Button>
        </div>
      </form>
    </div>
  );
}
