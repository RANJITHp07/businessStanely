"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, User, Building2, Phone, Mail, MapPin, MessageSquare } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

const clientTypes = [
    { value: "individual", label: "Individual" },
    { value: "organization", label: "Organization" },
]

const genderOptions = [
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
    { value: "other", label: "Other" },
    { value: "prefer-not-to-say", label: "Prefer not to say" },
]

const idProofTypes = [
    { value: "passport", label: "Passport" },
    { value: "drivers-license", label: "Driver's License" },
    { value: "national-id", label: "National ID" },
    { value: "social-security", label: "Social Security Card" },
    { value: "voter-id", label: "Voter ID" },
]

const entityTypes = [
    { value: "corporation", label: "Corporation" },
    { value: "llc", label: "Limited Liability Company (LLC)" },
    { value: "partnership", label: "Partnership" },
    { value: "sole-proprietorship", label: "Sole Proprietorship" },
    { value: "non-profit", label: "Non-Profit Organization" },
    { value: "government", label: "Government Entity" },
]

const communicationPreferences = [
    { value: "email", label: "Email" },
    { value: "phone", label: "Phone Call" },
    { value: "sms", label: "SMS/Text Message" },
    { value: "mail", label: "Physical Mail" },
    { value: "in-person", label: "In-Person Meeting" },
]

import { Client } from "@/types";

interface ClientFormProps {
    client?: Client;
}

export default function ClientForm({ client }: ClientFormProps) {
    const [formData, setFormData] = useState({
        clientType: client?.clientType || "",
        email: client?.email || "",
        phoneNumber: client?.phoneNumber || "",
        secondaryPhoneNumber: client?.secondaryPhoneNumber || "",
        address: client?.address || "",
        preferredCommunication: client?.preferredCommunication || "",
        notes: client?.notes || "",
        // Individual fields
        firstName: client?.firstName || "",
        lastName: client?.lastName || "",
        gender: client?.gender || "",
        idProofType: client?.idProofType || "",
        idProofNumber: client?.idProofNumber || "",
        // Organization fields
        organizationName: client?.organizationName || "",
        registrationNumber: client?.registrationNumber || "",
        entityType: client?.entityType || "",
        authorizedPersonName: client?.authorizedPersonName || "",
        designation: client?.designation || "",
        contactEmail: client?.contactEmail || "",
        gstNumber: client?.gstNumber || "",
    })

    const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(client?.dateOfBirth ? new Date(client.dateOfBirth) : undefined)
    const [incorporationDate, setIncorporationDate] = useState<Date | undefined>(client?.incorporationDate ? new Date(client.incorporationDate) : undefined)

    const handleInputChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const url = client ? `/api/clients/${client.id}` : "/api/clients";
        const method = client ? "PUT" : "POST";

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...formData,
                    dateOfBirth,
                    incorporationDate,
                }),
            });

            if (response.ok) {
                alert(`Client ${client ? 'updated' : 'created'} successfully!`);
                if (!client) {
                    resetForm();
                }
            } else {
                const errorData = await response.json();
                alert(`Failed to ${client ? 'update' : 'create'} client: ${errorData.error}`);
            }
        } catch (error) {
            console.error("Error submitting form:", error);
            alert("An unexpected error occurred. Please try again.");
        }
    }

    const resetForm = () => {
        setFormData({
            clientType: "",
            email: "",
            phoneNumber: "",
            secondaryPhoneNumber: "",
            address: "",
            preferredCommunication: "",
            notes: "",
            firstName: "",
            lastName: "",
            gender: "",
            idProofType: "",
            idProofNumber: "",
            organizationName: "",
            registrationNumber: "",
            entityType: "",
            authorizedPersonName: "",
            designation: "",
            contactEmail: "",
            gstNumber: "",
        })
        setDateOfBirth(undefined)
        setIncorporationDate(undefined)
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">{client ? "Edit Client" : "Create New Client"}</h1>
                <p className="text-muted-foreground mt-2">
                    {client ? "Update the client's details." : "Add a new client to your system with complete contact and legal information."}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Client Type Selection */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Client Type
                        </CardTitle>
                        <CardDescription>Select the type of client you want to create</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <Label htmlFor="client-type">Client Type *</Label>
                            <Select value={formData.clientType} onValueChange={(value) => handleInputChange("clientType", value)}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select client type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {clientTypes.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                            <div className="flex items-center gap-2">
                                                {type.value === "individual" ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                                                {type.label}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Dynamic Fields Based on Client Type */}
                {formData.clientType === "individual" && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                Personal Information
                            </CardTitle>
                            <CardDescription>Enter individual client details</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="first-name">First Name *</Label>
                                    <Input
                                        id="first-name"
                                        placeholder="Enter first name"
                                        value={formData.firstName}
                                        onChange={(e) => handleInputChange("firstName", e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="last-name">Last Name *</Label>
                                    <Input
                                        id="last-name"
                                        placeholder="Enter last name"
                                        value={formData.lastName}
                                        onChange={(e) => handleInputChange("lastName", e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="gender">Gender</Label>
                                    <Select value={formData.gender} onValueChange={(value) => handleInputChange("gender", value)}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select gender" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {genderOptions.map((gender) => (
                                                <SelectItem key={gender.value} value={gender.value}>
                                                    {gender.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Date of Birth</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-full justify-start text-left font-normal",
                                                    !dateOfBirth && "text-muted-foreground",
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {dateOfBirth ? format(dateOfBirth, "PPP") : "Select date of birth"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={dateOfBirth}
                                                onSelect={setDateOfBirth}
                                                initialFocus
                                                disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="id-proof-type">ID Proof Type</Label>
                                    <Select
                                        value={formData.idProofType}
                                        onValueChange={(value) => handleInputChange("idProofType", value)}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select ID proof type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {idProofTypes.map((idType) => (
                                                <SelectItem key={idType.value} value={idType.value}>
                                                    {idType.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="id-proof-number">ID Proof Number</Label>
                                    <Input
                                        id="id-proof-number"
                                        placeholder="Enter ID proof number"
                                        value={formData.idProofNumber}
                                        onChange={(e) => handleInputChange("idProofNumber", e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {formData.clientType === "organization" && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building2 className="h-5 w-5" />
                                Organization Information
                            </CardTitle>
                            <CardDescription>Enter organization details and authorized person information</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="organization-name">Organization Name *</Label>
                                    <Input
                                        id="organization-name"
                                        placeholder="Enter organization name"
                                        value={formData.organizationName}
                                        onChange={(e) => handleInputChange("organizationName", e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="registration-number">Registration Number</Label>
                                    <Input
                                        id="registration-number"
                                        placeholder="Enter registration number"
                                        value={formData.registrationNumber}
                                        onChange={(e) => handleInputChange("registrationNumber", e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="entity-type">Entity Type</Label>
                                    <Select value={formData.entityType} onValueChange={(value) => handleInputChange("entityType", value)}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Select entity type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {entityTypes.map((entity) => (
                                                <SelectItem key={entity.value} value={entity.value}>
                                                    {entity.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="gst-number">GST Number</Label>
                                    <Input
                                        id="gst-number"
                                        placeholder="Enter GST number"
                                        value={formData.gstNumber}
                                        onChange={(e) => handleInputChange("gstNumber", e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Incorporation Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !incorporationDate && "text-muted-foreground",
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {incorporationDate ? format(incorporationDate, "PPP") : "Select incorporation date"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={incorporationDate}
                                            onSelect={setIncorporationDate}
                                            initialFocus
                                            disabled={(date) => date > new Date()}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Authorized Person Section */}
                            <div className="border-t pt-6">
                                <h3 className="text-lg font-semibold mb-4">Authorized Person Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="authorized-person-name">Authorized Person Name *</Label>
                                        <Input
                                            id="authorized-person-name"
                                            placeholder="Enter authorized person name"
                                            value={formData.authorizedPersonName}
                                            onChange={(e) => handleInputChange("authorizedPersonName", e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="designation">Designation</Label>
                                        <Input
                                            id="designation"
                                            placeholder="Enter designation (e.g., CEO, Manager)"
                                            value={formData.designation}
                                            onChange={(e) => handleInputChange("designation", e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2 mt-4">
                                    <Label htmlFor="contact-email">Contact Email</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="contact-email"
                                            type="email"
                                            placeholder="Enter contact email"
                                            value={formData.contactEmail}
                                            onChange={(e) => handleInputChange("contactEmail", e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Common Contact Information */}
                {formData.clientType && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Phone className="h-5 w-5" />
                                Contact Information
                            </CardTitle>
                            <CardDescription>Enter contact details and communication preferences</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email *</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="Enter email address"
                                        value={formData.email}
                                        onChange={(e) => handleInputChange("email", e.target.value)}
                                        className="pl-10"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="phone-number">Phone Number *</Label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="phone-number"
                                            placeholder="Enter phone number"
                                            value={formData.phoneNumber}
                                            onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                                            className="pl-10"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="secondary-phone-number">Secondary Phone Number</Label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="secondary-phone-number"
                                            placeholder="Enter secondary phone number"
                                            value={formData.secondaryPhoneNumber}
                                            onChange={(e) => handleInputChange("secondaryPhoneNumber", e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="address">Address</Label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Textarea
                                        id="address"
                                        placeholder="Enter complete address"
                                        value={formData.address}
                                        onChange={(e) => handleInputChange("address", e.target.value)}
                                        className="pl-10"
                                        rows={3}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="preferred-communication">Preferred Communication</Label>
                                <div className="relative">
                                    <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Select
                                        value={formData.preferredCommunication}
                                        onValueChange={(value) => handleInputChange("preferredCommunication", value)}
                                    >
                                        <SelectTrigger className="pl-10 w-full">
                                            <SelectValue placeholder="Select preferred communication method" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {communicationPreferences.map((pref) => (
                                                <SelectItem key={pref.value} value={pref.value}>
                                                    {pref.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="notes">Notes</Label>
                                <Textarea
                                    id="notes"
                                    placeholder="Enter any additional notes or comments about the client"
                                    value={formData.notes}
                                    onChange={(e) => handleInputChange("notes", e.target.value)}
                                    rows={4}
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Submit Buttons */}
                {formData.clientType && (
                    <div className="flex justify-end gap-4">
                        <Button className="bg-[#f42b03] hover:bg-[#f42b03] shadow-none hover:shadow-lg transition-shadow duration-300 text-white hover:text-white cursor-pointer" type="button" variant="outline" onClick={resetForm}>
                            Reset Form
                        </Button>
                        <Button type="submit" className="cursor-pointer shadow-none hover:shadow-lg transition-shadow duration-300" >
                            {client ? "Update Client" : "Create Client"}
                        </Button>
                    </div>
                )}
            </form>
        </div>
    )
}
