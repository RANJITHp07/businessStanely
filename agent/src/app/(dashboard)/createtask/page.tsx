import React from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CalendarIcon,
  FileText,
  User,
  Phone,
  Mail,
  AlertCircle,
  Users,
  Plus,
} from "lucide-react";

export default function TaskForm() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black">Create New Task</h1>
        <p className="text-muted-foreground text-black mt-2">
          Create and assign a new task with client information and completion date.
        </p>
      </div>

      <form className="space-y-8">
        {/* Task Basic Information */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex text-black items-center gap-2">
              <FileText className="h-5 text-black w-5" />
              Task Information
            </CardTitle>
            <CardDescription className="text-black">Enter the basic task details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2 text-black">
              <Label htmlFor="task-name">Task Name *</Label>
              <Input
              className="text-black"
                id="task-name"
                placeholder="Enter task name (e.g., Contract Review, Legal Research)"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-black" htmlFor="description ">Task Description *</Label>
              <Textarea
              className="text-black"
                id="description"
                placeholder="Describe the task in detail, including any specific requirements or instructions..."
                rows={4}
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Client Information */}
        <Card className="bg-white">
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-black">
                <User className="h-5 w-5 text-black" />
                Client Information
              </CardTitle>
              <CardDescription className="text-black">
                Select client and their contact details will be auto-filled
              </CardDescription>
            </div>

            <Dialog>
              <DialogTrigger asChild>
                <Button type="button">
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
                    <Select>
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        placeholder="Enter first name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        placeholder="Enter last name"
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
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Organization Form Fields (Alternative) */}
                  <div className="space-y-2">
                    <Label htmlFor="organizationName">Organization Name *</Label>
                    <Input
                      id="organizationName"
                      placeholder="Enter organization name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="authorizedPersonName">Authorized Person *</Label>
                    <Input
                      id="authorizedPersonName"
                      placeholder="Enter authorized person name"
                    />
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                  <Button type="button">
                    Create Client
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-2 text-black">
              <Label htmlFor="client">Select Client *</Label>
              <Input
                id="client"
                type="text"
                placeholder="Type to search clients..."
                className="w-full text-black"
              />
            </div>

            {/* Auto-filled Contact Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 text-black">
                <Label htmlFor="contact-number">Contact Number *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="contact-number"
                    placeholder="Contact number will auto-fill"
                    readOnly
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2 text-black">
                <Label htmlFor="email-id">Email ID *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email-id"
                    type="email"

                    placeholder="Email will auto-fill"
                    readOnly
                    className="pl-10 text-black"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Selected Client Preview */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-blue-100 text-blue-600">
                    JD
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 mx-2">
                  <h4 className="font-medium text-blue-900">
                    John Doe
                  </h4>
                </div>
                <Badge variant="secondary" className="text-xs mx-2">
                  individual
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task Priority, Assignment & Completion Date */}
        <Card className="bg-white text-black">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Priority, Assignment & Schedule
            </CardTitle>
            <CardDescription>
              Set task priority, assign to an agent, and set completion date
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Task Priority *</Label>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select priority level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Low
                      </div>
                    </SelectItem>
                    <SelectItem value="medium">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Medium
                      </div>
                    </SelectItem>
                    <SelectItem value="high">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        High
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <div className="mt-2">
                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 border">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Medium
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assigned-agent ">Assign Task To *</Label>
                <Input
                
                  id="assigned-agent"
                  type="text"
                  placeholder="Type to search agents..."
                  className="w-full text-black"
                />
              </div>
            </div>

            {/* Completion Date */}
            <div className="space-y-2">
              <Label>Task Completion Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start bg-white text-left font-normal text-muted-foreground"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    Select completion date
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto bg-white text-black p-0">
                  <Calendar
                    mode="single"
                    fromDate={new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Choose the date when this task should be completed
              </p>
            </div>

            {/* Assignment Preview */}
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-green-100 text-green-600">
                    RW
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-medium text-green-900">
                    Assigned to: Robert Wilson
                  </h4>
                  <p className="text-sm text-green-600">
                    Role: Senior Lawyer
                  </p>
                  <p className="text-sm text-green-600">
                    Due: December 15, 2024
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            className="bg-[#f42b03] hover:bg-[#f42b03] shadow-none hover:shadow-lg transition-shadow duration-300 text-white hover:text-white cursor-pointer"
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="cursor-pointer shadow-none hover:shadow-lg transition-shadow duration-300"
          >
            Create Task
          </Button>
        </div>
      </form>
    </div>
  );
}