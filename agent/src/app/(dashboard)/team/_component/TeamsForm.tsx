"use client";

import React, { useState, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Upload, X, Users, FileText, User } from "lucide-react";

type TeamMember = {
  id: string;
  name: string;
  email?: string;
  photo?: string;
  type?: string;
};
type Team = {
  id: string;
  name: string;
  email?: string;
  photo?: string;
  phoneNumber?: string;
  secondaryPhoneNumber?: string;
  type?: string;
  jurisdiction?: string;
  specializations?: string[];
  subordinates?: TeamMember[];
};
interface TeamsFormProps {
  team?: Team;
}

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
const jurisdictions = ["India", "USA", "UAE", "Others"];
const specializations = [
  "All",
  "Corporate Law",
  "Criminal Law",
  "Family Law",
  "Intellectual Property",
  "Tax Law",
  "Employment Law",
  "Real Estate Law",
  "International Law",
  "Other",
];
const allSpecializations = specializations.filter((s) => s !== "All");

export default function TeamsForm({ team }: TeamsFormProps) {
  const [formData, setFormData] = useState({
    name: team?.name || "",
    email: team?.email || "",
    phoneNumber: team?.phoneNumber || "",
    secondaryPhoneNumber: team?.secondaryPhoneNumber || "",
    type: team?.type || "",
    jurisdiction: team?.jurisdiction || "",
    specializations: team?.specializations || [],
    photo: team?.photo || "",
    subordinates: team?.subordinates || [],
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(team?.photo || null);
  const [selectedSpecializations, setSelectedSpecializations] = useState<string[]>(team?.specializations || []);
  // Removed unused subordinates state
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handlers
  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
        setFormData((prev) => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };
  const removePhoto = () => {
    setPhotoPreview(null);
    setFormData((prev) => ({ ...prev, photo: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSpecializationChange = (spec: string, checked: boolean) => {
    if (spec === "All") {
      setSelectedSpecializations(checked ? allSpecializations : []);
      setFormData((prev) => ({ ...prev, specializations: checked ? allSpecializations : [] }));
    } else {
      const updated = checked
        ? [...selectedSpecializations, spec]
        : selectedSpecializations.filter((s) => s !== spec);
      setSelectedSpecializations(updated);
      setFormData((prev) => ({ ...prev, specializations: updated }));
    }
  };

  // Dummy subordinates for UI (replace with API call as needed)
  const allAgents: TeamMember[] = [
    { id: "1", name: "Alice Smith", email: "alice@example.com", type: "Manager" },
    { id: "2", name: "Bob Johnson", email: "bob@example.com", type: "Executive" },
    { id: "3", name: "Charlie Lee", email: "charlie@example.com", type: "Trainee" },
  ];
  const [agentSearch, setAgentSearch] = useState("");
  const filteredAgents = allAgents.filter(
    (a) =>
      a.name.toLowerCase().includes(agentSearch.toLowerCase()) ||
      (a.email && a.email.toLowerCase().includes(agentSearch.toLowerCase())) ||
      (a.type && a.type.toLowerCase().includes(agentSearch.toLowerCase()))
  );
  const [selectedSubordinates, setSelectedSubordinates] = useState<string[]>(team?.subordinates?.map((s) => s.id) || []);
  const handleSubordinateChange = (id: string, checked: boolean) => {
    const updated = checked
      ? [...selectedSubordinates, id]
      : selectedSubordinates.filter((sid) => sid !== id);
    setSelectedSubordinates(updated);
    setFormData((prev) => ({
      ...prev,
      subordinates: allAgents.filter((a) => updated.includes(a.id)),
    }));
  };

  // Submit handler (dummy)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: API call to save team
    // console.log(formData);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <form onSubmit={handleSubmit}>
        {/* Photo Upload */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-8 w-8" />
              Team Photo
            </CardTitle>
            <CardDescription>Upload a team photo (optional)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20">
                {photoPreview ? (
                  <AvatarImage src={photoPreview} />
                ) : (
                  <AvatarFallback>{formData.name ? formData.name[0] : "T"}</AvatarFallback>
                )}
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
                    ref={fileInputRef}
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
          </CardContent>
        </Card>

        {/* Basic Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Team Name *</Label>
                <Input
                  id="name"
                  placeholder="Enter team name"
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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

        {/* Professional Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Professional Information
            </CardTitle>
            <CardDescription>Team type, specializations, and credentials</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Team Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => handleInputChange("type", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select team type" />
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
            <div className="space-y-3">
              <Label>Specializations *</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {specializations.map((spec) => (
                  <div key={spec} className="flex items-center space-x-2">
                    <Checkbox
                      id={spec}
                      checked={
                        spec === "All"
                          ? selectedSpecializations.length === allSpecializations.length
                          : selectedSpecializations.includes(spec)
                      }
                      onCheckedChange={(checked) =>
                        handleSpecializationChange(spec, checked as boolean)
                      }
                    />
                    <Label
                      htmlFor={spec}
                      className={`text-sm ${spec === "All" ? "font-medium" : "font-normal"}`}
                    >
                      {spec === "All" ? "Select All Specializations" : spec}
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
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members
            </CardTitle>
            <CardDescription>Assign team members to this team.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Search Input */}
            <div className="space-y-2">
              <Label htmlFor="agent-search">Search Members</Label>
              <Input
                id="agent-search"
                placeholder="Search by name, type, or email..."
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                className="max-w-md"
              />
            </div>
            {/* Selected Members Display */}
            {selectedSubordinates.length > 0 && (
              <div className="space-y-3">
                <Label>Selected Members ({selectedSubordinates.length})</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedSubordinates.map((id) => {
                    const selectedAgent = allAgents.find((a) => a.id === id);
                    return selectedAgent ? (
                      <div
                        key={selectedAgent.id}
                        className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={selectedAgent.photo || ""} />
                            <AvatarFallback className="bg-blue-100 text-blue-600">
                              {selectedAgent.name.split(" ").map((n) => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-blue-900">{selectedAgent.name}</p>
                            <p className="text-sm text-blue-600">{selectedAgent.type}</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSubordinateChange(selectedAgent.id, false)}
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
            {/* Available Members */}
            <div className="space-y-3">
              <Label>Available Members</Label>
              {filteredAgents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {agentSearch
                    ? "No members found matching your search."
                    : "No members available."}
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
                          checked={selectedSubordinates.includes(availableAgent.id)}
                          onCheckedChange={(checked) =>
                            handleSubordinateChange(availableAgent.id, checked as boolean)
                          }
                        />
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={availableAgent.photo || ""} />
                          <AvatarFallback>
                            {availableAgent.name.split(" ").map((n) => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <Label htmlFor={availableAgent.id} className="font-medium cursor-pointer">
                            {availableAgent.name}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {availableAgent.type} • {availableAgent.email}
                          </p>
                        </div>
                      </div>
                      {selectedSubordinates.includes(availableAgent.id) && (
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
          <Button type="submit">
            {team ? "Update Team" : "Create Team"}
          </Button>
        </div>
      </form>
    </div>
  );
}