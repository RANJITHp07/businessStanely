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
import { useRouter, useSearchParams } from "next/navigation";
import {
  ADVISOR_AGENT_ROLE,
  EXECUTION_AGENT_ROLE,
  EXECUTION_AND_ADVISOR_AGENT_ROLE,
  hasAdvisorRole,
  hasExecutionRole,
} from "@/lib/agentRole";

const executionAgentTypes = [
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
const advisorAgentTypes = [
  "Lead Maker",
  "Client Advisor",
  "Client Manager",
];

const isExecutionType = (type?: string | null) =>
  !!type && executionAgentTypes.includes(type);

const isAdvisorType = (type?: string | null) =>
  !!type && advisorAgentTypes.includes(type);

const agentRoles = [
  EXECUTION_AGENT_ROLE,
  ADVISOR_AGENT_ROLE,
  EXECUTION_AND_ADVISOR_AGENT_ROLE,
];

// Define agent hierarchy - each agent can manage agents below them in the hierarchy
const agentHierarchy: { [key: string]: string[] } = {
  Owner: [
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
  ],
  Partner: [
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
  CEO: [
    "CEO",
    "Senior Manager",
    "Manager",
    "Senior Executive",
    "Executive",
    "Junior Executive",
    "Trainee",
    "Intern",
  ],
  "Senior Manager": [
    "Senior Manager",
    "Manager",
    "Senior Executive",
    "Executive",
    "Junior Executive",
    "Trainee",
    "Intern",
  ],
  Manager: [
    "Manager",
    "Senior Executive",
    "Executive",
    "Junior Executive",
    "Trainee",
    "Intern",
  ],
  "Senior Executive": [
    "Senior Executive",
    "Executive",
    "Junior Executive",
    "Trainee",
    "Intern"
  ],
  Executive: [
    "Executive",
    "Junior Executive",
    "Trainee",
    "Intern"
  ],
  "Junior Executive": [
    "Junior Executive",
    "Trainee",
    "Intern"
  ],
  Trainee: [
    "Trainee",
    "Intern"
  ],
  Intern: [
    "Intern"
  ],
  // Advisor Agent hierarchy
  "Client Manager": ["Client Advisor"],
  "Client Advisor": [],
  "Lead Maker": [],
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
  "Litigation",
  "Drafting, Vetting and Reviewing",
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
    agent?.subordinates ? agent.subordinates.map((sub) => sub.id) : []
  );
  const [selectedAdvisorSubordinates, setSelectedAdvisorSubordinates] = useState<string[]>(
    agent?.advisorSubordinates ? agent.advisorSubordinates.map((sub) => sub.id) : []
  );
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    agent?.photo || null
  );
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [allSubordinateIds, setAllSubordinateIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  type AgentFormData = {
    name: string;
    email: string;
    phoneNumber: string;
    secondaryPhoneNumber: string;
    agentRole: string;
    agentType: string;
    executionAgentType: string;
    advisorAgentType: string;
    barAssociationId: string;
    jurisdiction: string;
    autoAssign?: boolean
  };
  const searchParams = useSearchParams();
  const agentRole = searchParams.get("agentRole");

  const initialExecutionType =
    agent?.executionAgentType ||
    (isExecutionType(agent?.agentType) ? agent?.agentType : "");
  const initialAdvisorType =
    agent?.advisorAgentType ||
    (isAdvisorType(agent?.agentType) ? agent?.agentType : "");

  const [formData, setFormData] = useState<AgentFormData>({
    name: agent?.name || "",
    email: agent?.email || "",
    phoneNumber: agent?.phoneNumber || "",
    secondaryPhoneNumber: agent?.secondaryPhoneNumber || "",
    agentRole: agentRole || agent?.agentRole || EXECUTION_AGENT_ROLE,
    agentType: agent?.agentType || "",
    executionAgentType: initialExecutionType || "",
    advisorAgentType: initialAdvisorType || "",
    barAssociationId: agent?.barAssociationId || "",
    jurisdiction: agent?.jurisdiction || "",
    autoAssign: agent?.autoAssign || true
  });
  const [agentSearch, setAgentSearch] = useState("");
  const [advisorAgentSearch, setAdvisorAgentSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter();


  // Fetch all agents from API and collect all subordinate IDs
  const fetchAgents = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/agents");
      if (response.ok) {
        const agents = await response.json();
        setAllAgents(agents);
        // Collect all subordinate IDs except for the current agent's subordinates
        const subordinateIds: string[] = [];
        agents.forEach((a: Agent) => {
          if (!agent || a.id !== agent.id) {
            if (Array.isArray(a.subordinates)) {
              subordinateIds.push(...a.subordinates.map((s: Agent) => s.id));
            }
            if (Array.isArray(a.advisorSubordinates)) {
              subordinateIds.push(...a.advisorSubordinates.map((s: Agent) => s.id));
            }
          }
        });
        setAllSubordinateIds(subordinateIds);
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

  // Initialize subordinates when editing an existing agent (handle API response updates)
  useEffect(() => {
    if (agent?.subordinates) {
      setSelectedSubordinates(agent.subordinates.map((sub) => sub.id));
    } else {
      setSelectedSubordinates([]);
    }
  }, [agent?.subordinates]);

  useEffect(() => {
    if (agent?.advisorSubordinates) {
      setSelectedAdvisorSubordinates(
        agent.advisorSubordinates.map((sub) => sub.id)
      );
    } else {
      setSelectedAdvisorSubordinates([]);
    }
  }, [agent?.advisorSubordinates]);

  const selectedExecutionType =
    formData.agentRole === EXECUTION_AND_ADVISOR_AGENT_ROLE
      ? formData.executionAgentType
      : hasAdvisorRole(formData.agentRole)
        ? ""
        : formData.agentType;

  const selectedAdvisorType =
    formData.agentRole === EXECUTION_AND_ADVISOR_AGENT_ROLE
      ? formData.advisorAgentType
      : hasAdvisorRole(formData.agentRole)
        ? formData.agentType
        : "";

  const managementAgentType = selectedAdvisorType || selectedExecutionType || "";

  const handleAgentRoleChange = (role: string) => {
    setFormData((prev) => {
      if (role === EXECUTION_AND_ADVISOR_AGENT_ROLE) {
        return {
          ...prev,
          agentRole: role,
          agentType: prev.executionAgentType || prev.agentType,
          executionAgentType: prev.executionAgentType || (isExecutionType(prev.agentType) ? prev.agentType : ""),
          advisorAgentType: prev.advisorAgentType || (isAdvisorType(prev.agentType) ? prev.agentType : ""),
        };
      }

      if (role === ADVISOR_AGENT_ROLE) {
        const nextAdvisorType = prev.advisorAgentType || (isAdvisorType(prev.agentType) ? prev.agentType : "");
        return {
          ...prev,
          agentRole: role,
          agentType: nextAdvisorType,
        };
      }

      const nextExecutionType = prev.executionAgentType || (isExecutionType(prev.agentType) ? prev.agentType : "");
      return {
        ...prev,
        agentRole: role,
        agentType: nextExecutionType,
      };
    });
  };


  // Get available agents based on selected agent type hierarchy
  const getAvailableAgents = () => {
    if (!selectedExecutionType) return [];

    const allowedTypes = agentHierarchy[selectedExecutionType] || [];
    return allAgents.filter((existingAgent) => {

      // Exclude current agent being edited
      if (agent && existingAgent.id === agent.id) return false;


      // Only show agents that are lower in hierarchy
      if (!allowedTypes.includes(existingAgent.agentType)) return false;

      // Prevent agents from being added to multiple teams (unless already subordinate to this agent)
      if (

        agent?.subordinates?.some((s) => s.id === existingAgent.id)
      ) {
        return false;
      }

      return true;
    });
  };

  console.log(getAvailableAgents())
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

  const handleAdvisorSubordinateChange = (agentId: string, checked: boolean) => {
    if (checked) {
      setSelectedAdvisorSubordinates([...selectedAdvisorSubordinates, agentId]);
    } else {
      setSelectedAdvisorSubordinates(
        selectedAdvisorSubordinates.filter((id) => id !== agentId)
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

    if (formData.agentRole === EXECUTION_AND_ADVISOR_AGENT_ROLE) {
      if (!formData.executionAgentType || !formData.advisorAgentType) {
        toast.error("Please select both Execution Agent Type and Advisor Agent Type.");
        return;
      }
    }

    try {
      setIsSubmitting(true)
      const payloadAgentType =
        formData.agentRole === EXECUTION_AND_ADVISOR_AGENT_ROLE
          ? formData.executionAgentType
          : formData.agentType;

      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          agentType: payloadAgentType,
          specializations: selectedSpecializations,
          subordinates: selectedSubordinates,
          advisorSubordinates: selectedAdvisorSubordinates,
          photo: photoPreview,
        }),
      });

      if (response.ok) {
        toast.success(`Agent ${agent ? "updated" : "created"} successfully!`);
        router.back();
      } else {
        const errorData = await response.json();
        toast.error(`${errorData.error}`);
      }
    } catch (error) {
      alert("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false)
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
                <Label htmlFor="agent-role">Agent Role *</Label>
                <Select
                  value={formData.agentRole || EXECUTION_AGENT_ROLE}
                  onValueChange={handleAgentRoleChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select agent role" />
                  </SelectTrigger>
                  <SelectContent>
                    {agentRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                {formData.agentRole === EXECUTION_AND_ADVISOR_AGENT_ROLE ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="execution-agent-type">Execution Agent Type *</Label>
                      <Select
                        value={formData.executionAgentType}
                        onValueChange={(value) => {
                          setFormData((prev) => ({
                            ...prev,
                            executionAgentType: value,
                            agentType: value,
                          }));
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select execution agent type" />
                        </SelectTrigger>
                        <SelectContent>
                          {executionAgentTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="advisor-agent-type">Advisor Agent Type *</Label>
                      <Select
                        value={formData.advisorAgentType}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            advisorAgentType: value,
                          }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select advisor agent type" />
                        </SelectTrigger>
                        <SelectContent>
                          {advisorAgentTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <>
                    <Label htmlFor="agent-type">Agent Type *</Label>
                    <Select
                      value={formData.agentType}
                      onValueChange={(value) => handleInputChange("agentType", value)}
                      disabled={!formData.agentRole}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select agent type" />
                      </SelectTrigger>
                      <SelectContent>
                        {(hasAdvisorRole(formData.agentRole)
                          ? advisorAgentTypes
                          : executionAgentTypes).map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </>
                )}

                {hasAdvisorRole(formData.agentRole) && selectedAdvisorType && selectedAdvisorType !== "Lead Maker" && (
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="auto-assign"
                      className="h-4 w-4"
                      checked={formData.autoAssign}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          autoAssign: e.target.checked,
                        }))
                      }
                    />
                    <Label htmlFor="auto-assign" className="ml-2 text-xs font-medium">
                      If this checkbox is selected, the prospect will be automatically assigned to this agent.
                    </Label>
                  </div>
                )}
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
                placeholder="Enter Employee ID"
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
                      className={`text-sm ${specialization === "All" ? "font-medium" : "font-normal"
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
              {formData.agentRole !== EXECUTION_AND_ADVISOR_AGENT_ROLE &&
                managementAgentType && (
                  <div className="mt-2 text-sm text-blue-600">
                    As a <strong>{managementAgentType}</strong>, you can manage:{" "}
                    {agentHierarchy[managementAgentType]?.join(", ") ||
                      "No subordinates available"}
                  </div>
                )}
              {formData.agentRole === EXECUTION_AND_ADVISOR_AGENT_ROLE && (
                <div className="mt-2 text-sm text-blue-600">
                  Configure both Execution Team and Advisor Team assignments.
                </div>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {hasExecutionRole(formData.agentRole) && (
              <div className="space-y-4 border rounded-lg p-4">
                <Label className="text-base font-semibold">Execution Team</Label>
                {!selectedExecutionType && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      Please select an Execution Agent Type first.
                    </p>
                  </div>
                )}
                {selectedExecutionType &&
                  agentHierarchy[selectedExecutionType]?.length === 0 && (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-sm text-gray-600">
                        As an <strong>{selectedExecutionType}</strong>, you cannot
                        manage any execution subordinates.
                      </p>
                    </div>
                  )}
                {selectedExecutionType &&
                  agentHierarchy[selectedExecutionType]?.length > 0 && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="execution-agent-search">
                          Search Execution Agents
                        </Label>
                        <Input
                          id="execution-agent-search"
                          placeholder="Search by name, type, or email..."
                          value={agentSearch}
                          onChange={(e) => setAgentSearch(e.target.value)}
                          className="max-w-md"
                        />
                      </div>

                      {selectedSubordinates.length > 0 && (
                        <div className="space-y-3">
                          <Label>
                            Selected Execution Agents ({selectedSubordinates.length})
                          </Label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {selectedSubordinates.map((agentId) => {
                              const selectedAgent = allAgents.find(
                                (a) => a.id === agentId,
                              );
                              return selectedAgent ? (
                                <div
                                  key={selectedAgent.id}
                                  className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
                                >
                                  <div className="flex items-center space-x-3">
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src={selectedAgent.photo || ""} />
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
                                      handleSubordinateChange(selectedAgent.id, false)
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

                      <div className="space-y-3">
                        <Label>Available Execution Agents</Label>
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
                                className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${selectedSubordinates.includes(availableAgent.id)
                                  ? "bg-gray-50 border-gray-300"
                                  : "hover:bg-gray-50"
                                  }`}
                              >
                                <div className="flex items-center space-x-3">
                                  <Checkbox
                                    id={availableAgent.id}
                                    checked={selectedSubordinates.includes(
                                      availableAgent.id,
                                    )}
                                    onCheckedChange={(checked) =>
                                      handleSubordinateChange(
                                        availableAgent.id,
                                        checked as boolean,
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
                                      {availableAgent.agentType} • {availableAgent.email}
                                    </p>
                                  </div>
                                </div>
                                {selectedSubordinates.includes(availableAgent.id) && (
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
              </div>
            )}

            {hasAdvisorRole(formData.agentRole) && (
              <div className="space-y-4 border rounded-lg p-4">
                <Label className="text-base font-semibold">Advisor Team</Label>
                {!selectedAdvisorType && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      Please select an Advisor Agent Type first.
                    </p>
                  </div>
                )}
                {selectedAdvisorType && selectedAdvisorType !== "Client Manager" && (
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-600">
                      As an <strong>{selectedAdvisorType}</strong>, you cannot
                      manage advisor subordinates.
                    </p>
                  </div>
                )}

                {selectedAdvisorType === "Client Manager" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="advisor-agent-search">
                        Search Client Advisors
                      </Label>
                      <Input
                        id="advisor-agent-search"
                        placeholder="Search by name or email..."
                        value={advisorAgentSearch}
                        onChange={(e) => setAdvisorAgentSearch(e.target.value)}
                        className="max-w-md"
                      />
                    </div>

                    {selectedAdvisorSubordinates.length > 0 && (
                      <div className="space-y-3">
                        <Label>
                          Selected Client Advisors ({selectedAdvisorSubordinates.length})
                        </Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {selectedAdvisorSubordinates.map((agentId) => {
                            const selectedAgent = allAgents.find(
                              (a) =>
                                a.id === agentId && a.agentType === "Client Advisor",
                            );
                            return selectedAgent ? (
                              <div
                                key={selectedAgent.id}
                                className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
                              >
                                <div className="flex items-center space-x-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={selectedAgent.photo || ""} />
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
                                    handleAdvisorSubordinateChange(
                                      selectedAgent.id,
                                      false,
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

                    <div className="space-y-3">
                      <Label>Available Client Advisors</Label>
                      {loading ? (
                        <div className="text-center py-4">
                          <p className="text-sm text-muted-foreground">
                            Loading agents...
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {allAgents
                            .filter(
                              (a) =>
                                a.agentType === "Client Advisor" &&
                                !selectedSubordinates.includes(a.id) &&
                                (a.name
                                  .toLowerCase()
                                  .includes(advisorAgentSearch.toLowerCase()) ||
                                  a.email
                                    .toLowerCase()
                                    .includes(advisorAgentSearch.toLowerCase())),
                            )
                            .map((availableAgent) => (
                              <div
                                key={availableAgent.id}
                                className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${selectedAdvisorSubordinates.includes(
                                  availableAgent.id,
                                )
                                  ? "bg-gray-50 border-gray-300"
                                  : "hover:bg-gray-50"
                                  }`}
                              >
                                <div className="flex items-center space-x-3">
                                  <Checkbox
                                    id={`advisor-${availableAgent.id}`}
                                    checked={selectedAdvisorSubordinates.includes(
                                      availableAgent.id,
                                    )}
                                    onCheckedChange={(checked) =>
                                      handleAdvisorSubordinateChange(
                                        availableAgent.id,
                                        checked as boolean,
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
                                      htmlFor={`advisor-${availableAgent.id}`}
                                      className="font-medium cursor-pointer"
                                    >
                                      {availableAgent.name}
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                      {availableAgent.agentType} • {availableAgent.email}
                                    </p>
                                  </div>
                                </div>
                                {selectedAdvisorSubordinates.includes(
                                  availableAgent.id,
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
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            onClick={() => router.back()}
            className="bg-[#f42b03] hover:bg-[#f42b03] shadow-none hover:shadow-lg transition-shadow duration-300 text-white hover:text-white cursor-pointer"
            type="button"
            variant="outline"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            className=" cursor-pointer shadow-none hover:shadow-lg transition-shadow duration-300"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Proccessing..." : (agent ? "Update Agent" : "Create Agent")}
          </Button>
        </div>
      </form>
    </div >
  );
}
