"use client"

import { format } from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TimesheetHeaderProps {
  startDate: Date
  totalHours: number
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
}

export function TimesheetHeader({ startDate, totalHours, onPrevious, onNext, onToday }: TimesheetHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onToday}>
          Today
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="text-lg font-semibold">{format(startDate, "MMMM yyyy")}</h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-sm">
          Worked this week: <span className="font-semibold">{totalHours} hours</span>
        </div>
        <Button size="sm" className="bg-primary hover:bg-primary/90">
          Submit time
        </Button>
      </div>
    </div>
  )
}
