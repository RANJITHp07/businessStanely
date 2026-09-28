"use client"

import { format } from "date-fns"
import { Clock, Calendar, User, Tag, FileText, LogIn, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import type { TimeEntry } from "../page"
import { useRouter } from "next/navigation"

interface TaskDetailDialogProps {
  entry: TimeEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const statusColors: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-700",
  "in-progress": "bg-blue-100 text-blue-700",
  pending: "bg-amber-100 text-amber-700",
  break: "bg-gray-100 text-gray-700",
}

const isLoginLogoutEntry = (entry: TimeEntry) =>
  entry.type === "login" || entry.type === "logout"

const entryHeadingLabel = (entry: TimeEntry) =>
  entry.type === "logout"
    ? entry.logoutReason === "session"
      ? "Session Logout Entry"
      : entry.logoutReason === "force"
        ? "Force Logout Entry"
        : "Logout Entry"
    : "Login Entry"

/**
 * The heading and field list shared by the click dialog and the hover preview.
 * Both surfaces show the same entry, so keeping one body is what stops the two
 * from drifting as fields are added.
 */
export function TimeEntryHeading({ entry }: { entry: TimeEntry }) {
  const isLoginLogout = isLoginLogoutEntry(entry)

  return (
    <span className="flex items-center gap-2">
      {isLoginLogout ? (
        <>
          {entry.type === "login" ? (
            <LogIn className="h-5 w-5 text-emerald-500" />
          ) : (
            <LogOut className="h-5 w-5 text-red-500" />
          )}
          {entryHeadingLabel(entry)}
        </>
      ) : (
        <>
          {entry.title}
          <Badge className={statusColors[entry.status]}>{entry.status.replace("-", " ")}</Badge>
        </>
      )}
    </span>
  )
}

export function TimeEntryFields({
  entry,
  compact = false,
}: {
  entry: TimeEntry
  compact?: boolean
}) {
  const isLoginLogout = isLoginLogoutEntry(entry)

  return (
    <>
      <div className={compact ? "space-y-2 pt-2" : "space-y-4 py-4"}>
        {!isLoginLogout && entry.description && (
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">{entry.description}</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{format(entry.date, "EEEE, MMMM d, yyyy")}</span>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            {isLoginLogout ? entry.startTime : `${entry.startTime} - ${entry.endTime}`}
          </span>
        </div>

        {!isLoginLogout && (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{entry.userName}</span>
          </div>
        )}
      </div>
    </>
  )
}

export function TaskDetailDialog({ entry, open, onOpenChange }: TaskDetailDialogProps) {
  const router = useRouter()
  if (!entry) return null

  const isLoginLogout = isLoginLogoutEntry(entry)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle>
            <TimeEntryHeading entry={entry} />
          </DialogTitle>
        </DialogHeader>

        <TimeEntryFields entry={entry} />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!isLoginLogout && entry?.taskId && <Button onClick={() => {
            router.push("/task/" + entry?.taskId)
          }}>Go to Task</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog >
  )
}
