"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Checkbox } from "@/components/ui/checkbox";
import { uploadFileToS3Direct } from "@/lib/directUpload";

export default function TaskDetails() {
  const MANAGEMENT_BASE_URL = "https://management.legalstanley.com";

  const getAttachmentUrl = (url?: string) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${MANAGEMENT_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`;
  };

  const [isReassigning, setIsReassigning] = useState(false);
  const [isTransferringOwnership, setIsTransferringOwnership] = useState(false);
  const [taskData, setTaskData] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("comments");
  const [newComment, setNewComment] = useState("");
  const [isClientUpdateInteraction, setIsClientUpdateInteraction] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    id: string;
  } | null>(null);
  const [commentDate, setCommentDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [totalHours, setTotalHours] = useState<number>(0);
  const [timeLogsLoading, setTimeLogsLoading] = useState(true);
  const [agentSearchQuery, setAgentSearchQuery] = useState("");
  const [agentOwnershipQuery, setAgentOwnershipQuery] = useState("");
  const [showAgentSuggestions, setShowAgentSuggestions] = useState(false);
  const [showOwnershipSuggestions, setShowOwnershipSuggestions] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedOwnershipAgentId, setSelectedOwnershipAgentId] = useState<string | null>(null);
  const [duration, setDuration] = useState(2);
  const [progressInput, setProgressInput] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // const [isFromRetainership, setIsFromRetainership] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);

  const filteredAgents = useMemo(() => {
    if (!Array.isArray(agents)) return [];
    return agents.filter((agent) => {
      return (
        agent.name.toLowerCase().includes(agentSearchQuery.toLowerCase()) ||
        agent.agentType.toLowerCase().includes(agentSearchQuery.toLowerCase())
      );
    });
  }, [agents, agentSearchQuery]);

  const filteredOwnershipAgents = useMemo(() => {
    if (!Array.isArray(agents)) return [];
    return agents.filter((agent) => {
      return (
        agent.name.toLowerCase().includes(agentOwnershipQuery.toLowerCase()) ||
        agent.agentType.toLowerCase().includes(agentOwnershipQuery.toLowerCase())
      );
    });
  }, [agents, agentOwnershipQuery]);
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
    if (!taskData) return;

    if (taskData?.assignedTo) {
      setAgentSearchQuery(taskData.assignedTo.name);
      setSelectedAgentId(taskData.assignedTo.id);
    }

    const rawOwnershipAgent = (taskData as Task & { ownerShipBy?: Agent }).ownerShipBy;
    const ownershipAgent =
      rawOwnershipAgent?.status?.toLowerCase() === "inactive"
        ? taskData.assignedTo
        : rawOwnershipAgent;
    if (ownershipAgent) {
      setAgentOwnershipQuery(ownershipAgent.name);
      setSelectedOwnershipAgentId(ownershipAgent.id);
    }
  }, [taskData]);

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
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files]);
      setUploadPercent(0);
      setUploadMessage("");
      setUploadError(null);
    }
    event.target.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Helper function to convert 24-hour format to 12-hour AM/PM format
  const get12HourFormat = (hour24: string): string => {
    const h = parseInt(hour24, 10);
    if (h === 0) return "12 AM";
    if (h < 12) return `${h} AM`;
    if (h === 12) return "12 PM";
    return `${h - 12} PM`;
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !commentDate || !startTime || !endTime) {
      alert("Please fill in all required fields (comment, date, start time, and end time)");
      return;
    }
    if (!taskData) return;

    setSubmittingComment(true);
    setUploadError(null);
    try {
      // Debug: Log current user state
      console.log("Current user state:", currentUser);

      // Get fresh user data from localStorage if currentUser is not set
      let userId = currentUser?.id;

      if (!userId) {
        // Check for both "user" and "agent" keys to support both admin and agent logins
        const userStr =
          localStorage.getItem("user") || localStorage.getItem("agent");
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

      let attachmentData: { attachments?: { name: string; url: string; size: number; type: string }[] } = {};

      if (selectedFiles.length > 0) {
        const uploaded: { name: string; url: string; size: number; type: string }[] = [];
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          try {
            const uploadResult = await uploadFileToS3Direct(file, {
              onProgress: (progress) => {
                setUploadPercent(progress.percent);
                setUploadMessage(`Uploading ${i + 1}/${selectedFiles.length}: ${progress.message}`);
              },
            });
            uploaded.push({
              name: uploadResult.originalName,
              size: uploadResult.size,
              type: uploadResult.type,
              url: uploadResult.url,
            });
          } catch (error) {
            console.error("Failed to upload file", error);
            setUploadError(
              error instanceof Error ? error.message : "Upload failed. Please retry.",
            );
            setSubmittingComment(false);
            return;
          }
        }
        attachmentData = { attachments: uploaded };
      }

      try {
        // Combine date and time values
        const startDateTime = new Date(commentDate);
        const [startHour, startMinute] = startTime.split(":").map(Number);
        startDateTime.setHours(startHour, startMinute, 0);

        const endDateTime = new Date(commentDate);
        const [endHour, endMinute] = endTime.split(":").map(Number);
        endDateTime.setHours(endHour, endMinute, 0);

        const response = await fetch("/api/comments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: `${isClientUpdateInteraction ? "[CLIENT_UPDATE]" : "[NORMAL]"} ${newComment.trim()}`,
            taskId: id,
            authorId: userId,
            interactionType: isClientUpdateInteraction ? "CLIENT_UPDATE" : "NORMAL",
            commentDate: commentDate.toISOString(),
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
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
        setSelectedFiles([]);
        setUploadPercent(0);
        setUploadMessage("");
        setUploadError(null);
        setCommentDate(new Date()); // Reset to current date
        setStartTime("");
        setEndTime("");
        setDuration(2);
        setIsClientUpdateInteraction(false);

        if (
          isClientUpdateInteraction &&
          taskData.statusCheckDuration &&
          taskData.statusCheckDuration !== "Working"
        ) {
          await fetch(`/api/tasks/${id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ statusCheckDuration: "Working" }),
          });

          setTaskData((prev) =>
            prev ? { ...prev, statusCheckDuration: "Working" } : prev,
          );
        }

        // Update task status from "To Do" to "In Progress" if needed
        if (taskData.status === "To Do") {
          setTaskData((prev) => prev ? { ...prev, status: "In Progress" } : null);
        }
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
      setIsReassigning(true);
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
        const selectedAgent = agents.find((a) => a.id === agentId);
        if (selectedAgent) {
          setAgentSearchQuery(selectedAgent.name);
        }
        setShowAgentSuggestions(false);
      } else {
        console.error("Failed to reassign task");
      }
    } catch (error) {
      console.error("Error reassigning task:", error);
    } finally {
      setIsReassigning(false);
    }
  };

  const handleTransferOwnership = async (agentId: string) => {
    if (!id) return;

    try {
      setIsTransferringOwnership(true);
      const response = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ownerShipById: agentId,
        }),
      });

      if (response.ok) {
        const taskResponse = await fetch(`/api/tasks/${id}`);
        if (taskResponse.ok) {
          const data = await taskResponse.json();
          setTaskData(data.task);
        }

        const selectedAgent = agents.find((a) => a.id === agentId);
        if (selectedAgent) {
          setAgentOwnershipQuery(selectedAgent.name);
          setSelectedOwnershipAgentId(selectedAgent.id);
        }
        setShowOwnershipSuggestions(false);
      } else {
        console.error("Failed to transfer ownership");
      }
    } catch (error) {
      console.error("Error transferring ownership:", error);
    } finally {
      setIsTransferringOwnership(false);
    }
  };

  // Dropdown options for durations
  const durationOptions = [
    { value: "Working", label: "Working" },
    { value: "24hr", label: "24 Hours" },
    { value: "48hr", label: "48 Hours" },
    { value: "1w", label: "1 Week" },
  ];

  const handleStatusChange = async (newStatus: string) => {
    if (!taskData) return;
    const prevTask = { ...taskData };
    const restoredProgress = newStatus === "Completed" ? 100 : (newStatus === "In Progress" ? 30 : 0);

    setTaskData({
      ...taskData,
      status: newStatus,
      progress: restoredProgress,
    });
    setProgressInput(restoredProgress > 0 ? String(restoredProgress) : "");

    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
          progress: restoredProgress,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTaskData((prevTaskState) => ({
          ...prevTaskState!,
          ...data.task,
          comments: prevTaskState!.comments,
        }));
      } else {
        setTaskData(prevTask);
        console.error("Failed to update task status");
      }
    } catch (error) {
      setTaskData(prevTask);
      console.error("Error updating task status:", error);
    }
  };

  const handleFollowUpDurationChange = async (value: string) => {
    if (!taskData) return;
    const prevTask = { ...taskData };
    setTaskData({ ...taskData, followUpDuration: value });
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followUpDuration: value }),
      });
      if (response.ok) {
        const data = await response.json();
        setTaskData(prevTaskState => ({
          ...prevTaskState!,
          ...data.task,
          comments: prevTaskState!.comments,
        }));
      } else {
        setTaskData(prevTask);
        console.error("Failed to update follow-up duration");
      }
    } catch (error) {
      setTaskData(prevTask);
      console.error("Error updating follow-up duration:", error);
    }
  };

  const handleStatusCheckDurationChange = async (value: string) => {
    if (!taskData) return;
    const prevTask = { ...taskData };
    setTaskData({ ...taskData, statusCheckDuration: value });
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusCheckDuration: value }),
      });
      if (response.ok) {
        const data = await response.json();
        setTaskData(prevTaskState => ({
          ...prevTaskState!,
          ...data.task,
          comments: prevTaskState!.comments,
        }));
      } else {
        setTaskData(prevTask);
        console.error("Failed to update status check duration");
      }
    } catch (error) {
      setTaskData(prevTask);
      console.error("Error updating status check duration:", error);
    }
  };

  const getNowTime = () => {
    const d = new Date()
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  }

  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number)
    return h * 60 + m
  }

  const addMinutes = (time: string, mins: number) => {
    const [h, m] = time.split(":").map(Number)
    const d = new Date()
    d.setHours(h, m + mins)
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  }

  const getInteractionType = (content?: string) => {
    if (content?.startsWith("[CLIENT_UPDATE]")) return "CLIENT_UPDATE";
    return "NORMAL";
  };

  const getDisplayInteractionContent = (content?: string) => {
    if (!content) return "";
    return content.replace(/^\[(CLIENT_UPDATE|NORMAL)\]\s*/, "");
  };

  const isAudioAttachment = (attachment: { name?: string; url?: string; type?: string }) =>
    Boolean(
      attachment.type?.startsWith("audio/") ||
        /\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(
          attachment.name || attachment.url || "",
        ),
    );

  useEffect(() => {
    if (startTime && duration > 0) {
      setEndTime(addMinutes(startTime, duration));
      return;
    }
    setEndTime("");
  }, [startTime, duration]);


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

  const displayOwnershipAgent =
    taskData.ownerShipBy?.status?.toLowerCase() === "inactive"
      ? taskData.assignedTo
      : taskData.ownerShipBy ?? taskData.assignedTo;

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
          {taskData.active && < div className="flex justify-end">
            <Button className="mt-[20px] md:mt-0 w-fit f bg-[#003459] hover:bg-[#003459] text-white rounded-lg px-4 py-2 flex items-center gap-2 cursor-pointer shadow-none hover:shadow-md transition-shadow duration-300">
              <a href={`/task/${id}/edit`} className="flex items-center gap-1">
                <Edit className="h-4 w-4" />
                Edit Task
              </a>
            </Button>
          </div>}
        </div>

        {/* Task Summary Card */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex flex-col  md:flex-row  items-start md:items-center gap-3 mb-2">
                    <h2
                      className="text-[18px] md:text-2xl font-bold break-words"
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
                  <span className="inline-flex"><Avatar className="h-4 w-4"><AvatarFallback className="text-xs">{displayOwnershipAgent?.name?.split(" ").map((n) => n[0]).join("") || "U"}</AvatarFallback></Avatar></span>
                  <span className="text-gray-600">
                    Ownership to {displayOwnershipAgent?.name || "Unassigned"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="inline-flex"><Avatar className="h-4 w-4"><AvatarFallback className="text-xs">{taskData.assignedTo?.name?.split(" ").map((n) => n[0]).join("") || "U"}</AvatarFallback></Avatar></span>
                  <span className="text-gray-600">
                    Asssigned to {taskData.assignedTo?.name || "Unassigned"}
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
              <div className="flex gap-2">
                <div className="space-y-2 w-1/4">
                  <Label htmlFor="follow-up-duration" className="text-sm font-medium cursor-pointer">
                    StatusCheck & Followup
                  </Label>
                  <Select
                    value={taskData.followUpDuration || "Working"}
                    onValueChange={handleFollowUpDurationChange}
                  >
                    <SelectTrigger id="follow-up-duration" className="w-full">
                      <SelectValue placeholder="Working" />
                    </SelectTrigger>
                    <SelectContent>
                      {durationOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 w-1/4">
                  <Label htmlFor="status-check-duration" className="text-sm font-medium cursor-pointer">
                    Client update
                  </Label>
                  <Select
                    value={taskData.statusCheckDuration || "Working"}
                    onValueChange={handleStatusCheckDurationChange}
                  >
                    <SelectTrigger id="status-check-duration" className="w-full">
                      <SelectValue placeholder="Working" />
                    </SelectTrigger>
                    <SelectContent>
                      {durationOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 items-center">
                <div className="space-y-2 w-1/2">
                  <Label htmlFor="assigned-agent">Transfer Ownership  To *</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="assigned-agent"
                        type="text"
                        placeholder="Type to search agents..."
                        value={agentOwnershipQuery}
                        onChange={(e) => {
                          setAgentOwnershipQuery(e.target.value);
                          if (e.target.value.trim()) {
                            setShowOwnershipSuggestions(true);
                          } else {
                            setShowOwnershipSuggestions(false);
                          }
                        }}
                        onFocus={() => {
                          if (agentOwnershipQuery.trim()) {
                            setShowOwnershipSuggestions(true);
                          }
                        }}
                        className="w-full"
                      // disabled={isFromRetainership} // Disable if form is from retainership
                      />

                      {showOwnershipSuggestions &&
                        agentOwnershipQuery.trim() &&
                        filteredOwnershipAgents.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                            {filteredOwnershipAgents.map((agent) => (
                              <div
                                key={agent.id}
                                className="flex items-center gap-2 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                onClick={() => {
                                  const agentName =
                                    agent.name.charAt(0).toUpperCase() +
                                    agent.name.slice(1);
                                  setAgentOwnershipQuery(agentName);
                                  setSelectedOwnershipAgentId(agent.id);
                                  setShowOwnershipSuggestions(false);
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

                      {showOwnershipSuggestions &&
                        agentOwnershipQuery.trim() &&
                        filteredOwnershipAgents.length === 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-3">
                            <span className="text-gray-500">No agents found</span>
                          </div>
                        )}
                    </div>
                    <Button
                      type="button"
                      onClick={() => {
                        if (selectedOwnershipAgentId) {
                          handleTransferOwnership(selectedOwnershipAgentId);
                        }
                      }}
                      // disabled={!selectedAgentId || isFromRetainership}
                      disabled={!selectedOwnershipAgentId || isTransferringOwnership}
                      className="px-4"
                    >
                      {isTransferringOwnership ? "Transferring Ownership" : "Transfer Ownership"}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 w-1/2">
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
                      disabled={!selectedAgentId || isReassigning}
                      className="px-4"
                    >
                      {isReassigning ? "Reassigning" : "Reassign"}
                    </Button>
                  </div>
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
                  <CardTitle>Task Management</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Status and Progress */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={taskData.status}
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
                        Progress ({taskData.progress}%)
                      </Label>
                      <div className="space-y-2">
                        <Progress value={taskData.progress} className="w-full" />
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min="0"
                          max="100"
                          value={progressInput}
                          placeholder=""
                          onChange={(e) => {
                            const val = e.target.value;
                            if (/^\d{0,3}$/.test(val) && parseInt(val) <= 100) {
                              setProgressInput(val);
                              setTaskData({
                                ...taskData,
                                progress: parseInt(val) || 0,
                              });
                            }
                          }}
                          className="w-full"
                        />
                      </div>
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
                      <p
                        className="font-medium break-words"
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
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Recurring Periodicity
                      </Label>
                      <p className="font-medium">
                        {taskData.recurring && Number(taskData.recurring) !== 0
                          ? (() => {
                              const type = (taskData.recurringType || "").toLowerCase();
                              const n = Number(taskData.recurring);
                              if (type === "once") return "Trigger only once";
                              if (type === "day") return `Every ${n} ${n === 1 ? "day" : "days"}`;
                              if (type === "week") return `Every ${n} ${n === 1 ? "week" : "weeks"}`;
                              if (type === "month") return `Every ${n} ${n === 1 ? "month" : "months"}`;
                              return `${taskData.recurringType} - ${n}`;
                            })()
                          : "No Recurring"}
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
                          StatusCheck & Followup
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
                      {/* Client update completed progress */}
                      <div className="flex justify-between items-center text-xs">
                        <span className="flex items-center gap-2">
                          {taskData.completed ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <Clock className="h-3 w-3 text-gray-400" />
                          )}
                          Client update
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
                      <div className="text-sm font-medium">Created Date</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDateTime(taskData.createdAt, true)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Last Due Date</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDateTime(taskData.dueDate, true)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Completion Date</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDateTime(taskData.lastCompletedDate, true)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Next Trigger Date</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDateTime(taskData.triggerDate, true)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Next Due Date</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDateTime(taskData.nextDueDate, true)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* <Card>
                <CardHeader>
                  <CardTitle>Task Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="follow-up-duration" className="text-sm font-medium cursor-pointer">
                      Follow-up Required
                    </Label>
                    <Select
                      value={taskData.followUpDuration || "Working"}
                      onValueChange={handleFollowUpDurationChange}
                    >
                      <SelectTrigger id="follow-up-duration" className="w-full">
                        <SelectValue placeholder="Working" />
                      </SelectTrigger>
                      <SelectContent>
                        {durationOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status-check-duration" className="text-sm font-medium cursor-pointer">
                      Client update
                    </Label>
                    <Select
                      value={taskData.statusCheckDuration || "Working"}
                      onValueChange={handleStatusCheckDurationChange}
                    >
                      <SelectTrigger id="status-check-duration" className="w-full">
                        <SelectValue placeholder="Working" />
                      </SelectTrigger>
                      <SelectContent>
                        {durationOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card> */}
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
                      disabled={!taskData.active}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={3}
                    />
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="interaction-client-update"
                          checked={isClientUpdateInteraction}
                          onCheckedChange={(checked) =>
                            setIsClientUpdateInteraction(Boolean(checked))
                          }
                          disabled={!taskData.active}
                        />
                        <Label
                          htmlFor="interaction-client-update"
                          className="text-sm font-medium cursor-pointer"
                        >
                          I Updated the Client
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Click here if updating the client was necessary and you have updated the client.
                      </p>
                    </div>

                    {/* Timesheet fields */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-muted/50 p-4 rounded-lg">
                      <div className="space-y-2">
                        <Label className="text-sm">Work Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <Calendar className="mr-2 h-4 w-4" />
                              {commentDate ? format(commentDate, "MMM dd, yyyy") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={commentDate}
                              onSelect={setCommentDate}
                              disabled={(date) => date > new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm">Start Time</Label>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                          />
                          <div className="flex items-center gap-1">
                            <Checkbox onCheckedChange={(v) => v && setStartTime(getNowTime())} />
                            <span className="text-xs">Now</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm">Duration (minutes)</Label>
                        <Input
                          type="number"
                          min={1}
                          value={duration}
                          onChange={(e) => {
                            const mins = Number(e.target.value)
                            setDuration(mins)
                            if (startTime && mins) {
                              setEndTime(addMinutes(startTime, mins))
                            }
                          }}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm">End Time</Label>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="text"
                            value={endTime}
                            readOnly
                          />
                          {/* <div className="flex items-center gap-1">
                            <Checkbox onCheckedChange={(v) => v && setEndTime(getNowTime())} />
                            <span className="text-xs">Now</span>
                          </div> */}
                        </div>

                        {startTime && endTime && timeToMinutes(endTime) <= timeToMinutes(startTime) && (
                          <p className="text-xs text-destructive">
                            End time must be greater than start time
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          onChange={handleFileSelect}
                          accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.m4a,.mp3,.mp4,.wav,.ogg,.aac,.flac,.opus"
                          multiple
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Paperclip className="h-4 w-4 mr-2" />
                          Attach Files
                        </Button>
                        {selectedFiles.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {selectedFiles.map((file, index) => (
                              <div key={index} className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded flex items-center gap-1">
                                {file.name}
                                <button
                                  onClick={() => removeFile(index)}
                                  className="ml-1 text-red-500 hover:text-red-700"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        onClick={handleAddComment}
                        disabled={!newComment.trim() || !commentDate || !startTime || !endTime || submittingComment}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {submittingComment ? "Adding..." : "Add Comment"}
                      </Button>
                    </div>
                    {selectedFiles.length > 0 && (submittingComment || uploadPercent > 0 || uploadError) && (
                      <div className="space-y-2">
                        <Progress value={uploadPercent} className="h-2" />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{uploadError || uploadMessage || "Ready to upload"}</span>
                          <span>{uploadPercent}%</span>
                        </div>
                        {uploadError && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAddComment}
                            disabled={submittingComment || !newComment.trim() || !commentDate || !startTime || !endTime}
                          >
                            Retry Upload
                          </Button>
                        )}
                      </div>
                    )}
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
                                ? (comment.user?.username || "Unknown User")
                                : (comment.agent?.name || "Former Agent")}
                            </span>
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                              {getInteractionType(comment.content) === "CLIENT_UPDATE"
                                ? "Client Update"
                                : "Normal"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(comment.createdAt, true)}
                            </span>
                          </div>

                          {/* Display timesheet information if available */}
                          {(comment.commentDate || comment.startTime || comment.endTime) && (
                            <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border border-blue-200 dark:border-blue-800 p-3 rounded-lg mt-3 mb-3">
                              <div className="flex flex-wrap items-center gap-6 text-blue-900 dark:text-blue-100">
                                {comment.commentDate && (
                                  <div className="flex items-center gap-3">
                                    <div className="bg-blue-500 rounded-full p-1.5">
                                      <Calendar className="h-3.5 w-3.5 text-white" />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Work Date</span>
                                      <span className="text-sm font-medium">{format(new Date(comment.commentDate), "EEEE, MMM dd, yyyy")}</span>
                                    </div>
                                  </div>
                                )}
                                {comment.startTime && comment.endTime && (
                                  <div className="flex items-center gap-3">
                                    <div className="bg-blue-500 rounded-full p-1.5">
                                      <Clock className="h-3.5 w-3.5 text-white" />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Time Logged</span>
                                      <span className="text-sm font-medium">
                                        {format(new Date(comment.startTime), "h:mm a")} - {format(new Date(comment.endTime), "h:mm a")}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          <p className="text-sm">{getDisplayInteractionContent(comment.content)}</p>
                          {(() => {
                            const atts = (comment as any).attachments as { name: string; url: string; size: number; type: string }[] | null;
                            if (atts && atts.length > 0) {
                              return (
                                <div className="mt-2 space-y-1">
                                  {atts.map((att, idx) => (
                                    <div key={idx}>
                                      {att.type?.startsWith("image/") ? (
                                        <div className="space-y-1">
                                          <Image
                                            src={getAttachmentUrl(att.url)}
                                            alt={att.name}
                                            width={300}
                                            height={200}
                                            className="max-w-xs max-h-48 rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition-shadow object-cover"
                                            onClick={() => window.open(getAttachmentUrl(att.url), "_blank")}
                                            unoptimized
                                          />
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-2 rounded border">
                                            <Paperclip className="h-3 w-3" />
                                            <span className="font-medium">{att.name}</span>
                                            <span>({(att.size / 1024).toFixed(1)} KB)</span>
                                            <a href={getAttachmentUrl(att.url)} className="text-blue-600 hover:text-blue-800 underline ml-auto" target="_blank" rel="noopener noreferrer">View</a>
                                          </div>
                                        </div>
                                      ) : isAudioAttachment(att) ? (
                                        <div className="flex flex-col gap-1 text-xs text-muted-foreground bg-muted p-2 rounded border">
                                          <div className="flex items-center gap-2">
                                            <Paperclip className="h-3 w-3" />
                                            <span className="font-medium">{att.name}</span>
                                            <span>({(att.size / 1024).toFixed(1)} KB)</span>
                                          </div>
                                          <audio controls className="w-full">
                                            <source src={getAttachmentUrl(att.url)} />
                                            Your browser does not support the audio element.
                                          </audio>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-2 rounded border">
                                          <Paperclip className="h-3 w-3" />
                                          <span className="font-medium">{att.name}</span>
                                          <span>({(att.size / 1024).toFixed(1)} KB)</span>
                                          <div className="ml-auto flex items-center gap-2">
                                            <a href={getAttachmentUrl(att.url)} className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">View</a>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              );
                            } else if (comment.attachmentName) {
                              return (
                                <div className="mt-2">
                                  {comment.attachmentType?.startsWith("image/") && comment.attachmentUrl ? (
                                    <div className="space-y-2">
                                      <div className="relative inline-block">
                                        <Image
                                          src={getAttachmentUrl(comment.attachmentUrl)}
                                          alt={comment.attachmentName}
                                          width={300}
                                          height={200}
                                          className="max-w-xs max-h-48 rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition-shadow object-cover"
                                          onClick={() => window.open(getAttachmentUrl(comment.attachmentUrl), "_blank")}
                                          unoptimized={true}
                                        />
                                      </div>
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-2 rounded border">
                                        <Paperclip className="h-3 w-3" />
                                        <span className="font-medium">{comment.attachmentName}</span>
                                        <span>({(comment.attachmentSize! / 1024).toFixed(1)} KB)</span>
                                        <a href={getAttachmentUrl(comment.attachmentUrl)} className="text-blue-600 hover:text-blue-800 underline ml-auto" target="_blank" rel="noopener noreferrer">View</a>
                                      </div>
                                    </div>
                                  ) : comment.attachmentUrl &&
                                    isAudioAttachment({
                                      name: comment.attachmentName,
                                      url: comment.attachmentUrl,
                                      type: comment.attachmentType,
                                    }) ? (
                                    <div className="flex flex-col gap-1 text-xs text-muted-foreground bg-muted p-2 rounded border">
                                      <div className="flex items-center gap-2">
                                        <Paperclip className="h-3 w-3" />
                                        <span className="font-medium">{comment.attachmentName}</span>
                                        <span>({((comment.attachmentSize ?? 0) / 1024).toFixed(1)} KB)</span>
                                      </div>
                                      <audio controls className="w-full">
                                        <source src={getAttachmentUrl(comment.attachmentUrl)} />
                                        Your browser does not support the audio element.
                                      </audio>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted p-2 rounded border">
                                      <Paperclip className="h-3 w-3" />
                                      <span className="font-medium">{comment.attachmentName}</span>
                                      <span>({(comment.attachmentSize! / 1024).toFixed(1)} KB)</span>
                                      {comment.attachmentUrl && (
                                        <div className="ml-auto flex items-center gap-2">
                                          <a href={getAttachmentUrl(comment.attachmentUrl)} className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">View</a>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}
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
    </div >
  );
}
