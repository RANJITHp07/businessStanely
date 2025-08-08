"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Checkbox } from "@/components/ui/checkbox";
import {
  FileText,
  Calendar,
  Clock,
  MessageSquare,
  Play,
  AlertTriangle,
  CheckCircle,
  Send,
  Paperclip,
  Plus,
  User,
  Building2,
  Phone,
  Mail,
  Timer,
} from "lucide-react";
import { format } from "date-fns";

// Task interface based on the API response
interface Task {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  progress: number;
  createdAt: string;
  dueDate: string;
  updatedAt: string;
  followUpRequired: boolean;
  completed: boolean;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  };
  client: {
    id: string;
    clientType: string;
    firstName?: string;
    lastName?: string;
    organizationName?: string;
    email: string;
    phoneNumber: string;
    authorizedPersonName?: string;
  };
  category?: {
    id: string;
    name: string;
    description: string;
  };
  comments: Comment[];
  timeLogs?: {
    id: string;
    date: string;
    hours: number;
    description: string;
    createdAt: string;
    agent: {
      id: string;
      name: string;
    };
  }[];
}

interface Comment {
  id: string;
  authorType: string;
  content: string;
  createdAt: string;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentType?: string;
  attachmentUrl?: string;
  user?: {
    id: string;
    username: string;
  };
  agent?: {
    id: string;
    name: string;
  };
}

interface TimeLogData {
  id: string;
  date: string;
  hours: number;
  description: string;
  createdAt: string;
  agent: {
    id: string;
    name: string;
  };
}

export default function TaskDetails() {
  const params = useParams();
  const taskId = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Time log states
  const [timeLogsData, setTimeLogsData] = useState<TimeLogData[]>([]);
  const [totalTimeLogged, setTotalTimeLogged] = useState(0);
  // Helper to get current date in IST (yyyy-MM-dd)
  const getCurrentISTDate = () => {
    const now = new Date();
    // Convert to IST
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const ist = new Date(utc + 5.5 * 60 * 60000);
    // Format as yyyy-MM-dd for input value
    return ist.toISOString().slice(0, 10);
  };
  const [timeLogDate, setTimeLogDate] = useState(getCurrentISTDate());
  const [timeLogHours, setTimeLogHours] = useState("");
  const [timeLogDescription, setTimeLogDescription] = useState("");
  const [submittingTimeLog, setSubmittingTimeLog] = useState(false);

  useEffect(() => {
    const fetchTaskDetails = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/tasks/${taskId}`);

        if (!response.ok) {
          throw new Error("Failed to fetch task details");
        }

        const data = await response.json();
        setTask(data.task);

        // Set time logs if available from task data
        if (data.task.timeLogs) {
          setTimeLogsData(data.task.timeLogs);
          const total = data.task.timeLogs.reduce(
            (sum: number, log: TimeLogData) => sum + log.hours,
            0
          );
          setTotalTimeLogged(total);
        }
      } catch (error) {
        console.error("Error fetching task:", error);
        setError("Failed to load task details");
      } finally {
        setLoading(false);
      }
    };

    const fetchTimeLogs = async () => {
      try {
        const response = await fetch(`/api/timelog?taskId=${taskId}`);
        if (response.ok) {
          const data = await response.json();
          setTimeLogsData(data.timeLogs);
          setTotalTimeLogged(data.totalHours);
        }
      } catch (error) {
        console.error("Error fetching time logs:", error);
      }
    };

    fetchTaskDetails();
    fetchTimeLogs();
  }, [taskId]);

  const fetchTimeLogs = async () => {
    try {
      const response = await fetch(`/api/timelog?taskId=${taskId}`);
      if (response.ok) {
        const data = await response.json();
        setTimeLogsData(data.timeLogs);
        setTotalTimeLogged(data.totalHours);
      }
    } catch (error) {
      console.error("Error fetching time logs:", error);
    }
  };

  // Helper functions
  const calculateDaysRemaining = () => {
    if (!task?.dueDate) return 0;
    const dueDate = new Date(task.dueDate);
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysRemaining = calculateDaysRemaining();
  const commentsData = task?.comments || [];

  const getPriorityBadge = (priority: string) => {
    const colors = {
      low: "bg-green-100 text-green-800 border-green-200",
      medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
      high: "bg-red-100 text-red-800 border-red-200",
    };
    return (
      <Badge className={`${colors[priority as keyof typeof colors]} border`}>
        <AlertTriangle className="w-3 h-3 mr-1" />
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
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

  const formatDateTime = (dateString: string | undefined) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !task) return;
    setSubmittingComment(true);

    try {
      let attachmentData = {};

      // Handle file upload if a file is selected
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

      const response = await fetch(`/api/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: task.id,
          content: newComment,
          ...attachmentData,
        }),
      });

      if (response.ok) {
        const newCommentData = await response.json();
        setTask((prevTask) =>
          prevTask
            ? {
                ...prevTask,
                comments: [newCommentData, ...(prevTask.comments || [])],
              }
            : prevTask
        );
        setNewComment("");
        setSelectedFile(null);
      } else {
        const errorData = await response.json();
        console.error("Failed to add comment:", errorData);
      }
    } catch (error) {
      console.error("Error adding comment:", error);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Optimistic UI update for status
  const handleStatusChange = async (newStatus: string) => {
    if (!task) return;
    const prevTask = { ...task };
    // If status is Completed, set progress to 100%
    const isCompleted = newStatus === "Completed";
    setTask({
      ...task,
      status: newStatus,
      completed: isCompleted,
      progress: isCompleted ? 100 : task.progress,
    });
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
          completed: isCompleted,
          progress: isCompleted ? 100 : task.progress,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setTask(data.task);
      } else {
        setTask(prevTask); // revert
        console.error("Failed to update task status");
      }
    } catch (error) {
      setTask(prevTask); // revert
      console.error("Error updating task status:", error);
    }
  };

  // Debounce utility
  function debounce<A>(func: (arg: A) => void, wait: number) {
    let timeout: ReturnType<typeof setTimeout>;
    return (arg: A) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(arg), wait);
    };
  }

  // Optimistic UI update for progress with debounce
  const handleProgressChange = (newProgress: number) => {
    if (!task) return;
    const prevTask = { ...task };
    setTask({ ...task, progress: newProgress });
    debouncedUpdateProgress({ newProgress, prevTask });
  };

  // Use a single argument object for debounce compatibility
  const updateProgress = async ({
    newProgress,
    prevTask,
  }: {
    newProgress: number;
    prevTask: typeof task;
  }) => {
    if (!task) return;
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          progress: newProgress,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setTask(data.task);
      } else {
        setTask(prevTask); // revert
        console.error("Failed to update task progress");
      }
    } catch (error) {
      setTask(prevTask); // revert
      console.error("Error updating task progress:", error);
    }
  };

  // Debounced version to avoid excessive API calls
  const debouncedUpdateProgress = debounce(updateProgress, 500);

  const handleFollowUpChange = async (checked: boolean) => {
    if (!task) return;

    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          followUpRequired: checked,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTask(data.task);
      } else {
        console.error("Failed to update follow-up status");
      }
    } catch (error) {
      console.error("Error updating follow-up status:", error);
    }
  };

  const handleCompletedChange = async (checked: boolean) => {
    if (!task) return;
    const prevTask = { ...task };
    // If checked, set status to Completed and progress to 100%
    const isCompleted = checked;
    setTask({
      ...task,
      completed: isCompleted,
      status: isCompleted ? "Completed" : "In Progress",
      progress: isCompleted ? 100 : task.progress,
    });
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          completed: isCompleted,
          status: isCompleted ? "Completed" : "In Progress",
          progress: isCompleted ? 100 : task.progress,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTask(data.task);
      } else {
        setTask(prevTask); // revert
        console.error("Failed to update task completion status");
      }
    } catch (error) {
      setTask(prevTask); // revert
      console.error("Error updating task completion status:", error);
    }
  };

  // Helper to format date in IST as 'do MMMM yyyy' (e.g., '9th July 2025') for display
  const formatDateISTDisplay = (dateString: string) => {
    // Accepts yyyy-MM-dd or ISO string
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const istDate = new Date(utc + 5.5 * 60 * 60000);
    return format(istDate, "do MMMM yyyy");
  };

  const handleAddTimeLog = async () => {
    if (!task || !timeLogDate || !timeLogHours || !timeLogDescription) return;
    // Send date as yyyy-MM-dd (for backend), display as human readable
    const backendDate = timeLogDate; // yyyy-MM-dd

    setSubmittingTimeLog(true);
    try {
      const response = await fetch("/api/timelog", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: task.id,
          date: backendDate, // yyyy-MM-dd for backend
          hours: parseFloat(timeLogHours),
          description: timeLogDescription,
        }),
      });
      if (response.ok) {
        await fetchTimeLogs();
        setTimeLogDate(getCurrentISTDate());
        setTimeLogHours("");
        setTimeLogDescription("");
      } else {
        let errorData = null;
        try {
          errorData = await response.json();
        } catch {
          // Not JSON, ignore
        }
        if (errorData && Object.keys(errorData).length > 0) {
          console.error("Failed to add time log:", errorData);
        } else {
          console.error(
            "Failed to add time log: HTTP",
            response.status,
            response.statusText
          );
        }
      }
    } catch (error) {
      console.error("Error adding time log:", error);
    } finally {
      setSubmittingTimeLog(false);
    }
  };

  const handleDeleteTimeLog = async (timeLogId: string) => {
    if (!confirm("Are you sure you want to delete this time log entry?"))
      return;

    try {
      const response = await fetch(`/api/timelog/${timeLogId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Refresh time logs data
        await fetchTimeLogs();
      } else {
        const errorData = await response.json();
        console.error("Failed to delete time log:", errorData);
      }
    } catch (error) {
      console.error("Error deleting time log:", error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Skeleton className="h-10 w-1/2 mb-6" />
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-6 w-1/3 mb-2" />
            <Skeleton className="h-4 w-full mb-4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">{error || "Task not found"}</p>
          </CardContent>
        </Card>
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
        </div>

        {/* Task Summary Card */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-3 mb-2">
                    <h2 className="text-[18px] md:text-2xl font-bold">
                      {task.title}
                    </h2>
                    {getStatusBadge(task.status)}
                  </div>
                  <p className="text-[16px] md:[18px] text-muted-foreground mb-4">
                    {task.description}
                  </p>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">
                    Due in {daysRemaining} days
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Timer className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">
                    {totalTimeLogged}h logged
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">
                    Assigned to {task.assignedTo?.name || "Unassigned"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">
                    {task.progress}% complete
                  </span>
                </div>
              </div>

              {/* Follow-up and Status Checkboxes */}
              <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 p-0 md:p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="follow-up"
                    checked={task.followUpRequired}
                    onCheckedChange={handleFollowUpChange}
                  />
                  <Label
                    htmlFor="follow-up"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Follow-up Required
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="check-status"
                    checked={task.completed}
                    onCheckedChange={handleCompletedChange}
                  />
                  <Label
                    htmlFor="check-status"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Status Check Completed
                  </Label>
                </div>
                <div className="text-xs text-muted-foreground md:ml-auto">
                  Last updated: {formatDateTime(task.updatedAt)}
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
            <p className="text-[12px] md:text-[14px]">Task Details</p>
          </TabsTrigger>
          <TabsTrigger value="comments" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 hidden md:block" />
            <p className="text-[12px] md:text-[14px]">
              Comments ({commentsData.length})
            </p>
          </TabsTrigger>
          <TabsTrigger value="timelog" className="flex items-center gap-2">
            <Clock className="h-4 w-4 hidden md:block" />
            <p className="text-[12px] md:text-[14px]">
              Time Log ({timeLogsData.length})
            </p>
          </TabsTrigger>
        </TabsList>

        {/* Task Details Tab */}
        <TabsContent value="details" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Task Management */}
              <Card>
                <CardHeader>
                  <CardTitle>Task Management</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Status and Progress */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={task.status}
                        onValueChange={handleStatusChange}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="To Do">To Do</SelectItem>
                          <SelectItem value="In Progress">
                            In Progress
                          </SelectItem>
                          <SelectItem value="Hold">Hold</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="progress">
                        Progress ({task.progress}%)
                      </Label>
                      <div className="space-y-2">
                        <Progress value={task.progress} className="w-full" />
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={task.progress}
                          onChange={(e) =>
                            handleProgressChange(
                              Number.parseInt(e.target.value) || 0
                            )
                          }
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Assignment */}
                  <div className="space-y-2">
                    <Label>Assigned To</Label>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {task.assignedTo?.name
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("") || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">
                        {task.assignedTo?.name || "Unassigned"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

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
                      <p className="font-medium">{task.title}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Priority
                      </Label>
                      <div className="mt-1">
                        {getPriorityBadge(task.priority)}
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Description
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {task.description}
                    </p>
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
                        {task.client.clientType === "individual"
                          ? `${task.client.firstName} ${task.client.lastName}`
                          : task.client.organizationName}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Client Type
                      </Label>
                      <div className="flex items-center gap-2">
                        {task.client.clientType === "organization" ? (
                          <Building2 className="h-4 w-4 text-gray-500" />
                        ) : (
                          <User className="h-4 w-4 text-gray-500" />
                        )}
                        <span className="text-sm capitalize">
                          {task.client.clientType}
                        </span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Contact Person
                      </Label>
                      <p className="font-medium">
                        {task.client.authorizedPersonName}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Phone
                      </Label>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-500" />
                        <a
                          href={`tel:${task.client.phoneNumber}`}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          {task.client.phoneNumber}
                        </a>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Email
                    </Label>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <a
                        href={`mailto:${task.client.email}`}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        {task.client.email}
                      </a>
                    </div>
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
                        {task.progress}%
                      </span>
                    </div>
                    <Progress value={task.progress} className="h-3" />
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
                        {formatDateTime(task.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Due Date</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDateTime(task.dueDate)}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                      Days Remaining
                    </span>
                    <Badge
                      variant={daysRemaining < 7 ? "destructive" : "secondary"}
                    >
                      {daysRemaining} days
                    </Badge>
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
              <CardTitle>Task Comments</CardTitle>
              <CardDescription>
                Communication and updates related to this task
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add Comment */}
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">A</AvatarFallback>
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
                {commentsData.length === 0 ? (
                  <p className="text-muted-foreground">No comments yet.</p>
                ) : (
                  <div className="space-y-4">
                    {commentsData.map((comment) => (
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
                              {formatDateTime(comment.createdAt)}
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
                                      href={comment.attachmentUrl}
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
                <span>Time Log (Total: {totalTimeLogged}h)</span>
              </CardTitle>
              <CardDescription>Track time spent on this task.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add Time Log */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Log New Time Entry
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    type="date"
                    value={timeLogDate}
                    onChange={(e) => setTimeLogDate(e.target.value)}
                    placeholder="Date"
                    max={getCurrentISTDate()}
                  />
                  <Input
                    type="number"
                    step="0.5"
                    value={timeLogHours}
                    onChange={(e) => setTimeLogHours(e.target.value)}
                    placeholder="Hours"
                  />
                </div>
                <Textarea
                  value={timeLogDescription}
                  onChange={(e) => setTimeLogDescription(e.target.value)}
                  placeholder="Description"
                />
                <Button
                  onClick={handleAddTimeLog}
                  disabled={
                    !timeLogDate ||
                    !timeLogHours ||
                    !timeLogDescription ||
                    submittingTimeLog
                  }
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {submittingTimeLog ? "Adding..." : "Log Time"}
                </Button>
              </div>

              <Separator />

              {/* Time Logs List */}
              <div className="space-y-3">
                {timeLogsData.length === 0 ? (
                  <p className="text-muted-foreground">
                    No time log entries yet.
                  </p>
                ) : (
                  timeLogsData.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          {log.description}
                        </div>
                        <div className="text-xs text-gray-500">
                          By {log.agent.name} on{" "}
                          {formatDateISTDisplay(log.date)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{log.hours}h</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteTimeLog(log.id)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
