"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { addDays, startOfWeek } from "date-fns"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TimesheetFilters } from "./_component/timesheet-filters"
import { TimesheetCalendar } from "./_component/timesheet-calendar"
import { TaskDetailDialog } from "./_component/task-detail-dialog"
import type { Agent } from "@/types"

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

export default function TimesheetPage() {
    const [entries, setEntries] = useState<TimeEntry[]>([])
    const [agents, setAgents] = useState<Agent[]>([])
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
    const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>([])
    const [showLoginLogout, setShowLoginLogout] = useState(true)
    const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null)
    const [detailDialogOpen, setDetailDialogOpen] = useState(false)
    const [startDate, setStartDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
    const [daysToShow, setDaysToShow] = useState(7)

    // Fetch all agents for selection
    useEffect(() => {
        const fetchAgents = async () => {
            try {
                console.log('[DEBUG] Fetching agents...');
                const response = await fetch("/api/timesheet/agents"); // Use dedicated timesheet agents endpoint
                const data = response.ok ? await response.json() : { agents: [] };
                console.log('[DEBUG] Agents API response:', data);
                const agentsList = (data.agents || []);
                console.log('[DEBUG] Agents list:', agentsList.length, 'agents');
                setAgents(agentsList);
                // Default to first agent
                if (agentsList.length > 0 && !selectedAgent) {
                    console.log('[DEBUG] Setting default agent to:', agentsList[0].name);
                    setSelectedAgent(agentsList[0]);
                }
            } catch (error) {
                console.error('[DEBUG] Error fetching agents:', error);
                setAgents([]);
            }
        };
        fetchAgents();
    }, [selectedAgent]);

    // Fetch timesheet data for selected agent
    useEffect(() => {
        const fetchTimesheetData = async () => {
            if (!selectedAgent) return;
            try {
                const response = await fetch(`/api/timesheet?agentId=${selectedAgent.id}`);
                const data = response.ok ? await response.json() : { tasks: [] };
                const tasks = (data.tasks || []);
                console.log('[DEBUG] API Response for agent', selectedAgent.name, ':', data);
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
                            const statusLower = task.status.toLowerCase().replace(/\\s+/g, "");
                            if (["todo", "pending"].includes(statusLower)) normalizedStatus = "toDo";
                            else if (["inprogress", "progress"].includes(statusLower)) normalizedStatus = "in-progress";
                            else if (["completed"].includes(statusLower)) normalizedStatus = "completed";
                        }
                        const entry: TimeEntry = {
                            id: `real-${entryId++}`,
                            title: task.title,
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
    }, [selectedAgent]);

    const endDate = useMemo(() => addDays(startDate, daysToShow - 1), [startDate, daysToShow])

    // Filter entries by status and date (no user filtering for admin)
    const filteredEntries = useMemo(() => {
        console.log('[DEBUG] Filtering entries. Selected statuses:', selectedStatuses);
        return entries.filter((entry) => {
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
    }, [entries, selectedStatuses, startDate, daysToShow])

    useEffect(() => {
        console.log('[DEBUG] Filtered entries for calendar:', filteredEntries);
    }, [filteredEntries])

    // Handler for clicking an entry (show modal)
    const handleEntryClick = useCallback((entry: TimeEntry) => {
        setSelectedEntry(entry);
        setDetailDialogOpen(true);
    }, [])

    return (
        <div className="h-screen flex flex-col bg-background">
            {/* Filters */}
            <TimesheetFilters
                agents={agents}
                selectedAgent={selectedAgent}
                onSelectedAgentChange={setSelectedAgent}
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={(date) => setStartDate(addDays(date, -daysToShow + 1))}
                daysToShow={daysToShow}
                onDaysToShowChange={setDaysToShow}
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
                showLoginLogout={showLoginLogout}
            />

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