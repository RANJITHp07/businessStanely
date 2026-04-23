"use client";
import { Search } from "lucide-react";
interface TeamMember {
  id: string;
  name: string;
  email: string;
  photo?: string;
}

import type React from "react";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

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
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { uploadFileToS3Direct } from "@/lib/directUpload";

// Task interface based on the API response
interface Task {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  progress: number;
  statusProgressMap?: Record<string, number>;
  createdAt: string;
  dueDate: string;
  updatedAt: string;
  followUpRequired: boolean;
  followUpDuration?: string;
  statusCheckDuration?: string;
  completed: boolean;
  recurring?: number;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  };
  ownerShipBy?: {
    id: string;
    name: string;
    email: string;
  };
  currentPeriodStart?: string;
  lastCompletedDate?: string;
  nextDueDate?: string;
  triggerDate?: string;
  holdDate?: string;
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
  legislation?: {
    title?: string;
  };
  service?: {
    id: string;
    name: string;
    description?: string;
  }[];
}

interface Comment {
  id: string;
  authorType: string;
  content: string;
  createdAt: string;
  commentDate?: string;
  startTime?: string;
  endTime?: string;
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
  const MANAGEMENT_BASE_URL = "https://management.legalstanley.com";

  const getAttachmentUrl = (url?: string) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${MANAGEMENT_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`;
  };

  // Assignment (Reassign) states
  const [showAssignSearch, setShowAssignSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [duration, setDuration] = useState(2)

  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  // For optimistic UI
  const taskRef = useRef<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("comments");
  const [newComment, setNewComment] = useState("");
  const [isClientUpdateInteraction, setIsClientUpdateInteraction] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Timesheet fields for comments
  const [commentDate, setCommentDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // Use subordinates from assignedTo if available (from API)
  // Type guard for subordinates
  function hasSubordinates(
    obj: unknown
  ): obj is { subordinates: TeamMember[] } {
    return (
      typeof obj === "object" &&
      obj !== null &&
      Array.isArray((obj as { subordinates?: unknown }).subordinates)
    );
  }

  useEffect(() => {
    if (task && task.assignedTo && hasSubordinates(task.assignedTo)) {
      setTeamMembers(task.assignedTo.subordinates);
    } else {
      setTeamMembers([]);
    }
  }, [task]);

  // Filtered members for search: only show results when searching
  const filteredMembers = searchQuery.trim()
    ? teamMembers.filter((member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : [];

  // Assign task to selected member
  const assignTask = async (memberId: string) => {
    if (!task) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: memberId }),
      });
      if (res.ok) {
        // After reassignment, redirect to task list since this agent will lose access
        router.push("/task");
      }
    } catch {
      // Optionally show error
    }
  };

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
          if (response.status === 401) {
            // Redirect to login page if unauthorized
            router.push("/login");
            return;
          }
          let errorMsg = "Failed to load task details";
          try {
            const errorData = await response.json();
            if (errorData && errorData.error) {
              errorMsg = errorData.error;
            }
          } catch { }
          setError(errorMsg);
          return;
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
  }, [taskId, router]);

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
    if (isNaN(dueDate.getTime())) return 0; // Handle invalid dates
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

  const formatDateTime = (
    dateString: string | undefined,
    showTime: boolean = true,
  ) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", showTime
      ? {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
      : {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
  };

  // Helper function to convert 24-hour format to 12-hour AM/PM format
  const get12HourFormat = (hour24: string): string => {
    const h = parseInt(hour24, 10);
    if (h === 0) return "12 AM";
    if (h < 12) return `${h} AM`;
    if (h === 12) return "12 PM";
    return `${h - 12} PM`;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadPercent(0);
      setUploadMessage("");
      setUploadError(null);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !task || !commentDate || !startTime || !endTime) {
      alert("Please fill in all required fields (comment, date, start time, and end time)");
      return;
    }
    setSubmittingComment(true);
    setUploadError(null);

    try {
      let attachmentData = {};

      // Handle file upload if a file is selected
      if (selectedFile) {
        try {
          const uploadResult = await uploadFileToS3Direct(selectedFile, {
            onProgress: (progress) => {
              setUploadPercent(progress.percent);
              setUploadMessage(progress.message);
            },
          });
          attachmentData = {
            attachmentName: uploadResult.originalName,
            attachmentSize: uploadResult.size,
            attachmentType: uploadResult.type,
            attachmentUrl: uploadResult.url,
          };

          if (task.status === "To Do") {
            setTask((prev) => prev ? { ...prev, status: "In Progress" } : null);
          }
        } catch (error) {
          console.error("Failed to upload file", error);
          setUploadError(
            error instanceof Error ? error.message : "Upload failed. Please retry.",
          );
          setSubmittingComment(false);
          return;
        }
      }

      // Combine date and time values
      const startDateTime = new Date(commentDate);
      const [startHour, startMinute] = startTime.split(":").map(Number);
      startDateTime.setHours(startHour, startMinute, 0);

      const endDateTime = new Date(commentDate);
      const [endHour, endMinute] = endTime.split(":").map(Number);
      endDateTime.setHours(endHour, endMinute, 0);

      const response = await fetch(`/api/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: task.id,
          content: `${isClientUpdateInteraction ? "[CLIENT_UPDATE]" : "[NORMAL]"} ${newComment.trim()}`,
          interactionType: isClientUpdateInteraction ? "CLIENT_UPDATE" : "NORMAL",
          commentDate: commentDate.toISOString(),
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
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
          task.statusCheckDuration &&
          task.statusCheckDuration !== "None"
        ) {
          await fetch(`/api/tasks/${task.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ statusCheckDuration: "None" }),
          });

          setTask((prev) =>
            prev ? { ...prev, statusCheckDuration: "None" } : prev,
          );
        }
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
  // When status changes, restore progress for that status from statusProgressMap
  const calculateNewDueDate = (holdDuration: string, currentDueDate: string) => {
    if (!holdDuration || holdDuration === "None") return currentDueDate;

    const durationMap: Record<string, number> = {
      "24hr": 1,
      "48hr": 2,
      "1w": 7,
    };

    const daysToAdd = durationMap[holdDuration] || 0;
    const dueDate = new Date(currentDueDate);
    dueDate.setDate(dueDate.getDate() + daysToAdd);

    return dueDate.toISOString();
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!task) return;
    const prevTask = { ...task };
    const map = task.statusProgressMap || {};
    const isCompleted = newStatus === "Completed";
    const restoredProgress = isCompleted ? 100 : (typeof map[newStatus] === "number" ? map[newStatus] : 0);

    let updatedDueDate = task.dueDate;
    if (newStatus === "Hold") {
      updatedDueDate = calculateNewDueDate(task.followUpDuration || "None", task.dueDate);
    }

    setTask({
      ...task,
      status: newStatus,
      progress: restoredProgress,
      dueDate: updatedDueDate,
    });
    setProgressInput(restoredProgress > 0 ? String(restoredProgress) : "");

    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
          progress: restoredProgress,
          statusProgressMap: { ...map, [newStatus]: restoredProgress },
          dueDate: updatedDueDate,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTask((prevTaskState) => ({
          ...prevTaskState!,
          ...data.task,
          comments: prevTaskState!.comments,
          assignedTo: prevTaskState!.assignedTo,
          client: prevTaskState!.client,
          category: data.task.category || prevTaskState!.category,
          timeLogs: prevTaskState!.timeLogs,
          legislation: prevTaskState!.legislation,
          dueDate: data.task.dueDate,
        }));
      } else {
        setTask(prevTask);
        console.error("Failed to update task status");
      }
    } catch (error) {
      setTask(prevTask);
      console.error("Error updating task status:", error);
    }
  };




  // Local state for progress input for smooth UX
  // Per-status progress input
  const [progressInput, setProgressInput] = useState<string>("");
  useEffect(() => {
    if (task) {
      // Use per-status progress if available
      const map = task.statusProgressMap || {};
      const status = task.status;
      const progress = typeof map[status] === "number" ? map[status] : task.progress;
      setProgressInput(progress && progress > 0 ? String(progress) : "");
    }
  }, [task]);

  // Clamp value between 0 and 100
  const clampProgress = (val: number) => Math.max(0, Math.min(100, val));

  // Debounced update for progress
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastProgressSent = useRef<number | null>(null);

  // Update per-status progress in backend and local state
  const updateProgressBackend = async (newProgress: number) => {
    if (!task) return;
    const prevTask = { ...task };
    const status = task.status;
    // Update local statusProgressMap
    const newMap = { ...(task.statusProgressMap || {}) };
    newMap[status] = newProgress;
    setTask({ ...task, progress: newProgress, statusProgressMap: newMap });
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress: newProgress, statusProgressMap: newMap }),
      });
      if (response.ok) {
        const data = await response.json();
        setTask(prevTaskState => ({
          ...prevTaskState!,
          ...data.task,
          comments: prevTaskState!.comments,
          assignedTo: prevTaskState!.assignedTo,
          client: prevTaskState!.client,
          category: data.task.category || prevTaskState!.category,
          timeLogs: prevTaskState!.timeLogs,
          legislation: prevTaskState!.legislation,
        }));
      } else {
        setTask(prevTask); // revert
      }
    } catch {
      setTask(prevTask); // revert
    }
  };

  const handleProgressInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^\d{0,3}$/.test(val)) {
      setProgressInput(val);
      // Debounce backend update
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
      debounceTimeout.current = setTimeout(() => {
        let newProgress = parseInt(val, 10);
        if (isNaN(newProgress)) newProgress = 0;
        newProgress = clampProgress(newProgress);
        if (task && newProgress !== task.progress && newProgress !== lastProgressSent.current) {
          lastProgressSent.current = newProgress;
          updateProgressBackend(newProgress);
        }
      }, 600);
    }
  };

  const handleProgressInputBlur = () => {
    if (!task) return;
    let newProgress = parseInt(progressInput, 10);
    if (isNaN(newProgress)) newProgress = 0;
    newProgress = clampProgress(newProgress);
    if (newProgress !== task.progress) {
      lastProgressSent.current = newProgress;
      updateProgressBackend(newProgress);
    } else {
      setProgressInput(task.progress && task.progress > 0 ? String(task.progress) : "");
    }
  };

  const handleProgressInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };


  // Dropdown options for durations
  const durationOptions = [
    { value: "None", label: "None" },
    { value: "24hr", label: "24 Hours" },
    { value: "48hr", label: "48 Hours" },
    { value: "1w", label: "1 Week" },
  ];

  const handleFollowUpDurationChange = async (value: string) => {
    if (!task) return;
    taskRef.current = task;
    let newStatusCheckDuration = task.statusCheckDuration;
    if (value !== "None" && task.statusCheckDuration !== "None") {
      newStatusCheckDuration = "None";
    }
    setTask({ ...task, followUpDuration: value, statusCheckDuration: newStatusCheckDuration });
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followUpDuration: value, statusCheckDuration: newStatusCheckDuration }),
      });
      if (response.ok) {
        const data = await response.json();
        setTask(prevTask => ({
          ...prevTask!,
          ...data.task,
          comments: prevTask!.comments,
          assignedTo: prevTask!.assignedTo,
          client: prevTask!.client,
          category: data.task.category || prevTask!.category,
          timeLogs: prevTask!.timeLogs,
          legislation: prevTask!.legislation,
        }));
      } else {
        setTask(taskRef.current);
        console.error("Failed to update follow-up duration");
      }
    } catch (error) {
      setTask(taskRef.current);
      console.error("Error updating follow-up duration:", error);
    }
  };

  const handleStatusCheckDurationChange = async (value: string) => {
    if (!task) return;
    taskRef.current = task;
    let newFollowUpDuration = task.followUpDuration;
    if (value !== "None" && task.followUpDuration !== "None") {
      newFollowUpDuration = "None";
    }
    setTask({ ...task, statusCheckDuration: value, followUpDuration: newFollowUpDuration });
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusCheckDuration: value, followUpDuration: newFollowUpDuration }),
      });
      if (response.ok) {
        const data = await response.json();
        setTask(prevTask => ({
          ...prevTask!,
          ...data.task,
          comments: prevTask!.comments,
          assignedTo: prevTask!.assignedTo,
          client: prevTask!.client,
          category: data.task.category || prevTask!.category,
          timeLogs: prevTask!.timeLogs,
          legislation: prevTask!.legislation,
        }));
      } else {
        setTask(taskRef.current);
        console.error("Failed to update status check duration");
      }
    } catch (error) {
      setTask(taskRef.current);
      console.error("Error updating status check duration:", error);
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

  useEffect(() => {
    if (startTime && duration > 0) {
      setEndTime(addMinutes(startTime, duration));
      return;
    }
    setEndTime("");
  }, [startTime, duration]);


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
                  {/* Show Associated Service name and description at the top */}
                  {task.service && task.service.length > 0 && (
                    <div className="mt-2">
                      <div className="font-semibold text-base text-gray-900">Service: {task.service[0].name}</div>
                      <div className="text-sm text-muted-foreground">
                        {task.service[0].description || "No description available"}
                      </div>
                    </div>
                  )}
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
                  <span className="inline-flex"><Avatar className="h-4 w-4"><AvatarFallback className="text-xs">{task.ownerShipBy?.name?.split(" ").map((n) => n[0]).join("") || "U"}</AvatarFallback></Avatar></span>
                  <span className="text-gray-600">
                    Ownership to {task.ownerShipBy?.name || "Unassigned"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="inline-flex"><Avatar className="h-4 w-4"><AvatarFallback className="text-xs">{task.assignedTo?.name?.split(" ").map((n) => n[0]).join("") || "U"}</AvatarFallback></Avatar></span>
                  <span className="text-gray-600">
                    Asssigned to {task.assignedTo?.name || "Unassigned"}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">
                    {task.progress}% complete
                  </span>
                </div>
              </div>

              {/* Follow-up and Status Check Dropdowns */}
              <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 p-0 md:p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="follow-up-duration" className="text-sm font-medium cursor-pointer">
                    StatusCheck&Followup
                  </Label>
                  <Select
                    value={task.followUpDuration || "None"}
                    onValueChange={handleFollowUpDurationChange}
                  >
                    <SelectTrigger id="follow-up-duration" className="w-28">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      {durationOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="status-check-duration" className="text-sm font-medium cursor-pointer">
                    Client update
                  </Label>
                  <Select
                    value={task.statusCheckDuration || "None"}
                    onValueChange={handleStatusCheckDurationChange}
                    disabled
                  >
                    <SelectTrigger id="status-check-duration" className="w-28">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      {durationOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 relative">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">
                      {task.assignedTo?.name || "Unassigned"}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAssignSearch(!showAssignSearch)}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Reassign
                    </Button>
                  </div>

                  {showAssignSearch && (
                    <div className="mt-3 p-3 border rounded-lg bg-gray-50 absolute w-96">
                      <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search team members..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {filteredMembers.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-2 hover:bg-white rounded cursor-pointer"
                            onClick={() => assignTask(member.id)}
                          >
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                {member.photo ? (
                                  <AvatarImage src={member.photo} />
                                ) : null}
                                <AvatarFallback className="text-xs">
                                  {member.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="text-sm font-medium">
                                  {member.name}
                                </div>
                                {/* No role field, so nothing here */}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground md:ml-auto">
                  Last updated: {formatDateTime(task.updatedAt)}
                </div>
              </div>
              <div className="flex items-center gap-4">
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
                      <SelectItem value="Abandoned">Abandoned</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="space-y-2 items-center w-96">
                    <Label htmlFor="progress">
                      Progress ({task.progress}%)
                    </Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min="0"
                      max="100"
                      value={progressInput || "0"}
                      placeholder=""
                      onChange={handleProgressInputChange}
                      onBlur={handleProgressInputBlur}
                      onKeyDown={handleProgressInputKeyDown}
                      className="w-full"
                    />
                    {/* <div className="w-96 flex flex-col gap-2">
                      <Label htmlFor="progress">
                        Progress ({task.progress}%)
                      </Label>
                      <Progress value={task.progress} className="w-ful" />
                    </div> */}
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
            <p className="text-[12px] md:text-[14px]">Task Details</p>
          </TabsTrigger>
          <TabsTrigger value="comments" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 hidden md:block" />
            <p className="text-[12px] md:text-[14px]">
              Interactions ({commentsData.length})
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Description
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {task.description}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Legislation Name
                      </Label>
                      <p className="font-medium">
                        {task.legislation?.title || "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Recurring
                      </Label>
                      <p className="font-medium">
                        {task.recurring
                          ? `Every ${task.recurring} ${task.recurring === 1 ? "month" : "months"}`
                          : "Not recurring"}
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

              <Card>
                <CardHeader>
                  <CardTitle>Associated Service</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {task.service && task.service.length > 0 ? (
                    task.service.map((service) => (
                      <div key={service.id}>
                        <p className="font-medium">{service.name}</p>
                        <p className="text-sm text-muted-foreground">{service.description || "No description available"}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No associated services available.</p>
                  )}
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
                      <div className="text-sm font-medium">Created Date</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDateTime(task.createdAt, true)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Last Due Date</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDateTime(task.dueDate, true)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Completion Date</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDateTime(task.lastCompletedDate, true)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Next Trigger Date</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDateTime(task.triggerDate, true)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">Next Due Date</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDateTime(task.nextDueDate, true)}
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
                    <AvatarFallback className="text-xs">A</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <Textarea
                      placeholder="Add a comment..."
                      value={newComment}
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
                        />
                        <Label
                          htmlFor="interaction-client-update"
                          className="text-sm font-medium cursor-pointer"
                        >
                          Mark as Client Update Interaction
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Keep this unchecked for a normal internal interaction. Check this only when this comment is a direct update to the client.
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



                    {/* File upload and submit button */}
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
                              onClick={() => {
                                setSelectedFile(null);
                                setUploadPercent(0);
                                setUploadMessage("");
                                setUploadError(null);
                              }}
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
                        disabled={!newComment.trim() || submittingComment || !commentDate || !startTime || !endTime}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {submittingComment ? "Adding..." : "Add Comment"}
                      </Button>
                    </div>
                    {selectedFile && (submittingComment || uploadPercent > 0 || uploadError) && (
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
                {commentsData.length === 0 ? (
                  <p className="text-muted-foreground">No interactions yet.</p>
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
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                              {getInteractionType(comment.content) === "CLIENT_UPDATE"
                                ? "Client Update"
                                : "Normal"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(comment.createdAt)}
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
                                        src={getAttachmentUrl(comment.attachmentUrl)}
                                        alt={comment.attachmentName}
                                        width={300}
                                        height={200}
                                        className="max-w-xs max-h-48 rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition-shadow object-cover"
                                        onClick={() =>
                                          window.open(
                                            getAttachmentUrl(comment.attachmentUrl),
                                            "_blank"
                                          )
                                        }
                                      />
                                    ) : (
                                      <Image
                                        src={getAttachmentUrl(comment.attachmentUrl)}
                                        alt={comment.attachmentName}
                                        width={300}
                                        height={200}
                                        className="max-w-xs max-h-48 rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition-shadow object-cover"
                                        onClick={() =>
                                          window.open(
                                            getAttachmentUrl(comment.attachmentUrl),
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
                                      href={getAttachmentUrl(comment.attachmentUrl)}
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
                                      href={getAttachmentUrl(comment.attachmentUrl)}
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
                          By {log.agent.name} on {formatDateISTDisplay(log.date)}
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
