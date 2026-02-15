"use client"

import { useMemo, useState, useEffect } from "react"
import { format, addDays, isSameDay } from "date-fns"
import { LogIn, LogOut } from "lucide-react"
import { TimeEntry } from "../page"

interface TimesheetCalendarProps {
  entries: TimeEntry[]
  startDate: Date
  daysToShow: number
  showLoginLogout: boolean
  onEntryClick: (entry: TimeEntry) => void
}

const timeSlots = [
  "12 AM",
  "1 AM",
  "2 AM",
  "3 AM",
  "4 AM",
  "5 AM",
  "6 AM",
  "7 AM",
  "8 AM",
  "9 AM",
  "10 AM",
  "11 AM",
  "12 PM",
  "1 PM",
  "2 PM",
  "3 PM",
  "4 PM",
  "5 PM",
  "6 PM",
  "7 PM",
  "8 PM",
  "9 PM",
  "10 PM",
  "11 PM",
];


const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
  yellow: {
    bg: "bg-yellow-100",
    text: "text-task-yellow-foreground",
    border: "border",
  },
  toDo: {
    bg: "bg-yellow-100",
    text: "text-yellow-900",
    border: "border border-yellow-400",
  },
  "in progress": {
    bg: "bg-blue-100",
    text: "text-blue-900",
    border: "border border-blue-400",
  },
  completed: {
    bg: "bg-green-100",
    text: "text-green-900",
    border: "border border-green-400",
  },
  login: {
    bg: "bg-green-500",
    text: "text-white",
    border: "border border-white",
  },
  logout: {
    bg: "bg-red-500",
    text: "text-white",
    border: "border border-white",
  },
  // Default fallback
  default: {
    bg: "bg-gray-100",
    text: "text-gray-900",
    border: "border border-gray-400",
  },
}

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [time, modifier] = timeStr.split(" ")
  let [hours, minutes] = time.split(":").map(Number)

  if (modifier === "PM" && hours !== 12) {
    hours += 12
  }

  if (modifier === "AM" && hours === 12) {
    hours = 0
  }

  return { hours, minutes }
}

function getPositionAndHeight(startTime: string, endTime: string) {
  const start = parseTime(startTime)
  const end = parseTime(endTime)

  // Calculate position from 12 AM (start of calendar)
  const startMinutesFrom12AM = start.hours * 60 + start.minutes
  const endMinutesFrom12AM = end.hours * 60 + end.minutes

  // Each hour slot is 60px
  const top = (startMinutesFrom12AM / 60) * 60
  const height = Math.max(((endMinutesFrom12AM - startMinutesFrom12AM) / 60) * 60, 20)

  return { top, height }
}

export function TimesheetCalendar({
  entries,
  startDate,
  daysToShow,
  showLoginLogout,
  onEntryClick,
}: TimesheetCalendarProps) {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const days = useMemo(() => {
    return Array.from({ length: daysToShow }, (_, i) => addDays(startDate, i))
  }, [startDate, daysToShow])

  const entriesByDay = useMemo(() => {
    const map = new Map<string, TimeEntry[]>()

    entries.forEach((entry) => {
      // if (!showLoginLogout && (entry.type === "login" || entry.type === "logout")) {
      //   return
      // }

      const dayKey = format(new Date(entry.date), "yyyy-MM-dd")
      if (!map.has(dayKey)) {
        map.set(dayKey, [])
      }
      map.get(dayKey)!.push(entry)
    })

    return map
  }, [entries, showLoginLogout])

  // Current time indicator position
  const currentTimePosition = useMemo(() => {
    const hours = currentTime.getHours()
    const minutes = currentTime.getMinutes()

    const minutesFrom12AM = hours * 60 + minutes
    return (minutesFrom12AM / 60) * 60
  }, [currentTime])

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-[800px]">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card border-b border-border">
          <div className="grid" style={{ gridTemplateColumns: `60px repeat(${daysToShow}, 1fr)` }}>
            <div className="p-3 text-xs text-muted-foreground font-medium border-r border-border">GMT</div>
            {days.map((day, index) => (
              <div
                key={index}
                className={`p-3 text-center border-r border-border ${isSameDay(day, new Date()) ? "bg-primary/5" : ""}`}
              >
                <div className="text-xs text-muted-foreground">{format(day, "EEEE")}</div>
                <div
                  className={`text-lg font-semibold ${isSameDay(day, new Date()) ? "text-primary" : "text-foreground"}`}
                >
                  {format(day, "d")}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Time Grid */}
        <div className="relative">
          <div className="grid" style={{ gridTemplateColumns: `60px repeat(${daysToShow}, 1fr)` }}>
            {/* Time Labels */}
            <div className="border-r border-border">
              {timeSlots.map((slot, index) => (
                <div key={index} className="h-[60px] px-2 py-1 text-xs text-muted-foreground text-right border-b">
                  {slot}
                </div>
              ))}
            </div>

            {/* Day Columns */}
            {days.map((day, dayIndex) => {
              const dayKey = format(day, "yyyy-MM-dd")
              const dayEntries = entriesByDay.get(dayKey) || []
              const isToday = isSameDay(day, new Date())

              return (
                <div key={dayIndex} className={`relative border-r border-border ${isToday ? "bg-primary/5" : ""}`}>
                  {/* Hour Lines */}
                  {timeSlots.map((_, index) => (
                    <div key={index} className="h-[60px] border-b border-border/50" />
                  ))}

                  {/* Current Time Indicator */}
                  {isToday && currentTimePosition !== null && (
                    <div
                      className="absolute left-0 right-0 flex items-center z-20 pointer-events-none"
                      style={{ top: currentTimePosition }}
                    >
                      <div className="w-2 h-2 rounded-full bg-destructive" />
                      <div className="flex-1 h-0.5 bg-destructive" />
                    </div>
                  )}

                  {/* Entries */}
                  {dayEntries.map((entry) => {
                    const { top, height } = getPositionAndHeight(entry.startTime, entry.endTime)
                    const colors = colorClasses[entry.status] || colorClasses.default
                    const isLoginLogout = entry.type === "login" || entry.type === "logout"


                    return (
                      <div
                        key={entry.id}
                        className={`absolute left-1 right-1 rounded-lg p-2 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg overflow-hidden ${colors.bg} ${colors.text} ${colors.border}`}
                        style={{
                          top: `${top}px`,
                          height: isLoginLogout ? "28px" : `${height}px`,
                          minHeight: isLoginLogout ? "28px" : "40px",
                        }}
                        onClick={() => onEntryClick(entry)}
                      >
                        {isLoginLogout ? (
                          <div className="flex items-center gap-1.5 text-xs font-medium">
                            {entry.type === "login" ? <LogIn className="h-3 w-3" /> : <LogOut className="h-3 w-3" />}
                            <span>{entry.startTime}</span>
                            <span className="">{entry.type === "login" ? "Login" : "Logout"}</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-1 text-xs opacity-80">
                              <span>{entry.startTime}</span>
                            </div>
                            <div className="font-medium text-sm mt-0.5 line-clamp-2">
                              <span className="opacity-80">{entry.title}</span>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
