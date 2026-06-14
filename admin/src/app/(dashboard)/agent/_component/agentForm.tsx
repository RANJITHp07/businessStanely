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
import { Upload, X, User, FileText, Users, Search, UserPlus, UserCheck } from "lucide-react";
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
  const [allExecutionSubordinateIds, setAllExecutionSubordinateIds] = useState<string[]>([]);
  const [allAdvisorSubordinateIds, setAllAdvisorSubordinateIds] = useState<string[]>([]);
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
        // Collect subordinate IDs by team type. A dual-role person may be on
        // both an execution team and an advisor team.
        const executionSubordinateIds: string[] = [];
        const advisorSubordinateIds: string[] = [];
        agents.forEach((a: Agent) => {
          if (!agent || a.id !== agent.id) {
            if (Array.isArray(a.subordinates)) {
              executionSubordinateIds.push(...a.subordinates.map((s: Agent) => s.id));
            }
            if (Array.isArray(a.advisorSubordinates)) {
              advisorSubordinateIds.push(...a.advisorSubordinates.map((s: Agent) => s.id));
            }
          }
        });
        setAllExecutionSubordinateIds(executionSubordinateIds);
        setAllAdvisorSubordinateIds(advisorSubordinateIds);
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
      if (agent && existingAgent.id === agent.id) return false;
      if (!allowedTypes.includes(existingAgent.agentType)) return false;
      if (
        allExecutionSubordinateIds.includes(existingAgent.id) &&
        !selectedSubordinates.includes(existingAgent.id)
      ) {
        return false;
      }
      if (
        selectedSubordinates.includes(existingAgent.id)
      ) {
        return false;
      }
      return true;
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

  const filteredAdvisorAgents = allAgents.filter((existingAgent) => {
    if (agent && existingAgent.id === agent.id) return false;
    const advisorType = existingAgent.advisorAgentType || existingAgent.agentType;
    if (advisorType !== "Client Advisor") return false;
    if (
      allAdvisorSubordinateIds.includes(existingAgent.id) &&
      !selectedAdvisorSubordinates.includes(existingAgent.id)
    ) {
      return false;
    }
    return (
      existingAgent.name.toLowerCase().includes(advisorAgentSearch.toLowerCase()) ||
      existingAgent.email.toLowerCase().includes(advisorAgentSearch.toLowerCase())
    );
  });

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
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* ── Execution Team ── */}
            {hasExecutionRole(formData.agentRole) && (
              <div className="rounded-xl border overflow-hidden">

                {/* Panel header */}
                <div className="flex items-center justify-between px-5 py-4 bg-blue-50 border-b">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <Users className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Execution Team</p>
                      {selectedExecutionType && agentHierarchy[selectedExecutionType]?.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Can manage: {agentHierarchy[selectedExecutionType]?.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                  {selectedSubordinates.length > 0 && (
                    <Badge className="bg-blue-600 text-white hover:bg-blue-600 shrink-0">
                      {selectedSubordinates.length} member{selectedSubordinates.length !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>

                {/* No type selected */}
                {!selectedExecutionType && (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">No agent type selected</p>
                    <p className="text-xs text-muted-foreground mt-1">Select an Execution Agent Type above to build your team</p>
                  </div>
                )}

                {/* Cannot manage */}
                {selectedExecutionType && agentHierarchy[selectedExecutionType]?.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                    <p className="text-sm text-muted-foreground">
                      As a <span className="font-medium text-foreground">{selectedExecutionType}</span>, you cannot manage execution subordinates.
                    </p>
                  </div>
                )}

                {/* Split panel */}
                {selectedExecutionType && agentHierarchy[selectedExecutionType]?.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x">

                    {/* Left – Available pool */}
                    <div className="p-5 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Available Agents</p>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          placeholder="Search by name, type, or email…"
                          value={agentSearch}
                          onChange={(e) => setAgentSearch(e.target.value)}
                          className="pl-8 h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1 max-h-72 overflow-y-auto pr-0.5">
                        {loading ? (
                          <p className="text-xs text-muted-foreground text-center py-8">Loading agents…</p>
                        ) : filteredAgents.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-8">
                            {agentSearch ? "No agents match your search." : "No agents available for this hierarchy level."}
                          </p>
                        ) : (
                          filteredAgents.map((a) => {
                            const isSelected = selectedSubordinates.includes(a.id)
                            return (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => handleSubordinateChange(a.id, !isSelected)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all group ${isSelected ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-muted"
                                  }`}
                              >
                                <Avatar className="h-8 w-8 shrink-0">
                                  <AvatarImage src={a.photo || ""} />
                                  <AvatarFallback className={`text-xs ${isSelected ? "bg-blue-100 text-blue-700" : ""}`}>
                                    {a.name.split(" ").map((n) => n[0]).join("")}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium truncate ${isSelected ? "text-blue-900" : ""}`}>{a.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{a.agentType}</p>
                                </div>
                                {isSelected
                                  ? <UserCheck className="h-4 w-4 text-blue-500 shrink-0" />
                                  : <UserPlus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                                }
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>

                    {/* Right – Current team */}
                    <div className="p-5 space-y-3 bg-slate-50/60">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team Members</p>
                      <div className="space-y-1 max-h-84 overflow-y-auto pr-0.5">
                        {selectedSubordinates.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-2">
                              <Users className="h-4 w-4 text-muted-foreground/50" />
                            </div>
                            <p className="text-xs text-muted-foreground">No members yet</p>
                            <p className="text-xs text-muted-foreground/60 mt-0.5">Click agents on the left to add them</p>
                          </div>
                        ) : (
                          allAgents
                            .filter((a) => selectedSubordinates.includes(a.id))
                            .map((a) => (
                              <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white border border-blue-100 shadow-sm">
                                <Avatar className="h-8 w-8 shrink-0">
                                  <AvatarImage src={a.photo || ""} />
                                  <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                                    {a.name.split(" ").map((n) => n[0]).join("")}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-blue-900 truncate">{a.name}</p>
                                  <p className="text-xs text-blue-500 truncate">{a.agentType}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleSubordinateChange(a.id, false)}
                                  className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors shrink-0"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))
                        )}
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* ── Advisor Team ── */}
            {hasAdvisorRole(formData.agentRole) && (
              <div className="rounded-xl border overflow-hidden">

                {/* Panel header */}
                <div className="flex items-center justify-between px-5 py-4 bg-violet-50 border-b">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                      <Users className="h-4 w-4 text-violet-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Advisor Team</p>
                      {selectedAdvisorType === "Client Manager" && (
                        <p className="text-xs text-muted-foreground mt-0.5">Managing: Client Advisors</p>
                      )}
                    </div>
                  </div>
                  {selectedAdvisorSubordinates.length > 0 && (
                    <Badge className="bg-violet-600 text-white hover:bg-violet-600 shrink-0">
                      {selectedAdvisorSubordinates.length} member{selectedAdvisorSubordinates.length !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>

                {!selectedAdvisorType && (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">No advisor type selected</p>
                    <p className="text-xs text-muted-foreground mt-1">Select an Advisor Agent Type above to build your team</p>
                  </div>
                )}

                {selectedAdvisorType && selectedAdvisorType !== "Client Manager" && (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                    <p className="text-sm text-muted-foreground">
                      As a <span className="font-medium text-foreground">{selectedAdvisorType}</span>, you cannot manage advisor subordinates.
                    </p>
                  </div>
                )}

                {selectedAdvisorType === "Client Manager" && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x">

                    {/* Left – Available pool */}
                    <div className="p-5 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Available Advisors</p>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          placeholder="Search by name or email…"
                          value={advisorAgentSearch}
                          onChange={(e) => setAdvisorAgentSearch(e.target.value)}
                          className="pl-8 h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1 max-h-72 overflow-y-auto pr-0.5">
                        {loading ? (
                          <p className="text-xs text-muted-foreground text-center py-8">Loading agents…</p>
                        ) : filteredAdvisorAgents.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-8">
                            {advisorAgentSearch ? "No advisors match your search." : "No Client Advisors available."}
                          </p>
                        ) : (
                          filteredAdvisorAgents.map((a) => {
                            const isSelected = selectedAdvisorSubordinates.includes(a.id)
                            return (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => handleAdvisorSubordinateChange(a.id, !isSelected)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all group ${isSelected ? "bg-violet-50 ring-1 ring-violet-200" : "hover:bg-muted"
                                  }`}
                              >
                                <Avatar className="h-8 w-8 shrink-0">
                                  <AvatarImage src={a.photo || ""} />
                                  <AvatarFallback className={`text-xs ${isSelected ? "bg-violet-100 text-violet-700" : ""}`}>
                                    {a.name.split(" ").map((n) => n[0]).join("")}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium truncate ${isSelected ? "text-violet-900" : ""}`}>{a.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{a.agentType}</p>
                                </div>
                                {isSelected
                                  ? <UserCheck className="h-4 w-4 text-violet-500 shrink-0" />
                                  : <UserPlus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                                }
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>

                    {/* Right – Current team */}
                    <div className="p-5 space-y-3 bg-slate-50/60">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team Members</p>
                      <div className="space-y-1 max-h-84 overflow-y-auto pr-0.5">
                        {selectedAdvisorSubordinates.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-2">
                              <Users className="h-4 w-4 text-muted-foreground/50" />
                            </div>
                            <p className="text-xs text-muted-foreground">No advisors yet</p>
                            <p className="text-xs text-muted-foreground/60 mt-0.5">Click advisors on the left to add them</p>
                          </div>
                        ) : (
                          allAgents
                            .filter((a) => selectedAdvisorSubordinates.includes(a.id))
                            .map((a) => (
                              <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white border border-violet-100 shadow-sm">
                                <Avatar className="h-8 w-8 shrink-0">
                                  <AvatarImage src={a.photo || ""} />
                                  <AvatarFallback className="text-xs bg-violet-100 text-violet-700">
                                    {a.name.split(" ").map((n) => n[0]).join("")}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-violet-900 truncate">{a.name}</p>
                                  <p className="text-xs text-violet-500 truncate">{a.agentType}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAdvisorSubordinateChange(a.id, false)}
                                  className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors shrink-0"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))
                        )}
                      </div>
                    </div>

                  </div>
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
