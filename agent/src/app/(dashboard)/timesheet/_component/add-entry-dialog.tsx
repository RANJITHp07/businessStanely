"use client"

import { useState } from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { TaskColor, TaskStatus, TimeEntry } from "../page"

interface AddEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddEntry: (entry: TimeEntry) => void
}

export function AddEntryDialog({ open, onOpenChange, onAddEntry }: AddEntryDialogProps) {
  const [entryType, setEntryType] = useState<"task" | "login" | "logout">("task")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [project, setProject] = useState("")
  const [projectCode, setProjectCode] = useState("")
  const [date, setDate] = useState<Date>(new Date())
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("10:00")
  const [status, setStatus] = useState<TaskStatus>("in-progress")
  const [color, setColor] = useState<TaskColor>("blue")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [titleError, setTitleError] = useState("")
  const [submitError, setSubmitError] = useState("")

  const resetForm = () => {
    setTitle("")
    setDescription("")
    setProject("")
    setProjectCode("")
    setDate(new Date())
    setStartTime("09:00")
    setEndTime("10:00")
    setEntryType("task")
    setTitleError("")
    setSubmitError("")
  }

  const handleSubmit = () => {
    if (entryType === "task" && !title.trim()) {
      setTitleError("Title is required")
      return
    }
    setTitleError("")
    setSubmitError("")

    ;(async () => {
      setIsSubmitting(true)
      const payload = {
        title: entryType === "task" ? title.trim() : entryType === "login" ? "Login" : "Logout",
        description: entryType === "task" ? description : `${entryType} entry`,
        project: entryType === "task" ? project : "System",
        projectCode: entryType === "task" ? projectCode : entryType.toUpperCase(),
        date: date.toISOString(),
        startTime,
        endTime: entryType === "task" ? endTime : startTime,
        status: entryType === "task" ? status : "completed",
        color: entryType === "task" ? color : "green",
        type: entryType,
      }

      try {
        const res = await fetch('/api/timesheet/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          const data = await res.json()
          const e = data.entry
          onAddEntry({
            id: e.id,
            title: e.title,
            description: e.description || "",
            project: e.project || "",
            projectCode: e.projectCode || "",
            date: new Date(e.date),
            startTime: e.startTime,
            endTime: e.endTime,
            status: e.status as any,
            color: e.color as any,
            userId: e.agentId,
            userName: e.agent?.name || "Me",
            type: e.type,
          })
          resetForm()
          onOpenChange(false)
        } else {
          const errData = await res.json().catch(() => ({}))
          setSubmitError(errData.error || "Failed to add entry. Please try again.")
        }
      } catch {
        setSubmitError("Network error. Please try again.")
      }

      setIsSubmitting(false)
    })()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Time Entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">

          {/* Date */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(date, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{entryType === "task" ? "Start Time" : "Time"}</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            {entryType === "task" && (
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            )}
          </div>

          {/* Task-specific fields */}
          {entryType === "task" && (
            <>
              <div className="space-y-2">
                <Label>Title <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Enter task title"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); if (e.target.value.trim()) setTitleError("") }}
                  className={titleError ? "border-destructive" : ""}
                />
                {titleError && <p className="text-xs text-destructive">{titleError}</p>}
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Enter task description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="break">Break</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {submitError && <p className="text-xs text-destructive w-full">{submitError}</p>}
          <div className="flex gap-2 justify-end w-full">
            <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false) }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Entry"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
