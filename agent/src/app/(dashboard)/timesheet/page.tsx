"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useAgentContext } from "@/lib/agent-context"
import { addDays, startOfWeek } from "date-fns"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TimesheetFilters } from "./_component/timesheet-filters"
import { TimesheetCalendar } from "./_component/timesheet-calendar"
import { TaskDetailDialog } from "./_component/task-detail-dialog"
import { AddEntryDialog } from "./_component/add-entry-dialog"
import type { Task, Comment } from "@/types"

export type TaskStatus = "completed" | "in-progress" | "toDo" | "login" | "logout"

export type TaskColor = "yellow" | "coral" | "blue" | "green"

export interface TimeEntry {
    id: string
    title: string
    description: string
    project: string
    projectCode: string
    date: Date
    startTime: string
    endTime: string
    status: TaskStatus
    color: TaskColor
    userId: string
    userName: string
    type: "task" | "login" | "logout"
}

export interface User {
    id: string
    name: string
    email: string
    avatar?: string
}

export const users: User[] = [
    { id: "1", name: "Me", email: "me@company.com" },
    { id: "2", name: "Adam Fisherman", email: "adam@company.com" },
    { id: "3", name: "Sarah Johnson", email: "sarah@company.com" },
    { id: "4", name: "Mike Chen", email: "mike@company.com" },
]

export const sampleTimeEntries: TimeEntry[] = [
    // No dummy data, will fetch real data
]

export default function TimesheetPage() {
    const [entries, setEntries] = useState<TimeEntry[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [selectedUsers, setSelectedUsers] = useState<User[]>([])
    const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>([])
    const [showLoginLogout, setShowLoginLogout] = useState(true)
    const [addDialogOpen, setAddDialogOpen] = useState(false)
    const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null)
    const [detailDialogOpen, setDetailDialogOpen] = useState(false)
    const [startDate, setStartDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
    const [daysToShow, setDaysToShow] = useState(7)
    const agent = useAgentContext();

    // Fetch agent and team members for filter
    useEffect(() => {
        const fetchUsers = async () => {
            if (!agent) return;
            try {
                // Fetch team members (subordinates)
                const res = await fetch("/api/team-members");
                const team = res.ok ? await res.json() : [];
                // Build users list: Me + team
                const me: User = { id: agent.id, name: "Me", email: agent.email };
                const teammates: User[] = (team || []).map((tm: { id: string, name: string, email: string }) => ({ id: tm.id, name: tm.name, email: tm.email }));
                setUsers([me, ...teammates]);
                setSelectedUsers([me]); // Default to "Me"
            } catch {
                setUsers([]);
            }
        };
        fetchUsers();
    }, [agent]);

    // Fetch all tasks for agent and team
    useEffect(() => {
        const fetchTimesheetData = async () => {
            if (!agent || users.length === 0) return;
            try {
                // Fetch tasks for all user ids (agent + team) from new timesheet API
                const userIds = users.map(u => u.id);
                const response = await fetch(`/api/timesheet?assignedToIds=${userIds.join(",")}`);
                const data = response.ok ? await response.json() : { tasks: [] };
                const tasks = (data.tasks || []);
                console.log('[DEBUG] API Response:', data);
                console.log('[DEBUG] Tasks count:', tasks.length);
                const commentEntries: TimeEntry[] = [];
                let entryId = 1000;
                tasks.forEach((task: { id: string, title: string, client?: { name: string }, status?: string, comments?: Array<any>, assignedTo?: { id: string, name: string } }) => {
                    console.log('[DEBUG] Processing task:', task.id, 'with', task.comments?.length || 0, 'comments');
                    (task.comments || []).forEach((commentRaw: { commentDate: string, startTime?: string, endTime?: string, content?: string, agent?: { id: string, name: string }, user?: { id: string, username: string } }) => {
                        if (!commentRaw.commentDate) return;
                        const startTimeDate = commentRaw.startTime ? new Date(commentRaw.startTime) : null;
                        const endTimeDate = commentRaw.endTime ? new Date(commentRaw.endTime) : null;
                        const startTimeStr = startTimeDate ? `${startTimeDate.getHours().toString().padStart(2, "0")}:${startTimeDate.getMinutes().toString().padStart(2, "0")}` : "";
                        const endTimeStr = endTimeDate ? `${endTimeDate.getHours().toString().padStart(2, "0")}:${endTimeDate.getMinutes().toString().padStart(2, "0")}` : "";
                        const userName = commentRaw.agent?.name || commentRaw.user?.username || task.assignedTo?.name || "";
                        const userId = commentRaw.agent?.id || commentRaw.user?.id || task.assignedTo?.id || "";
                        let projectCode = task.id.slice(0, 6).toUpperCase();
                        if (/^[0-9A-F]{6}$/i.test(projectCode)) projectCode = "";
                        // Normalize status to match colorClasses
                        let normalizedStatus: TaskStatus = "completed";
                        if (task.status) {
                            const statusLower = task.status.toLowerCase().replace(/\s+/g, "");
                            if (["todo", "pending"].includes(statusLower)) normalizedStatus = "toDo";
                            else if (["inprogress", "progress"].includes(statusLower)) normalizedStatus = "in-progress";
                            else if (["completed"].includes(statusLower)) normalizedStatus = "completed";
                        }
                        const entry: TimeEntry = {
                            id: `real-${entryId++}`,
                            title: task.title, // Show task name in timesheet
                            description: commentRaw.content || "",
                            project: task.client?.name || "Project",
                            projectCode,
                            date: new Date(commentRaw.commentDate),
                            startTime: startTimeStr,
                            endTime: endTimeStr,
                            status: normalizedStatus,
                            color: "blue",
                            userId,
                            userName,
                            type: "task",
                        };
                        console.log('[DEBUG] Created entry:', entry.id, 'for date:', entry.date, 'user:', entry.userName);
                        commentEntries.push(entry);
                    });
                });
                console.log('[DEBUG] Total comment entries created:', commentEntries.length);
                setEntries(commentEntries);
            } catch {
                setEntries([]);
            }
        };
        fetchTimesheetData();
    }, [agent, users]);

    const endDate = useMemo(() => addDays(startDate, daysToShow - 1), [startDate, daysToShow])

    // Filter entries by selected users, status, and date
    const filteredEntries = useMemo(() => {
        console.log('[DEBUG] Filtering entries. Selected users:', selectedUsers.map(u => u.name), 'Selected statuses:', selectedStatuses);
        return entries.filter((entry) => {
            if (selectedUsers.length > 0 && !selectedUsers.find((u) => u.id === entry.userId)) {
                return false;
            }
            if (selectedStatuses.length > 0 && !selectedStatuses.includes(entry.status)) {
                return false;
            }
            const entryDate = entry.date.getTime();
            const start = startDate.getTime();
            const end = addDays(startDate, daysToShow).getTime();
            if (entryDate < start || entryDate >= end) {
                return false;
            }
            return true;
        });
    }, [entries, selectedUsers, selectedStatuses, startDate, daysToShow])

    useEffect(() => {
        console.log('[DEBUG] Filtered entries for calendar:', filteredEntries);
    }, [filteredEntries])

    const totalHours = useMemo(() => {
        const taskEntries = filteredEntries.filter((e) => e.type === "task")
        let totalMinutes = 0
        taskEntries.forEach((entry) => {
            const [startH, startM] = entry.startTime.split(":").map(Number)
            const [endH, endM] = entry.endTime.split(":").map(Number)
            totalMinutes += endH * 60 + endM - (startH * 60 + startM)
        })
        return Math.round(totalMinutes / 60)
    }, [filteredEntries])

    const handleAddEntry = useCallback((newEntry: Omit<TimeEntry, "id">) => {
        const id = `${Date.now()}`
        setEntries((prev) => [...prev, { ...newEntry, id }])
    }, [])

    // Handler for clicking an entry (show modal)
    const handleEntryClick = useCallback((entry: TimeEntry) => {
        setSelectedEntry(entry);
        setDetailDialogOpen(true);
    }, [])

    const handlePrevious = useCallback(() => {
        setStartDate((prev) => addDays(prev, -daysToShow))
    }, [daysToShow])

    const handleNext = useCallback(() => {
        setStartDate((prev) => addDays(prev, daysToShow))
    }, [daysToShow])

    const handleToday = useCallback(() => {
        setStartDate(startOfWeek(new Date(), { weekStartsOn: 1 }))
    }, [])

    return (
        <div className="h-screen flex flex-col bg-background">
            {/* Header */}
            {/* <TimesheetHeader
                startDate={startDate}
                totalHours={totalHours}
                onPrevious={handlePrevious}
                onNext={handleNext}
                onToday={handleToday}
            /> */}

            {/* Filters */}
            <TimesheetFilters
                users={users}
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={(date) => setStartDate(addDays(date, -daysToShow + 1))}
                daysToShow={daysToShow}
                onDaysToShowChange={setDaysToShow}
                selectedUsers={selectedUsers}
                onSelectedUsersChange={setSelectedUsers}
                selectedStatuses={selectedStatuses}
                onSelectedStatusesChange={setSelectedStatuses}
                showLoginLogout={showLoginLogout}
                onShowLoginLogoutChange={setShowLoginLogout}
            />

            {/* Calendar */}
            <TimesheetCalendar
                entries={filteredEntries}
                startDate={startDate}
                daysToShow={daysToShow}
                onEntryClick={handleEntryClick}
                // showTaskName removed, not in props
            />

            {/* Floating Add Button */}
            <Button
                size="lg"
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
                onClick={() => setAddDialogOpen(true)}
            >
                <Plus className="h-6 w-6" />
            </Button>

            {/* Dialogs */}
            <AddEntryDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onAddEntry={handleAddEntry} />

            {/* Modal for comment details */}
            {selectedEntry && (
                <TaskDetailDialog
                    open={detailDialogOpen}
                    onOpenChange={setDetailDialogOpen}
                    entry={selectedEntry}
                />
            )}
        </div>
    )
}