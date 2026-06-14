"use client"
import { useState } from "react"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation";


import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import {
  FileText,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertCircle,
  Calendar,
  X,
} from "lucide-react"
import Link from "next/link"

import { Task } from "@/types"
import { useEffect } from "react"
import { useSearchParams } from "next/navigation"

const priorities = ["All Priorities", "Low", "Medium", "High"]
const statuses = ["All Status", "To Do", "In Progress", "Hold", "Completed", "Abandoned"]
const durations = ["24hr", "48hr", "1w"]

export default function TasksTable() {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  // Multi-select priorities (empty = all priorities)
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([])
  // Multi-select statuses: empty = all statuses
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  // Multi-select follow up durations
  const [selectedFollowUpDurations, setSelectedFollowUpDurations] = useState<string[]>([])
  // Multi-select status check durations
  const [selectedStatusCheckDurations, setSelectedStatusCheckDurations] = useState<string[]>([])
  const [clientUpdateFilter, setClientUpdateFilter] = useState<"all" | "updated" | "not-updated">("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)

  const router = useRouter();
  const searchParams = useSearchParams();

  // Update URL when filters change
  const updateUrlFilters = (
    priorities: string[],
    statuses: string[],
    followUpDurations: string[],
    search: string,
    statusCheckDuration: string[],
    clientUpdate: "all" | "updated" | "not-updated" = clientUpdateFilter,
  ) => {
    const params = new URLSearchParams();
    const assignedToId = searchParams.get("assignedToId");
    const retainershipTasks = searchParams.get("retainershipTasks");
    const retainershipId = searchParams.get("retainershipId");
    const trigger = searchParams.get("trigger");
    if (assignedToId) params.set("assignedToId", assignedToId);
    if (retainershipTasks) params.set("retainershipTasks", retainershipTasks);
    if (retainershipId) params.set("retainershipId", retainershipId);
    if (trigger) params.set("trigger", trigger);
    if (search) params.set("search", search);
    if (priorities.length > 0) params.set("priorities", priorities.join(","));
    if (statuses.length > 0) params.set("statuses", statuses.join(","));
    if (followUpDurations.length > 0) params.set("followUpDurations", followUpDurations.join(","));
    if (statusCheckDuration.length > 0) params.set("statusCheckDuration", statusCheckDuration.join(","));
    if (clientUpdate !== "all") params.set("clientUpdate", clientUpdate);
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
  };

  // Load filters from URL on mount and when searchParams change
  useEffect(() => {
    try {
      const urlSearch = searchParams?.get("search");
      const urlPriorities = searchParams?.get("priorities");
      const urlStatuses = searchParams?.get("statuses");
      const urlStatus = searchParams?.get("status");
      const urlFollowUpDurations = searchParams?.get("followUpDurations");
      const urlStatusCheckDurations = searchParams?.get("statusCheckDuration");
      const urlClientUpdate = searchParams?.get("clientUpdate");
      if (urlSearch) setSearchTerm(urlSearch);
      if (urlPriorities) setSelectedPriorities(urlPriorities.split(","));
      if (urlStatuses) setSelectedStatuses(urlStatuses.split(","));
      else if (urlStatus) setSelectedStatuses([urlStatus]);
      if (urlFollowUpDurations) setSelectedFollowUpDurations(urlFollowUpDurations.split(","));
      if (urlStatusCheckDurations) setSelectedStatusCheckDurations(urlStatusCheckDurations.split(","));
      if (urlClientUpdate === "updated" || urlClientUpdate === "not-updated") {
        setClientUpdateFilter(urlClientUpdate);
      } else {
        setClientUpdateFilter("all");
      }
    } catch {
      // ignore
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        // Get assignedToId, status, or statuses from URL
        const assignedToId = searchParams.get("assignedToId");
        const status = searchParams.get("status");
        const statuses = searchParams.get("statuses");
        const statusCheckDuration = searchParams.get("statusCheckDuration");
        const retainershipTasks = searchParams.get("retainershipTasks");
        const retainershipId = searchParams.get("retainershipId");
        const trigger = searchParams.get("trigger");
        const clientUpdate = searchParams.get("clientUpdate");
        let url = "/api/tasks";
        const params = [];
        if (assignedToId) params.push(`assignedToId=${encodeURIComponent(assignedToId)}`);
        if (status) params.push(`status=${encodeURIComponent(status)}`);
        if (statuses) params.push(`statuses=${encodeURIComponent(statuses)}`);
        if (statusCheckDuration) params.push(`statusCheckDuration=${encodeURIComponent(statusCheckDuration)}`);
        if (retainershipTasks) params.push(`retainershipTasks=${encodeURIComponent(retainershipTasks)}`);
        if (retainershipId) params.push(`retainershipId=${encodeURIComponent(retainershipId)}`);
        if (trigger) params.push(`trigger=${encodeURIComponent(trigger)}`);
        if (clientUpdate) params.push(`clientUpdate=${encodeURIComponent(clientUpdate)}`);
        if (params.length > 0) url += `?${params.join("&")}`;
        const response = await fetchWithAuth(url);
        if (response.ok) {
          const data = await response.json();
          setTasks(data.tasks || data);
        } else {
          console.error("Failed to fetch tasks");
          setTasks([]);
        }
      } catch (error) {
        console.error("Error fetching tasks:", error);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, [searchParams]);

  const handleDelete = async () => {
    if (!taskToDelete) return

    try {
      const response = await fetchWithAuth(`/api/tasks/${taskToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTasks((tasks || []).filter((task) => task.id !== taskToDelete.id));
        setTaskToDelete(null);
      } else {
        console.error("Failed to delete task");
      }
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  }

  // Sort function
  // const sortTasks = (tasks: Task[]) => {
  //   return [...tasks].sort((a, b) => {
  //     return a.title.localeCompare(b.title) // Default A-Z sorting
  //   })
  // }

  // Filter tasks based on search and filters only (backend already filters approved tasks)
  const filteredTasks = (tasks || []).filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.client && (task.client.clientType === 'individual' ? `${task.client.firstName} ${task.client.lastName}` : task.client.organizationName)?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (task.assignedTo && task.assignedTo.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesPriority = selectedPriorities.length === 0 || selectedPriorities.map((p) => p.toLowerCase()).includes((task.priority || "").toLowerCase());
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(task.status);
    const matchesFollowUp = selectedFollowUpDurations.length === 0 || (task.followUpDuration && selectedFollowUpDurations.includes(task.followUpDuration));
    const matchesStatusCheck = selectedStatusCheckDurations.length === 0 || (task.statusCheckDuration && selectedStatusCheckDurations.includes(task.statusCheckDuration));

    return matchesSearch && matchesPriority && matchesStatus && matchesFollowUp && matchesStatusCheck;
  });

  // Apply sorting to filtered tasks
  const sortedTasks = filteredTasks

  // Pagination logic
  const totalPages = Math.ceil(sortedTasks.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentTasks = sortedTasks.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number.parseInt(value))
    setCurrentPage(1)
  }

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: "bg-green-100 text-green-800 border-green-200",
      medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
      high: "bg-red-100 text-red-800 border-red-200",
    }

    const icons = {
      low: <AlertCircle className="w-3 h-3 mr-1" />,
      medium: <AlertCircle className="w-3 h-3 mr-1" />,
      high: <AlertCircle className="w-3 h-3 mr-1" />,
    }

    return (
      <Badge className={`${colors[priority as keyof typeof colors]} border`}>
        {icons[priority as keyof typeof icons]}
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
    )
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  // const resetFilter = () => {
  //   setSearchTerm("");
  // setSelectedPriorities([])
  //   setSelectedStatuses([])
  // }

  const isOverdue = (dueDate: string | undefined, status: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date() && status !== "Completed"
  }

  // if (loading) {
  //     return <p>Loading...</p>;
  // }

  // Multi-select status helpers
  // const statusOptions = statuses.filter((s) => s !== "All Status")
  // const toggleStatus = (status: string) => {
  //   setSelectedStatuses((prev) =>
  //     prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
  //   )
  // }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <div className="flex  flex-col md:flex-row  justify-between md:items-center  mb-6 md:mb-4">
          <div>
            <h1 className="text-3xl font-bold">Task Management</h1>
            <p className="text-muted-foreground mt-2">Manage and track all legal tasks and assignments</p>
          </div>
          <Link href="/task/create" className="flex justify-end">
            <Button className=" mt-[20px] md:mt-none   bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300">
              <Plus className="h-4 w-4" />
              Create Task
            </Button>
          </Link>
        </div>

        {/* Filters */}
        {/* <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Filter className="h-5 w-5" />
                            Filters & Search
                        </CardTitle>
                        <CardDescription>Filter and search through your tasks</CardDescription>
                    </CardHeader> */}

        <Card>
          {loading ? (
            <CardContent>
              <div className="h-[200px] w-full bg-gray-200 rounded-2xl mb-4"></div>

              <div className="flex justify-between gap-4">
                <div className="h-5 w-1/2 bg-gray-200 rounded-xl mb-3"></div>
                <div className="h-5 w-1/2 bg-gray-200 rounded-xl mb-3"></div>
              </div>

            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filters & Search
                </CardTitle>
                <CardDescription>Filter and search through your tasks</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Search */}
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label htmlFor="search">Search Tasks</Label>
                    <div className="relative my-2">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="search"
                        placeholder="Search by task name, client, agent, or description..."
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          updateUrlFilters(selectedPriorities, selectedStatuses, selectedFollowUpDurations, e.target.value, selectedStatusCheckDurations);
                        }}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                {/* Filter Controls */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          {selectedPriorities.length ? `${selectedPriorities.length} selected` : "All Priorities"}
                          <Filter className="ml-2 h-4 w-4 opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56">
                        <DropdownMenuLabel>Filter by priority</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem
                          checked={selectedPriorities.length === 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedPriorities([]);
                            }
                          }}
                        >
                          All Priorities
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuSeparator />
                        {priorities
                          .filter((p) => p !== "All Priorities")
                          .map((priority) => (
                            <DropdownMenuCheckboxItem
                              key={priority}
                              checked={selectedPriorities.includes(priority)}
                              onCheckedChange={() => {
                                const newPriorities = selectedPriorities.includes(priority)
                                  ? selectedPriorities.filter((p) => p !== priority)
                                  : [...selectedPriorities, priority];
                                setSelectedPriorities(newPriorities);
                                updateUrlFilters(newPriorities, selectedStatuses, selectedFollowUpDurations, searchTerm, selectedStatusCheckDurations);
                              }}
                            >
                              {priority}
                            </DropdownMenuCheckboxItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {selectedPriorities.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2 justify-end">
                        {selectedPriorities.map((priority) => (
                          <Badge key={priority} variant="secondary" className="px-2 py-1">
                            <span>{priority}</span>
                            <button
                              type="button"
                              aria-label={`Remove ${priority}`}
                              className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-muted/70"
                              onClick={() => {
                                const newPriorities = selectedPriorities.filter((p) => p !== priority);
                                setSelectedPriorities(newPriorities);
                                updateUrlFilters(newPriorities, selectedStatuses, selectedFollowUpDurations, searchTerm, selectedStatusCheckDurations);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          {selectedStatuses.length ? `${selectedStatuses.length} selected` : "All Status"}
                          <Filter className="ml-2 h-4 w-4 opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56">
                        <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem
                          checked={selectedStatuses.length === 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedStatuses([]);
                            }
                          }}
                        >
                          All Status
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuSeparator />
                        {statuses.filter((s) => s !== "All Status").map((status) => (
                          <DropdownMenuCheckboxItem
                            key={status}
                            checked={selectedStatuses.includes(status)}
                            onCheckedChange={() => {
                              const newStatuses = selectedStatuses.includes(status)
                                ? selectedStatuses.filter((s) => s !== status)
                                : [...selectedStatuses, status];
                              setSelectedStatuses(newStatuses);
                              updateUrlFilters(selectedPriorities, newStatuses, selectedFollowUpDurations, searchTerm, selectedStatusCheckDurations);
                            }}
                          >
                            {status}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {selectedStatuses.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2 justify-end">
                        {selectedStatuses.map((status) => (
                          <Badge key={status} variant="secondary" className="px-2 py-1">
                            <span>{status}</span>
                            <button
                              type="button"
                              aria-label={`Remove ${status}`}
                              className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-muted/70"
                              onClick={() => {
                                let newStatuses = selectedStatuses.filter((s) => s !== status);

                                setSelectedStatuses(newStatuses);

                                updateUrlFilters(
                                  selectedPriorities,
                                  newStatuses,
                                  selectedFollowUpDurations,
                                  searchTerm,
                                  selectedStatusCheckDurations
                                );
                              }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Follow Up Duration</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          {selectedFollowUpDurations.length ? `${selectedFollowUpDurations.length} selected` : "All Durations"}
                          <Filter className="ml-2 h-4 w-4 opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56">
                        <DropdownMenuLabel>Filter by follow up duration</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem
                          checked={selectedFollowUpDurations.length === 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedFollowUpDurations([]);
                            }
                          }}
                        >
                          All Durations
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuSeparator />
                        {durations.map((duration) => (
                          <DropdownMenuCheckboxItem
                            key={duration}
                            checked={selectedFollowUpDurations.includes(duration)}
                            onCheckedChange={() => {
                              const newDurations = selectedFollowUpDurations.includes(duration)
                                ? selectedFollowUpDurations.filter((d) => d !== duration)
                                : [...selectedFollowUpDurations, duration];
                              setSelectedFollowUpDurations(newDurations);
                              updateUrlFilters(selectedPriorities, selectedStatuses, newDurations, searchTerm, selectedStatusCheckDurations);
                            }}
                          >
                            {duration}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {selectedFollowUpDurations.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2 justify-end">
                        {selectedFollowUpDurations.map((duration) => (
                          <Badge key={duration} variant="secondary" className="px-2 py-1">
                            <span>{duration}</span>
                            <button
                              type="button"
                              aria-label={`Remove ${duration}`}
                              className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-muted/70"
                              onClick={() => {
                                const newDurations = selectedFollowUpDurations.filter((d) => d !== duration);
                                setSelectedFollowUpDurations(newDurations);
                                updateUrlFilters(selectedPriorities, selectedStatuses, newDurations, searchTerm, selectedStatusCheckDurations);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* <div className="space-y-2">
                    <Label>Status Check Duration</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          {selectedStatusCheckDurations.length ? `${selectedStatusCheckDurations.length} selected` : "All Durations"}
                          <Filter className="ml-2 h-4 w-4 opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56">
                        <DropdownMenuLabel>Filter by status check duration</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem
                          checked={selectedStatusCheckDurations.length === 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedStatusCheckDurations([]);
                            }
                          }}
                        >
                          All Durations
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuSeparator />
                        {durations.map((duration) => (
                          <DropdownMenuCheckboxItem
                            key={duration}
                            checked={selectedStatusCheckDurations.includes(duration)}
                            onCheckedChange={() => {
                              const newDurations = selectedStatusCheckDurations.includes(duration)
                                ? selectedStatusCheckDurations.filter((d) => d !== duration)
                                : [...selectedStatusCheckDurations, duration];
                              setSelectedStatusCheckDurations(newDurations);
                              updateUrlFilters(selectedPriorities, selectedStatuses, selectedFollowUpDurations, searchTerm, newDurations);
                            }}
                          >
                            {duration}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {selectedStatusCheckDurations.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2 justify-end">
                        {selectedStatusCheckDurations.map((duration) => (
                          <Badge key={duration} variant="secondary" className="px-2 py-1">
                            <span>{duration}</span>
                            <button
                              type="button"
                              aria-label={`Remove ${duration}`}
                              className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-muted/70"
                              onClick={() => {
                                const newDurations = selectedStatusCheckDurations.filter((d) => d !== duration);
                                setSelectedStatusCheckDurations(newDurations);
                                updateUrlFilters(selectedPriorities, selectedStatuses, selectedFollowUpDurations, searchTerm, newDurations);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div> */}

                  <div className="space-y-2">
                    <Label>Client Update</Label>
                    <Select
                      value={clientUpdateFilter}
                      onValueChange={(value: "all" | "updated" | "not-updated") => {
                        setClientUpdateFilter(value);
                        updateUrlFilters(
                          selectedPriorities,
                          selectedStatuses,
                          selectedFollowUpDurations,
                          searchTerm,
                          selectedStatusCheckDurations,
                          value,
                        );
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="updated">Updated Client</SelectItem>
                        <SelectItem value="not-updated">Not Updated Client</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Results Summary */}
                <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                  <Button
                    onClick={() => {
                      setSearchTerm("");
                      setSelectedPriorities([]);
                      setSelectedStatuses([]);
                      setSelectedFollowUpDurations([]);
                      setSelectedStatusCheckDurations([]);
                      setClientUpdateFilter("all");
                      updateUrlFilters([], [], [], "", []);
                    }}
                    className="cursor-pointer hover:text-white text-white bg-[#f42b03] hover:bg-[#f42b03] rounded-lg px-4 py-2 shadow-none hover:shadow-lg transition-shadow duration-300"
                    variant="outline"
                  >
                    Clear
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>



      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Tasks ({sortedTasks.length})
            </CardTitle>
            {/* <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a-z">A-Z</SelectItem>
                  <SelectItem value="z-a">Z-A</SelectItem>
                </SelectContent>
              </Select>
              <Select  >
                <SelectTrigger className="w-28">
                  <SelectValue className="text-black" placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <Select defaultValue="newest">
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                </SelectContent>
              </Select>
            </div> */}
          </div>
        </CardHeader>


        {loading ? (<div className="flex justify-center items-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
        ) : (
          <>
            <CardContent>
              <div className="rounded-md border">
                <Table className="table-fixed min-w-[900px]">
                  <colgroup>
                    {/* Task */}
                    <col className="w-[200px]" />
                    {/* Client */}
                    <col className="w-[140px]" />
                    {/* Ownership to */}
                    <col className="w-[140px]" />
                    {/* Priority */}
                    <col className="w-[100px]" />
                    {/* Due Date */}
                    <col className="w-[120px]" />
                    {/* Last Completion Date */}
                    <col className="w-[150px]" />
                    {/* Progress */}
                    <col className="w-[100px]" />
                    {/* Actions */}
                    <col className="w-[70px]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Ownership to</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Last Completion</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>


                  <TableBody>
                    {currentTasks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No tasks found matching your criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      currentTasks.map((task) => {
                        const clientName = task.client
                          ? (task.client.clientType === "individual"
                            ? `${task.client.firstName} ${task.client.lastName}`
                            : (task.client.organizationName ?? "N/A"))
                          : "N/A";
                        const clientEmail = task.client?.email ?? "";
                        const owner =
                          task.ownerShipBy?.status?.toLowerCase() === "inactive"
                            ? task.assignedTo
                            : task.ownerShipBy ?? task.assignedTo;
                        const ownerName = owner?.name ?? "";
                        const ownerType = owner?.agentType ?? "";
                        return (
                          <TableRow
                            key={task.id}
                            onClick={() => router.push(`/task/${task.id}`)}
                            className={`cursor-pointer hover:bg-muted/50 ${isOverdue(task.dueDate, task.status) ? "bg-red-50" :
                              task.followUpDuration && task.followUpDuration !== 'None' ? "bg-blue-50" :
                                task.statusCheckDuration && task.statusCheckDuration !== 'None' ? "bg-green-50" : ""
                              }`}
                          >
                            <TableCell className="overflow-hidden">
                              <div className="space-y-1">
                                <div className="font-medium truncate" title={task.title}>{task.title}</div>
                                {/* Show approved category only */}
                                {task.category && task.category.status === 'approved' && (
                                  <div className="text-xs mt-1">
                                    <span className="inline-block px-2 py-1 rounded bg-blue-100 text-blue-800 border border-blue-200">
                                      {task.category.name}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="overflow-hidden">
                              <div className="space-y-1">
                                <div className="font-medium truncate" title={clientName === "N/A" ? undefined : clientName}>
                                  {clientName}
                                </div>
                                <div className="text-sm text-muted-foreground truncate" title={clientEmail}>{clientEmail}</div>
                              </div>
                            </TableCell>
                            <TableCell className="overflow-hidden">
                              <div className="flex items-center space-x-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="text-xs">
                                    {owner?.name
                                      .toUpperCase()
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium text-sm truncate" title={ownerName || undefined}>{ownerName}</div>
                                  <div className="text-xs text-muted-foreground truncate" title={ownerType || undefined}>{ownerType}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className={isOverdue(task.dueDate, task.status) ? "text-red-600 font-medium" : ""}>
                                  {task.dueDate ? formatDate(task.dueDate) : "N/A"}
                                </span>
                              </div>
                              {task.dueDate && isOverdue(task.dueDate, task.status) && (
                                <Badge variant="destructive" className="text-xs mt-1">
                                  Overdue
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span>
                                  {task.lastCompletedDate ? formatDate(task.lastCompletedDate) : "N/A"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">{task.status}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell
                              className="text-right overflow-visible"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuItem asChild>
                                    <Link href={`/task/${task.id}`}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      View Details
                                    </Link>
                                  </DropdownMenuItem>
                                  {
                                    task.active &&
                                    <>
                                      <DropdownMenuItem asChild>
                                        <Link href={`/task/${task.id}/edit`}>
                                          <Edit className="mr-2 h-4 w-4" />
                                          Edit Task
                                        </Link>
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => setTaskToDelete(task)}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete Task
                                      </DropdownMenuItem>
                                    </>
                                  }

                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>



                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between space-x-2 py-4">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 10, 20, 50].map((value) => (
                          <SelectItem key={value} value={value.toString()}>
                            {value} / page
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => handlePageChange(1)} disabled={currentPage === 1}>
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {/* Page Numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNumber = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
                      if (pageNumber <= totalPages) {
                        return (
                          <Button
                            key={pageNumber}
                            variant={currentPage === pageNumber ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(pageNumber)}
                          >
                            {pageNumber}
                          </Button>
                        )
                      }
                      return null
                    })}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </>)}




      </Card>
      <AlertDialog open={!!taskToDelete} onOpenChange={() => setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the task and remove its data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div >
  )
}
