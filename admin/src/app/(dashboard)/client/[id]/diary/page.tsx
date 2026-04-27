"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Bold, Italic, Underline, List, ListOrdered, Heading1, Heading2, Plus, Save, Trash2, CalendarIcon } from "lucide-react"
import { toast } from "react-toastify"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

type ClientDiaryEntry = {
    id: string
    clientId: string
    entryDate: string
    heading?: string
    content: string
    createdAt: string
    updatedAt: string
}

const getPlainText = (html: string) => {
    return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
}

const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return ""
    const [year, month, day] = dateStr.split("-").map(Number)
    if (!year || !month || !day) return dateStr
    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    })
}

const toDateStringLocal = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
}

export default function ClientDiaryPage() {
    const params = useParams()
    const clientId = params.id as string

    const [clientName, setClientName] = useState<string>("")
    const [entries, setEntries] = useState<ClientDiaryEntry[]>([])
    const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
    const [draftEntryDate, setDraftEntryDate] = useState<Date>(new Date())
    const [draftHeading, setDraftHeading] = useState("")
    const [draftHtml, setDraftHtml] = useState("")
    const [isLoading, setIsLoading] = useState(true)
    const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
    const [isCalendarOpen, setIsCalendarOpen] = useState(false)

    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const editorRef = useRef<HTMLDivElement>(null)

    const syncDraftToEditor = (html: string) => {
        if (editorRef.current) {
            editorRef.current.innerHTML = html
        }
    }

    useEffect(() => {
        if (!clientId) return
        fetch(`/api/clients/${clientId}`)
            .then((r) => r.json())
            .then((data) => {
                if (data?.clientType === "individual") {
                    setClientName(`${data.firstName ?? ""} ${data.lastName ?? ""}`.trim())
                } else if (data?.organizationName) {
                    setClientName(data.organizationName)
                }
            })
            .catch(() => { })
    }, [clientId])

    const fetchEntries = async () => {
        try {
            setIsLoading(true)
            const response = await fetch(`/api/clients/${clientId}/diary`, { cache: "no-store" })
            if (!response.ok) {
                toast.error("Failed to load diary entries")
                return
            }
            const data = await response.json()
            const fetched: ClientDiaryEntry[] = Array.isArray(data.entries) ? data.entries : []
            setEntries(fetched)
            if (fetched.length > 0) {
                loadEntry(fetched[0])
            }
        } catch {
            toast.error("Failed to load diary entries")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (clientId) fetchEntries()
    }, [clientId])

    const loadEntry = (entry: ClientDiaryEntry) => {
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
        setSelectedEntryId(entry.id)
        const [y, m, d] = entry.entryDate.split("-").map(Number)
        setDraftEntryDate(new Date(y, m - 1, d))
        setDraftHeading(entry.heading ?? "")
        setDraftHtml(entry.content)
        syncDraftToEditor(entry.content)
        setLastSavedAt(null)
    }

    const newEntry = () => {
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
        setSelectedEntryId(null)
        setDraftEntryDate(new Date())
        setDraftHeading("")
        setDraftHtml("")
        syncDraftToEditor("")
        setLastSavedAt(null)
    }

    const runEditorCommand = (command: string, value?: string) => {
        if (!editorRef.current) return
        editorRef.current.focus()
        document.execCommand(command, false, value)
        setDraftHtml(editorRef.current.innerHTML)
    }

    const handleEditorInput = () => {
        if (!editorRef.current) return
        setDraftHtml(editorRef.current.innerHTML)
    }

    const handleSave = async () => {
        const text = getPlainText(draftHtml)
        if (!text) {
            toast.error("Write something before saving")
            return
        }
        const entryDate = toDateStringLocal(draftEntryDate)

        try {
            if (selectedEntryId) {
                const response = await fetch(`/api/clients/${clientId}/diary/${selectedEntryId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ entryDate, heading: draftHeading, content: draftHtml }),
                })
                if (!response.ok) throw new Error("Failed to update entry")
                const data = await response.json()
                const updated: ClientDiaryEntry = data.entry
                setEntries((prev) =>
                    prev
                        .map((e) => (e.id === updated.id ? updated : e))
                        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                )
            } else {
                const response = await fetch(`/api/clients/${clientId}/diary`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ entryDate, heading: draftHeading, content: draftHtml }),
                })
                if (!response.ok) throw new Error("Failed to create entry")
                const data = await response.json()
                const created: ClientDiaryEntry = data.entry
                setEntries((prev) => [created, ...prev])
                setSelectedEntryId(created.id)
            }
            toast.success("Saved")
        } catch {
            toast.error("Failed to save entry")
        }
    }

    const handleDelete = async () => {
        if (!selectedEntryId) return
        try {
            const response = await fetch(`/api/clients/${clientId}/diary/${selectedEntryId}`, {
                method: "DELETE",
            })
            if (!response.ok) throw new Error("Failed to delete entry")
            const remaining = entries.filter((e) => e.id !== selectedEntryId)
            setEntries(remaining)
            if (remaining.length > 0) {
                loadEntry(remaining[0])
            } else {
                newEntry()
            }
            toast.success("Deleted")
        } catch {
            toast.error("Failed to delete entry")
        }
    }

    useEffect(() => {
        if (!autoSaveEnabled) return
        if (!getPlainText(draftHtml)) return
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)

        autoSaveTimerRef.current = setTimeout(async () => {
            const text = getPlainText(draftHtml)
            if (!text && !draftHeading) return
            const entryDate = toDateStringLocal(draftEntryDate)
            try {
                setIsSaving(true)
                if (selectedEntryId) {
                    const response = await fetch(`/api/clients/${clientId}/diary/${selectedEntryId}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ entryDate, heading: draftHeading, content: draftHtml }),
                    })
                    if (!response.ok) return
                    const data = await response.json()
                    const updated: ClientDiaryEntry = data.entry
                    setEntries((prev) =>
                        prev
                            .map((e) => (e.id === updated.id ? updated : e))
                            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                    )
                } else {
                    const response = await fetch(`/api/clients/${clientId}/diary`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ entryDate, heading: draftHeading, content: draftHtml }),
                    })
                    if (!response.ok) return
                    const data = await response.json()
                    const created: ClientDiaryEntry = data.entry
                    setEntries((prev) => [created, ...prev])
                    setSelectedEntryId(created.id)
                }
                setLastSavedAt(new Date())
            } catch {
                // auto-save silently fails
            } finally {
                setIsSaving(false)
            }
        }, 2000)

        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
        }
    }, [draftHtml, draftHeading, draftEntryDate, autoSaveEnabled, selectedEntryId, clientId])

    return (
        <div className="h-screen flex bg-white">
            {/* Left Sidebar */}
            <div className="w-[320px] border-r bg-muted/30 flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                    <div>
                        <h2 className="font-semibold text-sm">Client Diary</h2>
                        {clientName && (
                            <p className="text-xs text-muted-foreground truncate max-w-55">{clientName}</p>
                        )}
                    </div>
                    <Button size="icon" variant="ghost" onClick={newEntry}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex-1 overflow-auto">
                    {isLoading && (
                        <div className="p-4 text-sm text-muted-foreground">Loading entries...</div>
                    )}
                    {!isLoading && entries.length === 0 && (
                        <div className="p-4 text-sm text-muted-foreground">No entries yet. Click + to add one.</div>
                    )}
                    {entries.map((entry) => {
                        const preview = getPlainText(entry.content)
                        return (
                            <div
                                key={entry.id}
                                onClick={() => loadEntry(entry)}
                                className={`p-4 border-b cursor-pointer hover:bg-muted ${selectedEntryId === entry.id ? "bg-muted" : ""}`}
                            >
                                <p className="font-medium text-sm truncate">
                                    {entry.heading ? entry.heading : formatDateDisplay(entry.entryDate)}
                                </p>
                                {entry.heading && (
                                    <p className="text-xs text-muted-foreground">{formatDateDisplay(entry.entryDate)}</p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    Updated: {new Date(entry.updatedAt).toLocaleDateString()}
                                </p>
                                <p className="text-xs mt-1 line-clamp-2 text-muted-foreground">{preview}</p>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Right Editor Panel */}
            <div className="flex-1 flex flex-col">
                {/* Toolbar */}
                <div className="border-b p-4 flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => runEditorCommand("bold")}>
                        <Bold className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => runEditorCommand("italic")}>
                        <Italic className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => runEditorCommand("underline")}>
                        <Underline className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => runEditorCommand("insertUnorderedList")}>
                        <List className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => runEditorCommand("insertOrderedList")}>
                        <ListOrdered className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => runEditorCommand("formatBlock", "<h1>")}>
                        <Heading1 className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => runEditorCommand("formatBlock", "<h2>")}>
                        <Heading2 className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={handleSave}>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleDelete} disabled={!selectedEntryId}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                    </Button>
                    <Button
                        size="sm"
                        variant={autoSaveEnabled ? "default" : "outline"}
                        onClick={() => setAutoSaveEnabled((prev) => !prev)}
                    >
                        Auto-save {autoSaveEnabled ? "On" : "Off"}
                    </Button>
                    {autoSaveEnabled && (
                        <span className="text-xs text-muted-foreground self-center">
                            {isSaving ? "Saving..." : lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString()}` : ""}
                        </span>
                    )}
                </div>

                {/* Heading Input */}
                <div className="px-6 pt-5 pb-2">
                    <input
                        type="text"
                        value={draftHeading}
                        onChange={(e) => setDraftHeading(e.target.value)}
                        placeholder="Entry heading (optional)"
                        className="w-full text-xl font-semibold bg-transparent border-none outline-none placeholder:text-muted-foreground/50 text-foreground"
                    />
                </div>

                {/* Date Picker */}
                <div className="px-6 pb-3 flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">Entry date:</span>
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className={cn("justify-start text-left font-normal", !draftEntryDate && "text-muted-foreground")}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {draftEntryDate ? draftEntryDate.toLocaleDateString() : "Pick a date"}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={draftEntryDate}
                                onSelect={(date) => {
                                    if (date) setDraftEntryDate(date)
                                    setIsCalendarOpen(false)
                                }}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="border-b" />

                {/* Editor */}
                <div className="flex-1 overflow-auto relative">
                    <div
                        ref={editorRef}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={handleEditorInput}
                        className="p-6 min-h-full outline-none text-sm leading-7"
                    />
                    {!getPlainText(draftHtml) && (
                        <p className="absolute top-6 left-6 text-sm text-muted-foreground pointer-events-none">
                            Write your diary entry here...
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
