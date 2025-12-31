"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Edit,
  FileText,
  Calendar,
  Clock,
  MessageSquare,
  Play,
  AlertTriangle,
  CheckCircle,
  Send,
  Paperclip,
} from "lucide-react";
import { format } from "date-fns";
import { Task, Agent, Comment, TimeLog } from "@/types";
import { useParams } from "next/navigation";
import Image from "next/image";
import { Input } from "@/components/ui/input";

export default function TaskDetails() {
  const [isReassiging, setIsReassigning] = useState(false)
  const [taskData, setTaskData] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("comments");
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    id: string;
  } | null>(null);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [totalHours, setTotalHours] = useState<number>(0);
  const [timeLogsLoading, setTimeLogsLoading] = useState(true);
  const [agentSearchQuery, setAgentSearchQuery] = useState("");
  const [showAgentSuggestions, setShowAgentSuggestions] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  // const [isFromRetainership, setIsFromRetainership] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const filteredAgents = agents.filter((agent) => {
    return (
      agent.name.toLowerCase().includes(agentSearchQuery.toLowerCase()) ||
      agent.agentType.toLowerCase().includes(agentSearchQuery.toLowerCase())
    );
  });
  // Load user data on mount
  useEffect(() => {
    const loadUserData = () => {
      // Check for both "user" and "agent" keys to support both admin and agent logins
      const userStr =
        localStorage.getItem("user") || localStorage.getItem("agent");
      if (userStr) {
        try {
          const userData = JSON.parse(userStr);
          console.log("Loaded user/agent data:", userData);
          setCurrentUser(userData);
        } catch (err) {
          console.error("Error parsing user/agent data:", err);
          // Clear corrupted data
          localStorage.removeItem("user");
          localStorage.removeItem("agent");
        }
      } else {
        console.warn("No user or agent data found in localStorage");
      }
    };

    loadUserData();

    // Listen for storage changes (in case user logs in/out in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "user" || e.key === "agent") {
        loadUserData();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);
  const params = useParams();
  const { id } = params;

  useEffect(() => {
    const fetchTask = async () => {
      if (id) {
        try {
          const response = await fetch(`/api/tasks/${id}`);
          if (response.ok) {
            const data = await response.json();
            setTaskData(data.task);
            if (data.task && data.task.comments) {
              setComments(data.task.comments);
              setCommentsLoading(false);
            }
          } else {
            console.error("Failed to fetch task");
          }
        } catch (error) {
          console.error("Error fetching task:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    const fetchTimeLogs = async () => {
      if (id) {
        setTimeLogsLoading(true);
        try {
          const response = await fetch(`/api/timelog?taskId=${id}`, {
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            setTimeLogs(data.timeLogs || []);
            setTotalHours(data.totalHours || 0);
          } else {
            setTimeLogs([]);
            setTotalHours(0);
          }
        } catch {
          setTimeLogs([]);
          setTotalHours(0);
        } finally {
          setTimeLogsLoading(false);
        }
      }
    };

    fetchTask();
    fetchTimeLogs();
  }, [id]);

  // Fetch agents
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await fetch("/api/agents");
        if (response.ok) {
          const data = await response.json();
          setAgents(data);
        }
      } catch (error) {
        console.error("Error fetching agents:", error);
      }
    };

    fetchAgents();
  }, []);

  // Set initial agent values when task data loads
  useEffect(() => {
    if (taskData?.assignedTo) {
      setAgentSearchQuery(taskData.assignedTo.name);
      setSelectedAgentId(taskData.assignedTo.id);
    }
  }, [taskData?.assignedTo]);

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: "bg-green-100 text-green-800 border-green-200",
      medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
      high: "bg-red-100 text-red-800 border-red-200",
    };

    return (
      <Badge className={`${colors[priority as keyof typeof colors]} border`}>
        <AlertTriangle className="w-3 h-3 mr-1" />
        {typeof priority === "string" && priority.length > 0
          ? priority.charAt(0).toUpperCase() + priority.slice(1)
          : "Unknown"}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      "To Do": "bg-gray-100 text-gray-800 border-gray-200",
      "In Progress": "bg-blue-100 text-blue-800 border-blue-200",
      Hold: "bg-orange-100 text-orange-800 border-orange-200",
      Completed: "bg-green-100 text-green-800 border-green-200",
      Overdue: "bg-red-100 text-red-800 border-red-200",
    };

    const icons = {
      "To Do": <Clock className="w-3 h-3 mr-1" />,
      "In Progress": <Play className="w-3 h-3 mr-1" />,
      Hold: <AlertTriangle className="w-3 h-3 mr-1" />,
      Completed: <CheckCircle className="w-3 h-3 mr-1" />,
      Overdue: <AlertTriangle className="w-3 h-3 mr-1" />,
    };

    return (
      <Badge className={`${colors[status as keyof typeof colors]} border`}>
        {icons[status as keyof typeof icons]}
        {status}
      </Badge>
    );
  };

  const calculateCompletionRate = () => {
    if (!taskData) return 0;

    // If task has explicit progress field, use it
    if (taskData.progress !== undefined && taskData.progress !== null) {
      return Math.min(Math.max(taskData.progress, 0), 100);
    }

    // Calculate based on status and checkboxes
    const statusProgress = {
      "To Do": 0,
      "In Progress": 30,
      Hold: 50,
      Completed: 100,
      Overdue: 0,
    };

    let baseProgress =
      statusProgress[taskData.status as keyof typeof statusProgress] || 0;

    // Add progress for completed checkboxes
    if (taskData.followUpRequired) baseProgress += 10;
    if (taskData.completed) baseProgress += 15;

    return Math.min(baseProgress, 100);
  };

  // Parse dd/mm/yyyy HH:mm:ss or ISO string
  const parseDateString = (dateString: string) => {
    if (!dateString) return null;
    // If ISO, just use Date
    if (/\d{4}-\d{2}-\d{2}/.test(dateString)) return new Date(dateString);
    // If dd/mm/yyyy
    const match = dateString.match(
      /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/
    );
    if (match) {
      const [, dd, mm, yyyy, hh = "00", min = "00", ss = "00"] = match;
      // Swap dd and mm if month > 12 (to handle user error), but default is dd/mm/yyyy
      return new Date(
        Number(yyyy),
        Number(mm) - 1,
        Number(dd),
        Number(hh),
        Number(min),
        Number(ss)
      );
    }
    // fallback
    return new Date(dateString);
  };

  // Format date and time in IST
  const formatDateTime = (
    dateString: string | undefined,
    showTime: boolean = false
  ) => {
    if (!dateString) return "N/A";
    const parsed = parseDateString(dateString);
    if (!parsed || isNaN(parsed.getTime())) return dateString;
    // Convert to IST
    const utc = parsed.getTime() + parsed.getTimezoneOffset() * 60000;
    const istDate = new Date(utc + 5.5 * 60 * 60000);
    if (showTime) {
      return format(istDate, "do MMMM yyyy, hh:mm a");
    }
    return format(istDate, "do MMMM yyyy");
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !taskData) return;

    setSubmittingComment(true);
    try {
      // Debug: Log current user state
      console.log("Current user state:", currentUser);

      // Get fresh user data from localStorage if currentUser is not set
      let userId = currentUser?.id;

      if (!userId) {
        // Check for both "user" and "agent" keys to support both admin and agent logins
        const userStr =
          localStorage.getItem("user") || localStorage.getItem("agent");
        console.log("Raw user/agent string from localStorage:", userStr);
        if (userStr) {
          try {
            const userData = JSON.parse(userStr);
            console.log("Parsed user/agent data:", userData);
            userId = userData.id;
            console.log("Retrieved user ID from localStorage:", userId);
          } catch (err) {
            console.error("Error parsing user/agent data:", err);
            throw new Error("Failed to get user information");
          }
        }
      }

      console.log("Final userId to use:", userId);

      if (!userId) {
        console.error(
          "No user ID found - checking localStorage keys:",
          Object.keys(localStorage)
        );
        throw new Error("User not logged in");
      }

      let attachmentData = {};

      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);

        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          attachmentData = {
            attachmentName: uploadResult.originalName,
            attachmentSize: uploadResult.size,
            attachmentType: uploadResult.type,
            attachmentUrl: uploadResult.url,
          };
        } else {
          console.error("Failed to upload file");
          setSubmittingComment(false);
          return;
        }
      }

      try {
        const response = await fetch("/api/comments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: newComment,
            taskId: id,
            authorId: userId,
            ...attachmentData,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to add comment");
        }

        const newCommentData = await response.json();
        setComments((prev) => [newCommentData, ...prev]);
        setNewComment("");
        setSelectedFile(null);
      } catch (error) {
        console.error(
          "Failed to add comment:",
          error instanceof Error ? error.message : "Unknown error"
        );
        // You might want to show an error message to the user here
        // For example, using a toast notification
      }
    } catch (error) {
      console.error(
        "Error in comment submission:",
        error instanceof Error ? error.message : "Unknown error"
      );
      // Handle file upload or other errors
    } finally {
      setSubmittingComment(false);
    }
  };

  const calculateRemainingDays = (dueDate: string | null | undefined): number => {
    if (!dueDate) return 0;
    const dueDateObj = new Date(dueDate);
    if (isNaN(dueDateObj.getTime())) return 0; // Handle invalid dates
    const today = new Date();
    const diffTime = dueDateObj.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleReassign = async (agentId: string) => {
    if (!id) return;

    try {
      setIsReassigning(true)
      const response = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignedToId: agentId,
        }),
      });

      if (response.ok) {
        // Refetch the task to get updated data with relations
        const taskResponse = await fetch(`/api/tasks/${id}`);
        if (taskResponse.ok) {
          const data = await taskResponse.json();
          setTaskData(data.task);
        }
        // Update the search query to show the selected agent's name
        const selectedAgent = agents.find(a => a.id === agentId);
        if (selectedAgent) {
          setAgentSearchQuery(selectedAgent.name);
        }
        setShowAgentSuggestions(false);
      } else {
        console.error("Failed to reassign task");
      }
    } catch (error) {
    } finally {
      setIsReassigning(false)
    }
  };

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
            <Skeleton className="h-10 w-32 mt-[20px] md:mt-0" />
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
        {/* Tabs Skeleton */}
        <Skeleton className="h-10 w-full mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!taskData) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Skeleton className="h-10 w-1/2 mb-6" />
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-6 w-1/3 mb-2" />
            <Skeleton className="h-4 w-full mb-4" />
          </CardContent>
        </Card>
        <p className="text-center text-muted-foreground mt-8">
          Task not found.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-4">
          <div>
            <h1 className="text-[28px] md:text-3xl font-bold">Task Details</h1>
            <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
              Comprehensive view of task progress and activity
            </p>
          </div>
          <div className="flex justify-end">
            <Button className="mt-[20px] md:mt-0 w-fit f bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300">
              <a href={`/task/${id}/edit`} className="flex items-center gap-1">
                <Edit className="h-4 w-4" />
                Edit Task
              </a>
            </Button>
          </div>
        </div>

        {/* Task Summary Card */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex flex-col  md:flex-row  items-start md:items-center gap-3 mb-2">
                    <h2
                      className="text-[18px] md:text-2xl font-bold truncate"
                      style={{ maxWidth: '350px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={taskData.title}
                    >
                      {taskData.title}
                    </h2>
                    {getStatusBadge(taskData.status)}
                  </div>
                  <p className=" text-[16px] md:[18px] text-muted-foreground mb-2">
                    {taskData.description}
                  </p>
                </div>
              </div>

              {/* Quick Stats Row (like agent app) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">
                    Due in {calculateRemainingDays(taskData?.dueDate)} days
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">
                    {totalHours}h logged
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="inline-flex"><Avatar className="h-4 w-4"><AvatarFallback className="text-xs">{taskData.assignedTo?.name?.split(" ").map((n) => n[0]).join("") || "U"}</AvatarFallback></Avatar></span>
                  <span className="text-gray-600">
                    Ownership to {taskData.assignedTo?.name || "Unassigned"}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">
                    {calculateCompletionRate()}% complete
                  </span>
                </div>
              </div>

              {/* Follow-up and Status Check Dropdowns (read-only) */}
              <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 p-0 md:p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="follow-up-duration" className="text-sm font-medium cursor-pointer">
                    Follow-up Required
                  </Label>
                  <select
                    id="follow-up-duration"
                    className="w-28 px-2 py-1 border rounded bg-gray-100 text-gray-700 cursor-not-allowed"
                    value={taskData.followUpDuration || "None"}
                    disabled
                  >
                    <option value="None">None</option>
                    <option value="24hr">24 Hours</option>
                    <option value="48hr">48 Hours</option>
                    <option value="1w">1 Week</option>
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="status-check-duration" className="text-sm font-medium cursor-pointer">
                    Status Check
                  </Label>
                  <select
                    id="status-check-duration"
                    className="w-28 px-2 py-1 border rounded bg-gray-100 text-gray-700 cursor-not-allowed"
                    value={taskData.statusCheckDuration || "None"}
                    disabled
                  >
                    <option value="None">None</option>
                    <option value="24hr">24 Hours</option>
                    <option value="48hr">48 Hours</option>
                    <option value="1w">1 Week</option>
                  </select>
                </div>
                <div className="text-xs text-muted-foreground md:ml-auto">
                  Last updated: {formatDateTime(taskData.updatedAt, true)}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assigned-agent">Assign Task To *</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
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
                    // disabled={isFromRetainership} // Disable if form is from retainership
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
                                setSelectedAgentId(agent.id);
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
                  <Button
                    type="button"
                    onClick={() => {
                      if (selectedAgentId) {
                        handleReassign(selectedAgentId);
                      }
                    }}
                    // disabled={!selectedAgentId || isFromRetainership}
                    disabled={!selectedAgentId || isReassiging}
                    className="px-4"
                  >
                    {isReassiging ? "Reassigning" : "Reassign"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="details" className="flex items-center gap-2">
            <FileText className="h-4 w-4 hidden md:block" />
            <p className="text-[12px] md:text-[14px]"> Task Details </p>
          </TabsTrigger>
          <TabsTrigger value="comments" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 hidden md:block" />
            <p className="text-[12px] md:text-[14px]">
              {" "}
              Interactions ({comments.length}){" "}
            </p>
          </TabsTrigger>
          <TabsTrigger value="timelog" className="flex items-center gap-2">
            <Clock className="h-4 w-4 hidden md:block" />
            <p className="text-[12px] md:text-[14px]">
              {" "}
              Time Log ({timeLogs.length}){" "}
            </p>
          </TabsTrigger>
        </TabsList>

        {/* Task Details Tab */}
        <TabsContent value="details" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Task Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Task Name
                      </Label>
                      <p
                        className="font-medium truncate"
                        style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={taskData.title}
                      >
                        {taskData.title}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Priority
                      </Label>
                      <div className="mt-1">
                        {getPriorityBadge(taskData.priority)}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Service
                      </Label>
                      <div className="mt-1">
                        {taskData.category ? (
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200 border">
                            {taskData.category.name}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            No category assigned
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Status
                      </Label>
                      <div className="mt-1">
                        {getStatusBadge(taskData.status)}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Description
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {taskData.description}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Legislation Name
                      </Label>
                      <p className="font-medium">
                        {taskData.legislation?.title || "N/A"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Client Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Client Name
                      </Label>
                      <p className="font-medium">
                        {taskData.client
                          ? taskData.client.clientType === "individual"
                            ? `${taskData.client.firstName} ${taskData.client.lastName}`
                            : taskData.client.organizationName
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Client Type
                      </Label>
                      <p className="font-medium">
                        {taskData.client?.clientType}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Contact Person
                      </Label>
                      <p className="font-medium">
                        {taskData.client?.authorizedPersonName}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Phone
                      </Label>
                      <p className="font-medium">
                        {taskData.client?.phoneNumber}
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Email
                    </Label>
                    <p className="font-medium">{taskData.client?.email}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Legislation Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Legislation Name
                    </Label>
                    <p className="font-medium">
                      {taskData.legislation?.title || "N/A"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Legislation Description
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {taskData.legislation?.description || "N/A"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Progress Tracking</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Completion</span>
                      <span className="text-sm font-bold">
                        {calculateCompletionRate()}%
                      </span>
                    </div>
                    <Progress
                      value={calculateCompletionRate()}
                      className="h-3"
                    />
                  </div>

                  {/* Progress Breakdown */}
                  <div className="space-y-3 mt-4 pt-4 border-t">
                    <div className="text-sm font-medium text-muted-foreground mb-2">
                      Progress Breakdown
                    </div>

                    <div className="space-y-2">
                      {/* Task Status Progress */}
                      <div className="flex justify-between items-center text-xs">
                        <span className="flex items-center gap-2">
                          {taskData.status === "Completed" ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : taskData.status === "In Progress" ? (
                            <Play className="h-3 w-3 text-blue-600" />
                          ) : taskData.status === "Hold" ? (
                            <AlertTriangle className="h-3 w-3 text-orange-600" />
                          ) : (
                            <Clock className="h-3 w-3 text-gray-600" />
                          )}
                          Task Status: {taskData.status}
                        </span>
                        <span className="font-medium">
                          {(() => {
                            const statusProgress = {
                              "To Do": 0,
                              "In Progress": 30,
                              Hold: 50,
                              Completed: 100,
                              Overdue: 0,
                            };
                            return `${statusProgress[
                              taskData.status as keyof typeof statusProgress
                            ] || 0
                              }%`;
                          })()}
                        </span>
                      </div>
                      {/* Follow-up Required Progress */}
                      <div className="flex justify-between items-center text-xs">
                        <span className="flex items-center gap-2">
                          {taskData.followUpRequired ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <Clock className="h-3 w-3 text-gray-400" />
                          )}
                          Follow-up Required
                        </span>
                        <span
                          className={`font-medium ${taskData.followUpRequired
                            ? "text-green-600"
                            : "text-gray-400"
                            }`}
                        >
                          {taskData.followUpRequired ? `+10%` : `0%`}
                        </span>
                      </div>
                      {/* Status Check Completed Progress */}
                      <div className="flex justify-between items-center text-xs">
                        <span className="flex items-center gap-2">
                          {taskData.completed ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <Clock className="h-3 w-3 text-gray-400" />
                          )}
                          Status Check
                        </span>
                        <span
                          className={`font-medium ${taskData.completed
                            ? "text-green-600"
                            : "text-gray-400"
                            }`}
                        >
                          {taskData.completed ? `+15%` : `0%`}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Created</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDateTime(taskData.createdAt, true)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Due Date</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDateTime(taskData.dueDate, true)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Task Interactions</CardTitle>
              <CardDescription>
                Communication and updates related to this task
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add Comment */}
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {(() => {
                        const userStr = localStorage.getItem("user");
                        if (!userStr) return "U";
                        try {
                          const user = JSON.parse(userStr);
                          return user?.username?.[0]?.toUpperCase() || "U";
                        } catch {
                          return "U";
                        }
                      })()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <Textarea
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={3}
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          id="file-upload"
                          className="hidden"
                          onChange={handleFileSelect}
                          accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            document.getElementById("file-upload")?.click()
                          }
                        >
                          <Paperclip className="h-4 w-4 mr-2" />
                          Attach File
                        </Button>
                        {selectedFile && (
                          <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                            {selectedFile.name}
                            <button
                              onClick={() => setSelectedFile(null)}
                              className="ml-2 text-red-500 hover:text-red-700"
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        onClick={handleAddComment}
                        disabled={!newComment.trim() || submittingComment}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {submittingComment ? "Adding..." : "Add Comment"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Comments List */}
              <div className="space-y-4">
                {commentsLoading ? (
                  <p className="text-muted-foreground">Loading interactions...</p>
                ) : comments.length === 0 ? (
                  <p className="text-muted-foreground">No interactions yet.</p>
                ) : (
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {comment.authorType === "USER"
                              ? comment.user?.username
                                ?.charAt(0)
                                .toUpperCase() || "U"
                              : comment.agent?.name
                                ?.split(" ")
                                .map((n) => n[0])
                                .join("") || "A"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {comment.authorType === "USER"
                                ? comment.user?.username
                                : comment.agent?.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(comment.createdAt, true)}
                            </span>
                          </div>
                          <p className="text-sm">{comment.content}</p>
                          {comment.attachmentName && (
                            <div className="mt-2">
                              {/* Check if attachment is an image */}
                              {comment.attachmentType?.startsWith("image/") &&
                                comment.attachmentUrl ? (
                                <div className="space-y-2">
                                  {/* Image preview */}
                                  <div className="relative inline-block">
                                    {/* Use regular img for local URLs, Image for external URLs */}
                                    {comment.attachmentUrl.startsWith(
                                      "http"
                                    ) ? (
                                      <Image
                                        src={comment.attachmentUrl}
                                        alt={comment.attachmentName}
                                        width={300}
                                        height={200}
                                        className="max-w-xs max-h-48 rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition-shadow object-cover"
                                        onClick={() =>
                                          window.open(
                                            comment.attachmentUrl,
                                            "_blank"
                                          )
                                        }
                                      />
                                    ) : (
                                      <Image
                                        src={
                                          comment.attachmentUrl?.startsWith("/")
                                            ? comment.attachmentUrl
                                            : `/${comment.attachmentUrl}`
                                        }
                                        alt={comment.attachmentName}
                                        width={300}
                                        height={200}
                                        className="max-w-xs max-h-48 rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition-shadow object-cover"
                                        onClick={() =>
                                          window.open(
                                            comment.attachmentUrl?.startsWith(
                                              "/"
                                            )
                                              ? comment.attachmentUrl
                                              : `/${comment.attachmentUrl}`,
                                            "_blank"
                                          )
                                        }
                                        unoptimized={true}
                                      />
                                    )}
                                  </div>
                                  {/* Image file info */}
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-2 rounded border">
                                    <Paperclip className="h-3 w-3" />
                                    <span className="font-medium">
                                      {comment.attachmentName}
                                    </span>
                                    <span>
                                      (
                                      {(comment.attachmentSize! / 1024).toFixed(
                                        1
                                      )}{" "}
                                      KB)
                                    </span>
                                    <a
                                      href={
                                        comment.attachmentUrl?.startsWith("/")
                                          ? comment.attachmentUrl
                                          : `/${comment.attachmentUrl}`
                                      }
                                      className="text-blue-600 hover:text-blue-800 underline ml-auto"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      Download
                                    </a>
                                  </div>
                                </div>
                              ) : (
                                /* Non-image file attachment */
                                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-2 rounded border">
                                  <Paperclip className="h-3 w-3" />
                                  <span className="font-medium">
                                    {comment.attachmentName}
                                  </span>
                                  <span>
                                    (
                                    {(comment.attachmentSize! / 1024).toFixed(
                                      1
                                    )}{" "}
                                    KB)
                                  </span>
                                  {comment.attachmentUrl && (
                                    <a
                                      href={
                                        comment.attachmentUrl?.startsWith("/")
                                          ? comment.attachmentUrl
                                          : `/${comment.attachmentUrl}`
                                      }
                                      className="text-blue-600 hover:text-blue-800 underline ml-auto"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      Download
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Time Log Tab */}
        <TabsContent value="timelog" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Time Log</span>
                <span className="text-xs text-muted-foreground">
                  Total Hours: {totalHours}
                </span>
              </CardTitle>
              <CardDescription>Track time spent on this task.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {timeLogsLoading ? (
                  <p className="text-muted-foreground">Loading time logs...</p>
                ) : timeLogs.length === 0 ? (
                  <p className="text-muted-foreground">
                    No time log entries yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {timeLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg border"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {log.agent?.name
                              ?.split(" ")
                              .map((n: string) => n[0])
                              .join("") || "A"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {log.agent?.name || "Unknown Agent"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {(() => {
                                const parsedCreated = parseDateString(
                                  log.createdAt
                                );
                                if (
                                  parsedCreated &&
                                  !isNaN(parsedCreated.getTime())
                                ) {
                                  // Convert UTC to IST
                                  const utc =
                                    parsedCreated.getTime() +
                                    parsedCreated.getTimezoneOffset() * 60000;
                                  const istDate = new Date(
                                    utc + 5.5 * 60 * 60000
                                  );
                                  const datePart = format(
                                    istDate,
                                    "dd, MMM, yyyy"
                                  );
                                  const timePart = format(istDate, "hh:mm a");
                                  return `${datePart} at ${timePart}`;
                                }
                                return "N/A";
                              })()}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {log.description}
                          </div>
                        </div>
                        <div className="font-bold text-blue-700">
                          {log.hours}h
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
