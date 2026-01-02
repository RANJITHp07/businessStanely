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
  Loader2,
} from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

import { Client, Agent, Task, Legislation } from "@/types";

interface Category {
  id: string;
  name: string;
  description?: string;
  status: string;
  timePeriod?: number; // Added timePeriod property
  agentCanEditDays?: boolean;
}
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

const taskPriorities = [
  {
    value: "low",
    label: "Low",
    color: "bg-green-100 text-green-800 border-green-200",
  },
  {
    value: "medium",
    label: "Medium",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  {
    value: "high",
    label: "High",
    color: "bg-red-100 text-red-800 border-red-200",
  },
];

type TaskFormProps = {
  id?: string;
};

export default function TaskForm({ id }: TaskFormProps) {
  const [formData, setFormData] = useState({
    title: "",
    clientId: "",
    priority: "",
    assignedToId: "",
    description: "",
    categoryId: "",
    legislationId: "",
    legislationName: "",
    recurring: "0",
    triggerDate: "", // Added triggerDate to formData
    recurringType: "",
    status: ""
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [dueDate, setDueDate] = useState<Date>();
  // Find the selected category object
  useEffect(() => {
    if (formData.categoryId && categories.length > 0) {
      const cat = categories.find((c) => c.id === formData.categoryId) || null;
      setSelectedCategory(cat);
    } else {
      setSelectedCategory(null);
    }
  }, [formData.categoryId, categories]);

  // Disable due date if agentCanEditDays is false for the selected category
  const isDueDateDisabled = !!(selectedCategory && selectedCategory.agentCanEditDays === false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClientType, setSelectedClientType] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [agentSearchQuery, setAgentSearchQuery] = useState("");
  const [showAgentSuggestions, setShowAgentSuggestions] = useState(false);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryData, setNewCategoryData] = useState({
    name: "",
    description: "",
    timePeriod: "", // Added timePeriod property
    notes: "",
    processFlow: "",
  });
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);

  const [legislationSearchQuery, setLegislationSearchQuery] = useState("");
  const [showLegislationSuggestions, setShowLegislationSuggestions] = useState(false);
  const [legislationList, setLegislationList] = useState<Legislation[]>([]);
  const [isFromRetainership, setIsFromRetainership] = useState(false); // New state to track if form is from retainership

  // Add this handler function
  const handleNewCategoryInputChange = (field: string, value: string) => {
    setNewCategoryData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddCategoryClick = () => {
    setIsCategoryModalOpen(true);
    // Reset form data when opening modal
    setNewCategoryData({
      name: "",
      description: "",
      timePeriod: "", // Reset timePeriod property
      notes: "",
      processFlow: "",
    });
  };

  const handleCreateCategory = async () => {
    if (!newCategoryData.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    if (isCreatingCategory) {
      return;
    }

    setIsCreatingCategory(true);

    try {
      const response = await fetch("/api/task-categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newCategoryData),
      });

      if (response.ok) {
        const newCategoryRaw = await response.json();
        // Patch: ensure agentCanEditDays is present (default false if missing)
        const newCategory = {
          ...newCategoryRaw,
          agentCanEditDays: typeof newCategoryRaw.agentCanEditDays === 'boolean' ? newCategoryRaw.agentCanEditDays : false,
        };
        setCategories((prev) => [newCategory, ...prev]);
        setFormData((prev) => ({ ...prev, categoryId: newCategory.id }));
        setCategorySearchQuery(newCategory.name);
        setIsCategoryModalOpen(false);

        // Show different success message based on category status
        if (newCategory.status === "approved") {
          toast.success("Category created and approved successfully!");
        } else {
          toast.success(
            "Category created! It's pending approval and will be available once approved."
          );
        }

        handleCategorySelection(newCategory); // Auto-select due date based on new category
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create category");
      }
    } catch (error) {
      console.error("Error creating category:", error);
      toast.error("Failed to create category");
    } finally {
      setIsCreatingCategory(false);
    }
  };

  // Filter categories: exclude rejected ones and match search query
  const filteredCategories = categories.filter((category) => {
    // Only show approved and pending categories, not rejected ones
    if (category.status === "rejected") return false;

    return category.name.toLowerCase().includes(categorySearchQuery.toLowerCase());
  });

  // Add this filtering logic
  const filteredAgents = agents.filter((agent) => {
    return (
      agent.name.toLowerCase().includes(agentSearchQuery.toLowerCase()) ||
      agent.agentType.toLowerCase().includes(agentSearchQuery.toLowerCase())
    );
  });

  // Add click outside handler for agents and categories
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as Element)?.closest(".relative")) {
        setShowAgentSuggestions(false);
        setShowCategorySuggestions(false);
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Add this filtering logic
  const filteredClients = clients.filter((client) => {
    const clientName =
      client.clientType === "individual"
        ? `${client.firstName || ""} ${client.lastName || ""}`.trim()
        : client.organizationName || "";
    return clientName.toLowerCase().includes(searchQuery.toLowerCase());
  });
  // New client form state
  const [newClientData, setNewClientData] = useState({
    firstName: "",
    lastName: "",
    organizationName: "",
    authorizedPersonName: "",
    email: "",
    phoneNumber: "",
  });

  const router = useRouter();

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const legislationId = query.get("legislationId");
    const serviceId = query.get("serviceId");
    const assignedAgent = query.get("assignedAgent");
    const client = query.get("client");

    if (legislationId || assignedAgent || client || serviceId) {
      setFormData((prev) => ({
        ...prev,
        legislationId: legislationId || prev.legislationId,
        assignedToId: assignedAgent || prev.assignedToId,
        clientId: client || prev.clientId,
      }));

      setIsFromRetainership(true); // Mark the form as coming from retainership

      if (assignedAgent) {
        const selectedAgent = agents.find((agent) => agent.id === assignedAgent);
        if (selectedAgent) {
          setAgentSearchQuery(selectedAgent.name); // Update the search query to show the selected agent's name
        }
      }

      if (client) {
        const selectedClient = clients.find((c) => c.id === client);
        if (selectedClient) {
          const clientName =
            selectedClient.clientType === "individual"
              ? `${selectedClient.firstName || ""} ${selectedClient.lastName || ""}`.trim()
              : selectedClient.organizationName || "";
          setSearchQuery(clientName); // Update the search query to show the selected client's name
        }
      }

      if (legislationId) {
        const selectedLegislation = legislationList.find((legislation) => legislation.id === legislationId);
        if (selectedLegislation) {
          setLegislationSearchQuery(selectedLegislation.title); // Update the search query to show the selected legislation's name
        }
      }
      if (serviceId) {
        (async () => {
          const res = await fetch(`/api/task-categories/${serviceId}`)
          if (!res.ok) {
            throw new Error(`Failed to fetch task categories: ${res.status}`);
          }

          const data = await res.json();
          setCategorySearchQuery(data.name)
          setFormData((prev) => ({ ...prev, categoryId: data.id }))
        })()
      }
    }
  }, [agents, clients, legislationList]);

  useEffect(() => {
    const fetchClientsAndAgents = async () => {
      try {
        const [clientsRes, teamRes, categoriesRes, selfRes] = await Promise.all([
          fetch("/api/clients"),
          fetch("/api/team-members"),
          fetch("/api/task-categories"),
          fetch("/api/agents/me"), // Add endpoint to get current agent
        ]);
        const clientsData = await clientsRes.json();
        const teamMembers = await teamRes.json();
        const categoriesData = await categoriesRes.json();
        let selfAgent = null;
        if (selfRes.ok) {
          selfAgent = await selfRes.json();
        }
        setClients(clientsData);
        // Add current agent to the team list if not already present
        let allAgents = teamMembers;
        if (selfAgent && !teamMembers.some((a: Agent) => a.id === selfAgent.id)) {
          allAgents = [selfAgent, ...teamMembers];
        }
        setAgents(allAgents);
        setCategories(categoriesData);
      } catch (error) {
        console.error("Failed to fetch clients, agents, or categories", error);
      }
    };
    fetchClientsAndAgents();

    if (id) {
      setIsEditMode(true);
      const fetchTask = async () => {
        try {
          const response = await fetch(`/api/tasks/${id}`);
          if (response.ok) {
            // The agent API returns { task: { ... } }
            const data = await response.json();
            const task: Task = data.task || data;
            setFormData({
              title: task.title,
              clientId: task.client?.id || "",
              priority: task.priority,
              assignedToId: task.assignedTo?.id || "",
              description: task.description || "",
              categoryId: task.category?.id || "",
              legislationId: task.legislationId || "",
              legislationName: task.legislation?.title || "",
              recurring: task.recurring?.toString() || "0",
              recurringType: task.recurringType || "",
              triggerDate: task.triggerDate || "", // Ensure triggerDate is included
              status: formData?.status
            });
            if (task.category) {
              setCategorySearchQuery(task.category.name);
            }
            if (task.dueDate) {
              setDueDate(new Date(task.dueDate));
            }
          }
        } catch (error) {
          console.error("Failed to fetch task", error);
        }
      };
      fetchTask();
    }
  }, [id]);

  // Auto-fill contact number and email when client is selected
  useEffect(() => {
    if (formData.clientId) {
      const client = clients.find((c) => c.id === formData.clientId);
      if (client) {
        setSelectedClient(client);
      }
    } else {
      setSelectedClient(null);
    }
  }, [formData.clientId, clients]);

  useEffect(() => {
    if (formData.legislationId && legislationList.length > 0) {
      const selectedLegislation = legislationList.find(
        (legislation) => legislation.id === formData.legislationId
      );
      if (selectedLegislation) {
        setFormData((prev) => ({
          ...prev,
          legislationName: selectedLegislation.title,
        }));
      }
    }
  }, [formData.legislationId, legislationList]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNewClientInputChange = (field: string, value: string) => {
    setNewClientData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddClientClick = () => {
    setIsModalOpen(true);
    // Reset form data when opening modal
    setSelectedClientType("");
    setNewClientData({
      firstName: "",
      lastName: "",
      organizationName: "",
      authorizedPersonName: "",
      email: "",
      phoneNumber: "",
    });
  };

  const handleCreateClient = async () => {
    if (isCreatingClient) {
      return;
    }

    setIsCreatingClient(true);

    try {
      const clientData = {
        clientType: selectedClientType,
        ...(selectedClientType === "individual"
          ? {
            firstName: newClientData.firstName,
            lastName: newClientData.lastName,
          }
          : {
            organizationName: newClientData.organizationName,
            authorizedPersonName: newClientData.authorizedPersonName,
          }),
        email: newClientData.email,
        phoneNumber: newClientData.phoneNumber,
      };

      const response = await fetch("/api/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(clientData),
      });

      if (response.ok) {
        const newClient = await response.json();
        setClients((prev) => [...prev, newClient]);
        setFormData((prev) => ({ ...prev, clientId: newClient.id }));
        setIsModalOpen(false);
        toast.success("Client created successfully!");
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to create client");
      }
    } catch (error) {
      console.error("Error creating client:", error);
      toast.error("An unexpected error occurred while creating client");
    } finally {
      setIsCreatingClient(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent multiple submissions
    if (isSubmitting) {
      return;
    }

    const url = isEditMode ? `/api/tasks/${id}` : "/api/tasks";
    const method = isEditMode ? "PUT" : "POST";

    // Validate required fields
    if (!formData.title.trim()) {
      toast.error("Task title is required");
      return;
    }

    if (!formData.clientId) {
      toast.error("Please select a client");
      return;
    }

    if (!formData.assignedToId) {
      toast.error("Please assign the task to an agent");
      return;
    }

    if (!formData.priority) {
      toast.error("Please select a priority level");
      return;
    }

    if (!dueDate) {
      toast.error("Due date is required");
      return;
    }

    // Check if due date is in the past (only for new tasks)
    if (
      !isEditMode &&
      dueDate &&
      isBefore(startOfDay(dueDate), startOfDay(new Date()))
    ) {
      toast.error("Due date cannot be in the past");
      return;
    }

    if (!isEditMode && agents.length === 0) {
      toast.error("Cannot create a task without any agents in the system.");
      return;
    }

    // Only require triggerDate if recurring is set
    if (formData.recurring !== "0" && !formData.triggerDate) {
      toast.error("Trigger Date is required for recurring tasks");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          recurring: formData.recurring.split("-")[1],
          dueDate,
          status: formData.status || "To Do",
          createdById: !isEditMode ? agents[0].id : undefined,
        }),
      });

      if (response.ok) {
        toast.success(
          `Task ${isEditMode ? "updated" : "created"} successfully!`
        );
        router.back();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error);
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPriorityBadge = (priority: string | null) => {
    if (!priority) return null;
    const priorityConfig = taskPriorities.find(
      (p) => p.value === priority.toLowerCase()
    );
    if (!priorityConfig) return null;

    return (
      <Badge className={`${priorityConfig.color} border`}>
        <AlertCircle className="w-3 h-3 mr-1" />
        {priorityConfig.label}
      </Badge>
    );
  };

  const getClientTypeBadge = (type: string | null) => {
    if (!type) return null;
    return (
      <Badge
        variant={type === "organization" ? "default" : "secondary"}
        className="text-xs mx-2"
      >
        {type}
      </Badge>
    );
  };

  const isCreateClientFormValid = () => {
    if (
      !selectedClientType ||
      !newClientData.email ||
      !newClientData.phoneNumber
    )
      return false;

    if (selectedClientType === "individual") {
      return newClientData.firstName && newClientData.lastName;
    } else {
      return (
        newClientData.organizationName && newClientData.authorizedPersonName
      );
    }
  };

  // Define the filteredLegislations variable
  const filteredLegislations = legislationList.filter((legislation) => {
    return (
      legislation.title.toLowerCase().includes(legislationSearchQuery.toLowerCase()) ||
      (legislation.description && legislation.description.toLowerCase().includes(legislationSearchQuery.toLowerCase()))
    );
  });


  // Log API call and response for /api/legislations
  useEffect(() => {
    fetch("/api/legislation")
      .then((response) => response.json())
      .then((data) => {
        setLegislationList(data);
      })
      .catch((error) => {
        console.error("Error fetching legislations:", error);
      });
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const legislationId = query.get("legislationId");

    if (legislationId) {
      const selectedLegislation = legislationList.find(
        (legislation) => legislation.id === legislationId
      );

      if (selectedLegislation) {
        setFormData((prev) => ({
          ...prev,
          legislationId: selectedLegislation.id,
          legislationName: selectedLegislation.title, // Assuming legislation has a title field
        }));
      }
    }
  }, [legislationList]);

  // Auto-fill assigned agent when assignedAgent query parameter is present
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const assignedAgent = query.get("assignedAgent");

    if (assignedAgent) {
      const selectedAgent = agents.find((agent) => agent.id === assignedAgent);

      if (selectedAgent) {
        setFormData((prev) => ({
          ...prev,
          assignedToId: selectedAgent.id,
        }));
        setAgentSearchQuery(selectedAgent.name); // Update the search query to show the selected agent's name
      }
    }
  }, [agents]);

  const handleCategorySelection = (category: Category) => {
    setFormData((prev) => ({ ...prev, categoryId: category.id, timePeriod: category.timePeriod }));
    setCategorySearchQuery(category.name);
    setShowCategorySuggestions(false);
    setSelectedCategory(category);
    // Automatically set due date based on category's time period
    if (category.timePeriod) {
      const calculatedDueDate = new Date();
      calculatedDueDate.setDate(calculatedDueDate.getDate() + category.timePeriod);
      setDueDate(calculatedDueDate);
    }
  };

  // Add handler for recurring selection to show information
  const handleRecurringChange = (value: string) => {
    handleInputChange("recurring", value.split("-")[1]);
    handleInputChange("recurringType", value.split("-")[0].toLocaleUpperCase());

    // Show information about next task creation if recurring is selected
    if (value !== "0" && dueDate) {
      const nextDueDate = new Date(dueDate);
      nextDueDate.setMonth(nextDueDate.getMonth() + parseInt(value));
      console.log(`Next recurring task will be due on: ${nextDueDate.toLocaleDateString()}`);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          {isEditMode ? "Edit Task" : "Create New Task"}
        </h1>
        <p className="text-muted-foreground mt-2">
          {isEditMode
            ? "Update the details of the existing task."
            : "Create and assign a new task with client information and completion date."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <fieldset disabled={isSubmitting} className="space-y-8">
          {/* Task Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Task Information
              </CardTitle>
              <CardDescription>Enter the basic task details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Service Selection - moved to top */}
              <div>
                <div className="w-full">
                  {/* Top-right Add Button */}
                  <div className="flex justify-end mb-4">
                    <Dialog
                      open={isCategoryModalOpen}
                      onOpenChange={setIsCategoryModalOpen}
                    >
                      <DialogTrigger asChild>
                        <Button
                          type="button"
                          onClick={handleAddCategoryClick}
                          className="h-10"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Service
                        </Button>
                      </DialogTrigger>

                      <DialogContent className="sm:max-w-[400px] w-full">
                        <DialogHeader>
                          <DialogTitle>Add New Service</DialogTitle>
                          <DialogDescription>
                            Create a new service for better organization
                          </DialogDescription>
                        </DialogHeader>

                        {/* Form Fields */}
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="category-name">Service Name *</Label>
                            <Input
                              id="category-name"
                              placeholder="Enter category name (e.g., Legal Research, Contract Review)"
                              className="w-full"
                              value={newCategoryData.name}
                              onChange={(e) =>
                                handleNewCategoryInputChange("name", e.target.value)
                              }
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="category-description">Description</Label>
                            <Textarea
                              id="category-description"
                              placeholder="Brief description of this service (optional)"
                              className="w-full"
                              value={newCategoryData.description}
                              onChange={(e) =>
                                handleNewCategoryInputChange("description", e.target.value)
                              }
                              rows={4}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="category-timePeriod">Time Period (in days)</Label>
                            <Input
                              id="category-timePeriod"
                              type="number"
                              placeholder="Enter time period in days"
                              className="w-full"
                              value={newCategoryData.timePeriod || ""}
                              onChange={(e) =>
                                handleNewCategoryInputChange("timePeriod", e.target.value)
                              }
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="category-notes">Notes</Label>
                          <Textarea
                            id="category-notes"
                            placeholder="Enter notes (optional)"
                            className="w-full"
                            value={newCategoryData.notes}
                            onChange={(e) =>
                              handleNewCategoryInputChange("notes", e.target.value)
                            }
                            rows={2}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="category-processFlow">Process Flow</Label>
                          <Textarea
                            id="category-processFlow"
                            placeholder="Enter process flow (optional)"
                            className="w-full"
                            value={newCategoryData.processFlow}
                            onChange={(e) =>
                              handleNewCategoryInputChange("processFlow", e.target.value)
                            }
                            rows={2}
                          />
                        </div>

                        {/* Modal Actions */}
                        <div className="flex justify-end gap-3 pt-4 border-t">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsCategoryModalOpen(false)}
                            disabled={isCreatingCategory}
                          >
                            Cancel
                          </Button>

                          <Button
                            type="button"
                            onClick={handleCreateCategory}
                            disabled={!newCategoryData.name.trim() || isCreatingCategory}
                          >
                            {isCreatingCategory ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                              </>
                            ) : (
                              "Create Service"
                            )}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>

              <div className="space-y-2 relative">
                <Label htmlFor="taskCategory">Service *</Label>
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
                    required
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

              {/* Task Name - moved after service selection */}
              <div className="space-y-2">
                <Label htmlFor="task-name">Task Name *</Label>
                <Input
                  id="task-name"
                  placeholder="Enter task name (e.g., Contract Review, Legal Research)"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  required
                />
              </div>

              {/* Task Description - moved after task name */}
              <div className="space-y-2">
                <Label htmlFor="description">Task Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the task in detail, including any specific requirements or instructions..."
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  rows={4}
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Client Information */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Client Information
                </CardTitle>
                <CardDescription>
                  Select client and their contact details will be auto-filled
                </CardDescription>
              </div>

              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <Button type="button" onClick={handleAddClientClick}>
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
                      <Select
                        value={selectedClientType}
                        onValueChange={setSelectedClientType}
                      >
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
                    {selectedClientType === "individual" && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="firstName">First Name *</Label>
                            <Input
                              id="firstName"
                              placeholder="Enter first name"
                              value={newClientData.firstName}
                              onChange={(e) =>
                                handleNewClientInputChange(
                                  "firstName",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="lastName">Last Name *</Label>
                            <Input
                              id="lastName"
                              placeholder="Enter last name"
                              value={newClientData.lastName}
                              onChange={(e) =>
                                handleNewClientInputChange(
                                  "lastName",
                                  e.target.value
                                )
                              }
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
                              value={newClientData.email}
                              onChange={(e) =>
                                handleNewClientInputChange(
                                  "email",
                                  e.target.value
                                )
                              }
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
                              value={newClientData.phoneNumber}
                              onChange={(e) =>
                                handleNewClientInputChange(
                                  "phoneNumber",
                                  e.target.value
                                )
                              }
                              className="pl-10"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Organization Form Fields */}
                    {selectedClientType === "organization" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="organizationName">
                            Organization Name *
                          </Label>
                          <Input
                            id="organizationName"
                            placeholder="Enter organization name"
                            value={newClientData.organizationName}
                            onChange={(e) =>
                              handleNewClientInputChange(
                                "organizationName",
                                e.target.value
                              )
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="authorizedPersonName">
                            Authorized Person *
                          </Label>
                          <Input
                            id="authorizedPersonName"
                            placeholder="Enter authorized person name"
                            value={newClientData.authorizedPersonName}
                            onChange={(e) =>
                              handleNewClientInputChange(
                                "authorizedPersonName",
                                e.target.value
                              )
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email *</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="email"
                              type="email"
                              placeholder="Enter email address"
                              value={newClientData.email}
                              onChange={(e) =>
                                handleNewClientInputChange(
                                  "email",
                                  e.target.value
                                )
                              }
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
                              value={newClientData.phoneNumber}
                              onChange={(e) =>
                                handleNewClientInputChange(
                                  "phoneNumber",
                                  e.target.value
                                )
                              }
                              className="pl-10"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Modal Actions */}
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsModalOpen(false)}
                      disabled={isCreatingClient}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleCreateClient}
                      disabled={!isCreateClientFormValid() || isCreatingClient}
                    >
                      {isCreatingClient ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Client"
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="client">Select Client *</Label>
                <div className="relative">
                  <Input
                    id="client"
                    type="text"
                    placeholder="Type to search clients..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (e.target.value.trim()) {
                        setShowSuggestions(true);
                      } else {
                        setShowSuggestions(false);
                      }
                    }}
                    onFocus={() => {
                      if (searchQuery.trim()) {
                        setShowSuggestions(true);
                      }
                    }}
                    className="w-full"
                    disabled={isFromRetainership} // Disable if form is from retainership
                  />

                  {showSuggestions &&
                    searchQuery.trim() &&
                    filteredClients.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                        {filteredClients.map((client) => (
                          <div
                            key={client.id}
                            className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            onClick={() => {
                              const clientName =
                                client.clientType === "individual"
                                  ? `${client.firstName || ""} ${client.lastName || ""
                                    }`.trim()
                                  : client.organizationName || "";
                              setSearchQuery(clientName);
                              handleInputChange("clientId", client.id);
                              setShowSuggestions(false);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {(client.clientType === "individual"
                                    ? `${client.firstName || ""} ${client.lastName || ""
                                    }`
                                    : client.organizationName || ""
                                  )
                                    ?.split(" ")
                                    .filter((n) => n.length > 0)
                                    .map((n) => n[0])
                                    .join("")}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <span className="font-medium">
                                  {client.clientType === "individual"
                                    ? `${client.firstName || ""} ${client.lastName || ""
                                      }`.trim()
                                    : client.organizationName || ""}
                                </span>
                              </div>
                            </div>
                            {getClientTypeBadge(client.clientType)}
                          </div>
                        ))}
                      </div>
                    )}

                  {showSuggestions &&
                    searchQuery &&
                    filteredClients.length === 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-3">
                        <span className="text-gray-500">No clients found</span>
                      </div>
                    )}
                </div>
              </div>

              {/* Auto-filled Contact Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact-number">Contact Number *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="contact-number"
                      placeholder="Contact number will auto-fill"
                      value={selectedClient?.phoneNumber || ""}
                      onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                  {selectedClient && (
                    <p className="text-xs text-muted-foreground">
                      Auto-filled from{" "}
                      {selectedClient.clientType === "individual"
                        ? `${selectedClient.firstName} ${selectedClient.lastName}`
                        : selectedClient.organizationName}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email-id">Email ID *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email-id"
                      type="email"
                      placeholder="Email will auto-fill"
                      value={selectedClient?.email || ""}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                  {selectedClient && (
                    <p className="text-xs text-muted-foreground">
                      Auto-filled from{" "}
                      {selectedClient.clientType === "individual"
                        ? `${selectedClient.firstName} ${selectedClient.lastName}`
                        : selectedClient.organizationName}
                    </p>
                  )}
                </div>
              </div>

              {/* Selected Client Preview */}
              {selectedClient && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        {(selectedClient.clientType === "individual"
                          ? `${selectedClient.firstName} ${selectedClient.lastName}`
                          : selectedClient.organizationName
                        )
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 mx-2">
                      <h4 className="font-medium text-blue-900">
                        {selectedClient.clientType === "individual"
                          ? `${selectedClient.firstName} ${selectedClient.lastName}`
                          : selectedClient.organizationName}
                      </h4>
                      {/* <p className="text-sm text-blue-600">Contact: {selectedClient.authorizedPersonName || 'N/A'}</p> */}
                    </div>
                    {getClientTypeBadge(selectedClient.clientType)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Task Priority, Assignment & Completion Date */}
          <Card>
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
                  <Select
                    value={formData.priority}
                    onValueChange={(value) =>
                      handleInputChange("priority", value)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select priority level" />
                    </SelectTrigger>
                    <SelectContent>
                      {taskPriorities.map((priority) => (
                        <SelectItem key={priority.value} value={priority.value}>
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            {priority.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.priority && (
                    <div className="mt-2">{getPriorityBadge(formData.priority)}</div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assigned-agent">Assign Task To *</Label>
                  <div className="relative">
                    <Input
                      id="assigned-agent"
                      type="text"
                      placeholder="Type to search agents..."
                      value={agentSearchQuery}
                      onChange={(e) => {
                        setAgentSearchQuery(e.target.value);
                        if (e.target.value.trim()) {
                          setShowAgentSuggestions(true);
                        } else {
                          setShowAgentSuggestions(false);
                        }
                      }}
                      onFocus={() => {
                        if (agentSearchQuery.trim()) {
                          setShowAgentSuggestions(true);
                        }
                      }}
                      className="w-full"
                      disabled={isFromRetainership} // Disable if form is from retainership
                    />

                    {showAgentSuggestions &&
                      agentSearchQuery.trim() &&
                      filteredAgents.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                          {filteredAgents.map((agent) => (
                            <div
                              key={agent.id}
                              className="flex items-center gap-2 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                              onClick={() => {
                                const agentName =
                                  agent.name.charAt(0).toUpperCase() +
                                  agent.name.slice(1);
                                setAgentSearchQuery(agentName);
                                handleInputChange("assignedToId", agent.id);
                                setShowAgentSuggestions(false);
                              }}
                            >
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {agent.name
                                    .toUpperCase()
                                    .split(" ")
                                    .filter((n) => n.length > 0)
                                    .map((n) => n[0])
                                    .join("")}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <span className="font-medium">
                                  {agent.name.charAt(0).toUpperCase() +
                                    agent.name.slice(1)}
                                </span>
                                <span className="text-sm text-muted-foreground ml-2">
                                  ({agent.agentType})
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                    {showAgentSuggestions &&
                      agentSearchQuery.trim() &&
                      filteredAgents.length === 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-3">
                          <span className="text-gray-500">No agents found</span>
                        </div>
                      )}
                  </div>
                </div>
              </div>

              {/* Completion Date */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Task Completion Date
                  <span className="text-red-500">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dueDate &&
                        "text-muted-foreground border-red-200 focus:border-red-500"
                      )}
                      disabled={isDueDateDisabled}
                      tabIndex={isDueDateDisabled ? -1 : 0}
                      aria-disabled={isDueDateDisabled}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "PPP") : "Select completion date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={(date) => {
                        setDueDate(date);
                        handleInputChange("triggerDate", "");
                      }}
                      fromDate={new Date(formData.triggerDate || new Date())}
                      initialFocus
                      disabled={Boolean(isDueDateDisabled)}
                    // disabled={{ before: new Date() }}
                    />
                  </PopoverContent>
                </Popover>
                {isDueDateDisabled ? (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <span className="font-semibold">Locked:</span> The admin has locked the days for this service. You cannot change the completion date.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Choose the date when this task should be completed (required)
                  </p>
                )}
              </div>

              {/* Recurring Field */}
              <div className="flex gap-3">
                <div className="space-y-2 w-1/2">
                  <Label htmlFor="recurring">Recurring </Label>
                  <Select
                    value={formData.recurring ? (formData.recurring == "0" ? "0" : `${formData.recurringType.toLocaleLowerCase()}-${formData.recurring}`) : ""}
                    onValueChange={handleRecurringChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select recurring interval (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">No Recurring</SelectItem>
                      {Array.from({ length: 6 }, (_, i) => i + 1).map((day) => (
                        <SelectItem key={`day-${day}`} value={`day-${day}`}>
                          Every {day} {day === 1 ? "day" : "days"}
                        </SelectItem>
                      ))}
                      {Array.from({ length: 3 }, (_, i) => i + 1).map((week) => (
                        <SelectItem key={`week-${week}`} value={`week-${week}`}>
                          Every {week} {week === 1 ? "week" : "weeks"}
                        </SelectItem>
                      ))}
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                        <SelectItem key={month} value={`month-${month}`}>
                          Every {month} {month === 1 ? "month" : "months"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Set how often this task should repeat (1-12 months, optional)
                    {formData.recurring !== "0" && formData.categoryId && dueDate && (
                      <span className="block mt-1 text-blue-600">
                        {(() => {
                          if (!formData.triggerDate) return "";

                          const startDate = new Date(formData.triggerDate);

                          // Get selected category to find time period
                          const selectedCategory = categories.find(
                            cat => cat.id === formData.categoryId
                          );

                          const timePeriod = selectedCategory?.timePeriod || 7; // default 7 days

                          // End date = triggerDate + timePeriod
                          const endDate = new Date(startDate);
                          endDate.setDate(endDate.getDate() + timePeriod);

                          return `Next task period:${startDate.toLocaleDateString(
                            "en-GB"
                          )} to ${endDate.toLocaleDateString("en-GB")}`;
                        })()}
                      </span>
                    )}
                  </p>
                </div>
                <div className="w-1/2">
                  {/* Trigger Date Field - Shown only when recurring is set */}
                  {formData.recurring && formData.recurring !== "0" && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        Trigger Date
                        <span className="text-red-500">*</span>
                      </Label>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !formData.triggerDate &&
                              "text-muted-foreground "
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.triggerDate
                              ? format(new Date(formData.triggerDate), "PPP")
                              : "Select trigger date"}
                          </Button>
                        </PopoverTrigger>

                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={
                              formData.triggerDate
                                ? new Date(formData.triggerDate)
                                : undefined
                            }
                            fromDate={new Date()} // cannot select past dates
                            onSelect={(date) => {
                              if (!date) return;

                              const formattedDate = format(date, "yyyy-MM-dd");
                              handleInputChange("triggerDate", formattedDate);
                            }}
                            initialFocus
                            disabled={
                              dueDate
                                ? {
                                  before: new Date(
                                    dueDate.getFullYear(),
                                    dueDate.getMonth(),
                                    dueDate.getDate() + 1
                                  ),
                                }
                                : undefined
                            }
                          />
                        </PopoverContent>
                      </Popover>

                      <p className="text-xs text-muted-foreground">
                        Choose the date when this task should be triggered (required)
                      </p>
                    </div>

                  )}
                </div>
              </div>

              {/* Assignment Preview */}
              {formData.assignedToId && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-green-100 text-green-600">
                        {agents
                          .find((a) => a.id === formData.assignedToId)
                          ?.name.split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-medium text-green-900">
                        Ownership to:{" "}
                        {agents.find((a) => a.id === formData.assignedToId)?.name}
                      </h4>
                      <p className="text-sm text-green-600">
                        Role:{" "}
                        {
                          agents.find((a) => a.id === formData.assignedToId)
                            ?.agentType
                        }
                      </p>
                      {dueDate && (
                        <p className="text-sm text-green-600">
                          Due: {format(dueDate, "EEEE, MMMM do, yyyy")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Legislation Information */}
          {
            isFromRetainership && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Legislation Information
                  </CardTitle>
                  <CardDescription>
                    Optionally, select legislation for this task
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="legislation">Legislation *</Label>
                    <div className="relative">
                      <Input
                        id="legislation"
                        placeholder="Search or select legislation"
                        value={legislationSearchQuery}
                        onChange={(e) => handleInputChange("legislationId", e.target.value)}
                        disabled={isFromRetainership} // Disable field if accessed from retainership
                        required
                      />

                      {showLegislationSuggestions && legislationSearchQuery.trim() && filteredLegislations.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                          {filteredLegislations.map((legislation) => (
                            <div
                              key={legislation.id}
                              className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, legislationId: legislation.id }));
                                setLegislationSearchQuery(legislation.title);
                                setShowLegislationSuggestions(false);
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <div>
                                  <span className="font-medium">{legislation.title}</span>
                                  {legislation.description && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      {legislation.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {showLegislationSuggestions && legislationSearchQuery && filteredLegislations.length === 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-3">
                          <span className="text-gray-500">No legislations found</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          }

          {/* Submit Buttons */}
          <div className="flex justify-end gap-4">
            <Button
              className="bg-[#f42b03] hover:bg-[#f42b03] shadow-none hover:shadow-lg transition-shadow duration-300 text-white hover:text-white cursor-pointer"
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => router.push("/task")}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="cursor-pointer shadow-none hover:shadow-lg transition-shadow duration-300"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditMode ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>
                  {isEditMode ? "Update Task" : "Create Task"}
                </>
              )}
            </Button>
          </div>
        </fieldset >
      </form >
    </div >
  );
}
