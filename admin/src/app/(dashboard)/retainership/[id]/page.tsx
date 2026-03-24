"use client"

import { useState, useEffect, useRef, type ClipboardEvent, type RefObject } from "react"
import { use } from "react"
import { toast } from "react-toastify"

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button";
import {
    MoreHorizontal,
    Eye,
    Edit,
    PlusCircle,
    Pen,
    Trash,
    Loader2,
    Save,
    Bold,
    Italic,
    Underline,
    List,
    ListOrdered,
    Heading1,
    Heading2,
    Undo2,
    Eraser,
    CalendarIcon,
    NotebookPen,
} from "lucide-react";

// Importing Retainership, Task, and UserInfo types from the types file
import { Retainership } from "@/types";
import { Calendar, Clock, FileText, Tag, User } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { fetchWithAuth } from "@/lib/fetchWithAuth"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

type ClientDiaryEntry = {
    id: string
    clientId: string
    entryDate: string
    content: string
    createdAt: string
    updatedAt: string
}

type LegislationModalFormData = {
    id?: string
    title: string
    description: string
    assignedAgent: string
}

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/

const normalizeDiaryEntryDate = (rawDate: string) => {
    const trimmedDate = rawDate.trim()
    if (!trimmedDate) return ""

    if (DATE_ONLY_REGEX.test(trimmedDate)) {
        return trimmedDate
    }

    const parsed = new Date(trimmedDate)
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10)
    }

    return trimmedDate.includes("T") ? trimmedDate.split("T")[0] : trimmedDate
}

const normalizeDiaryEntries = (entries: ClientDiaryEntry[]) => {
    return entries.map((entry) => ({
        ...entry,
        entryDate: normalizeDiaryEntryDate(entry.entryDate),
    }))
}

const getDiaryPreviewText = (htmlContent: string) => {
    if (!htmlContent) return ""
    return htmlContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

export default function RetainershipDetail({ params }: { params: Promise<{ id: string }> | { id: string } }) {
    // Helper to render the creator label (name + (Owner/Admin/Agent))
    const renderCreatedBy = () => {
        if (!retainership?.createdBy) return "Unknown";
        return (
            <span>
                {retainership.createdBy}
                {retainership.createdByType === "agent" && (
                    <span className="ml-1 text-xs text-blue-600">(Agent)</span>
                )}
                {retainership.createdByType === "user" && retainership.createdByRole === "owner" && (
                    <span className="ml-1 text-xs text-purple-600">(Owner)</span>
                )}
                {retainership.createdByType === "user" && retainership.createdByRole === "admin" && (
                    <span className="ml-1 text-xs text-green-600">(Admin)</span>
                )}
            </span>
        );
    };

    const router = useRouter()
    const resolvedParams = params instanceof Promise ? use(params) : params;
    const [isEdit, setIsEdit] = useState(false)
    const [retainership, setRetainership] = useState<Retainership | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalAgentSearch, setModalAgentSearch] = useState("");
    const [agents, setAgents] = useState<any[]>([]);
    const [showModalAgentDropdown, setShowModalAgentDropdown] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isClientDiaryOpen, setIsClientDiaryOpen] = useState(false)
    const [selectedDiaryDate, setSelectedDiaryDate] = useState("")
    const [diaryEntries, setDiaryEntries] = useState<ClientDiaryEntry[]>([])
    const [isDiaryLoading, setIsDiaryLoading] = useState(false)
    const [isDiarySubmitting, setIsDiarySubmitting] = useState(false)
    const [isAddDiaryModalOpen, setIsAddDiaryModalOpen] = useState(false)
    const [isUpdateDiaryModalOpen, setIsUpdateDiaryModalOpen] = useState(false)
    const [isViewDiaryModalOpen, setIsViewDiaryModalOpen] = useState(false)
    const [selectedDiaryEntryForUpdate, setSelectedDiaryEntryForUpdate] = useState<ClientDiaryEntry | null>(null)
    const [selectedDiaryEntryForView, setSelectedDiaryEntryForView] = useState<ClientDiaryEntry | null>(null)
    const [addDiaryDraft, setAddDiaryDraft] = useState("")
    const [addDiaryDate, setAddDiaryDate] = useState<Date | undefined>(new Date())
    const [updateDiaryDraft, setUpdateDiaryDraft] = useState("")
    const [updateDiaryDate, setUpdateDiaryDate] = useState<Date | undefined>(new Date())
    const [isFilterCalendarOpen, setIsFilterCalendarOpen] = useState(false)
    const [isAddCalendarOpen, setIsAddCalendarOpen] = useState(false)
    const [isUpdateCalendarOpen, setIsUpdateCalendarOpen] = useState(false)
    const addDiaryEditorRef = useRef<HTMLDivElement>(null)
    const updateDiaryEditorRef = useRef<HTMLDivElement>(null)
    const [modalFormData, setModalFormData] = useState<LegislationModalFormData>({
        title: "",
        description: "",
        assignedAgent: "",
    });
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        const fetchData = async () => {
            try {
                const retainershipId = resolvedParams.id;
                const retainershipResponse = await fetch(`/api/retainerships/${retainershipId}`);

                if (!retainershipResponse.ok) {
                    throw new Error("Failed to fetch retainership");
                }

                const retainershipData = await retainershipResponse.json();
                setRetainership({
                    ...retainershipData,
                    client: retainershipData.client || null
                });

                const tasksResponse = await fetch(`/api/tasks?retainershipId=${retainershipId}`);

                if (tasksResponse.ok) {
                } else {
                    console.error("Error fetching tasks:", await tasksResponse.text());
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
                toast.error(`Failed to load retainership: ${errorMessage}`);
                setRetainership(null);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [resolvedParams.id]);

    useEffect(() => {
        const fetchClientsAndAgents = async () => {
            try {
                const [agentsResponse] = await Promise.all([
                    fetchWithAuth('/api/agents'),
                ]);

                if (!agentsResponse.ok) {
                    throw new Error('Failed to fetch data');
                }

                const agentsData: any = await agentsResponse.json();

                setAgents(agentsData);
            } catch (err) {
                toast.error(err instanceof Error ? err.message : 'An error occurred');
            }
        };

        fetchClientsAndAgents();
    }, []);

    const filteredModalAgents = modalAgentSearch
        ? agents.filter(
            (agent) =>
                agent.name.toLowerCase().includes(modalAgentSearch.toLowerCase()) ||
                agent.email.toLowerCase().includes(modalAgentSearch.toLowerCase())
        )
        : [];

    const handleModalAgentSelect = (agent: any) => {
        setModalFormData((prev) => ({ ...prev, assignedAgent: agent.name }));
        setModalAgentSearch(agent.name);
        setShowModalAgentDropdown(false);
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/legislation/${id}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                throw new Error("Failed to delete legislation");
            }

            setRetainership((prev) => {
                if (!prev) return prev;

                return {
                    ...prev,
                    legislation: prev.legislation.filter(
                        (leg) => leg.id !== id
                    ),
                };
            });
        } catch (error) {
            console.error("Error deleting legislation:", error);
        }
    };

    const formatDateString = (date: Date) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, "0")
        const day = String(date.getDate()).padStart(2, "0")
        return `${year}-${month}-${day}`
    }

    const parseDateString = (dateString: string) => {
        if (!dateString) return undefined
        const [year, month, day] = dateString.split("-").map(Number)
        if (!year || !month || !day) return undefined
        return new Date(year, month - 1, day)
    }

    const getClientDisplayName = () => {
        if (!retainership?.client) return "Unknown client"
        return retainership.client.organizationName || `${retainership.client.firstName || ""} ${retainership.client.lastName || ""}`.trim()
    }

    const fetchDiaryEntries = async (clientId: string, date?: string) => {
        setIsDiaryLoading(true)
        try {
            const query = date ? `?date=${encodeURIComponent(date)}` : ""
            const response = await fetch(`/api/clients/${clientId}/diary${query}`, {
                method: "GET",
                cache: "no-store",
            })

            if (!response.ok) {
                console.error("Failed to fetch diary entries")
                setDiaryEntries([])
                return
            }

            const data = await response.json()
            const entries = Array.isArray(data.entries) ? data.entries : []
            setDiaryEntries(normalizeDiaryEntries(entries))
        } catch (error) {
            console.error("Error fetching diary entries:", error)
            setDiaryEntries([])
        } finally {
            setIsDiaryLoading(false)
        }
    }

    const openClientDiary = () => {
        if (!retainership?.client?.id) return
        setSelectedDiaryDate("")
        setAddDiaryDate(new Date())
        setUpdateDiaryDate(new Date())
        setAddDiaryDraft("")
        setUpdateDiaryDraft("")
        setSelectedDiaryEntryForUpdate(null)
        setSelectedDiaryEntryForView(null)
        setIsClientDiaryOpen(true)
    }

    useEffect(() => {
        if (!isClientDiaryOpen || !retainership?.client?.id) return;
        fetchDiaryEntries(retainership.client.id, selectedDiaryDate || undefined)
    }, [isClientDiaryOpen, retainership?.client?.id, selectedDiaryDate])

    const diaryEntriesForSelection = diaryEntries
        .filter(
            (entry) =>
                entry.clientId === retainership?.client?.id &&
                (!selectedDiaryDate || normalizeDiaryEntryDate(entry.entryDate) === selectedDiaryDate),
        )
        .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))

    const runEditorCommand = (
        editorRef: RefObject<HTMLDivElement | null>,
        setDraft: (value: string) => void,
        command: string,
        value?: string,
    ) => {
        if (!editorRef.current) return
        editorRef.current.focus()
        document.execCommand(command, false, value)
        setDraft(editorRef.current.innerHTML)
    }

    const handleDiaryEditorInput = (
        editorRef: RefObject<HTMLDivElement | null>,
        setDraft: (value: string) => void,
    ) => {
        if (!editorRef.current) return
        setDraft(editorRef.current.innerHTML)
    }

    const handleDiaryEditorPaste = (event: ClipboardEvent<HTMLDivElement>) => {
        event.preventDefault()
        const text = event.clipboardData.getData("text/plain")
        document.execCommand("insertText", false, text)
    }

    useEffect(() => {
        if (!addDiaryEditorRef.current) return
        if (addDiaryEditorRef.current.innerHTML !== addDiaryDraft) {
            addDiaryEditorRef.current.innerHTML = addDiaryDraft
        }
    }, [addDiaryDraft])

    useEffect(() => {
        if (!isUpdateDiaryModalOpen) return

        const rafId = requestAnimationFrame(() => {
            if (!updateDiaryEditorRef.current) return
            if (updateDiaryEditorRef.current.innerHTML !== updateDiaryDraft) {
                updateDiaryEditorRef.current.innerHTML = updateDiaryDraft
            }
        })

        return () => cancelAnimationFrame(rafId)
    }, [isUpdateDiaryModalOpen, updateDiaryDraft, selectedDiaryEntryForUpdate?.id])

    const openAddDiaryModal = () => {
        setAddDiaryDraft("")
        setAddDiaryDate(new Date())
        setIsAddDiaryModalOpen(true)
    }

    const openUpdateDiaryModal = (entry: ClientDiaryEntry) => {
        setSelectedDiaryEntryForUpdate(entry)
        setUpdateDiaryDraft(entry.content || "")
        setUpdateDiaryDate(parseDateString(normalizeDiaryEntryDate(entry.entryDate)))
        setIsUpdateDiaryModalOpen(true)
    }

    const openViewDiaryModal = (entry: ClientDiaryEntry) => {
        setSelectedDiaryEntryForView(entry)
        setIsViewDiaryModalOpen(true)
    }

    const handleCreateDiaryEntry = async () => {
        const normalizedDraft = getDiaryPreviewText(addDiaryDraft)
        if (!retainership?.client?.id || !normalizedDraft || !addDiaryDate) return

        setIsDiarySubmitting(true)
        try {
            const response = await fetch(`/api/clients/${retainership.client.id}/diary`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    entryDate: formatDateString(addDiaryDate),
                    content: addDiaryDraft,
                }),
            })

            if (!response.ok) {
                console.error("Failed to create diary entry")
                return
            }

            setAddDiaryDraft("")
            setSelectedDiaryDate(formatDateString(addDiaryDate))
            setIsAddDiaryModalOpen(false)
            await fetchDiaryEntries(retainership.client.id, formatDateString(addDiaryDate))
        } catch (error) {
            console.error("Error creating diary entry:", error)
        } finally {
            setIsDiarySubmitting(false)
        }
    }

    const handleUpdateDiaryEntry = async () => {
        const normalizedDraft = getDiaryPreviewText(updateDiaryDraft)
        if (!selectedDiaryEntryForUpdate || !retainership?.client?.id || !normalizedDraft || !updateDiaryDate) return

        setIsDiarySubmitting(true)
        try {
            const response = await fetch(
                `/api/clients/${retainership.client.id}/diary/${selectedDiaryEntryForUpdate.id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        entryDate: formatDateString(updateDiaryDate),
                        content: updateDiaryDraft,
                    }),
                },
            )

            if (!response.ok) {
                console.error("Failed to update diary entry")
                return
            }

            setSelectedDiaryDate(formatDateString(updateDiaryDate))
            setIsUpdateDiaryModalOpen(false)
            setSelectedDiaryEntryForUpdate(null)
            await fetchDiaryEntries(retainership.client.id, formatDateString(updateDiaryDate))
        } catch (error) {
            console.error("Error updating diary entry:", error)
        } finally {
            setIsDiarySubmitting(false)
        }
    }

    const handleSubmit = async () => {
        try {
            setIsSubmitting(true)
            if (isEdit) {
                const res = await fetch(`/api/legislation/${modalFormData.id}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        title: modalFormData.title,
                        description: modalFormData.description,
                        assignedAgentId: agents.find(agent => agent.name === modalFormData.assignedAgent)?.id,
                    }),
                });

                if (!res.ok) {
                    const errorText = await res.text();
                    throw new Error(errorText || "Failed to create legislation");
                }

                const data = await res.json();

                setRetainership((prev) => {
                    if (!prev) return prev;

                    const agent = agents.find(a => a.name === modalFormData.assignedAgent);

                    return {
                        ...prev,
                        legislation: prev.legislation.map((leg) =>
                            leg.id === data.id
                                ? {
                                    ...leg,
                                    title: modalFormData.title,
                                    description: modalFormData.description,
                                    assignedAgentId: agent?.id ?? "",
                                    assignedAgent: agent
                                        ? {
                                            id: agent.id,
                                            name: agent.name,
                                            email: agent.email,
                                        }
                                        : undefined,
                                }
                                : leg
                        ),
                    };
                });


            } else {
                const res = await fetch("/api/legislation", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        title: modalFormData.title,
                        retainershipId: resolvedParams.id,
                        description: modalFormData.description,
                        assignedAgentId: agents.find(agent => agent.name === modalFormData.assignedAgent)?.id,
                    }),
                });

                if (!res.ok) {
                    const errorText = await res.text();
                    throw new Error(errorText || "Failed to create legislation");
                }

                const data = await res.json();

                setRetainership((prev) => {
                    if (!prev) return prev;

                    const agent = agents.find(
                        (a) => a.name === modalFormData.assignedAgent
                    );
                    return {
                        ...prev,
                        legislation: [
                            {
                                id: data?.id,
                                title: modalFormData.title,
                                description: modalFormData.description,
                                assignedAgentId: agent?.id ?? "",
                                assignedAgent: agent
                                    ? {
                                        id: agent.id,
                                        name: agent.name,
                                        email: agent.email,
                                    }
                                    : undefined,
                            },
                            ...prev.legislation,
                        ],
                    };
                });

                toast.success("Legislation added successfully");
            }
        } catch (error) {
            toast.error("Something went wrong");
        } finally {
            setIsSubmitting(false)
            setIsModalOpen(false)
            setModalFormData({
                title: "",
                description: "",
                assignedAgent: "",
            })
            setIsEdit(false)
        }
    };

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

                    <Card className="mt-[20px]">
                        <CardContent className="p-6 mt-[30px]">
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


            </div>
        )
    }

    if (!retainership) {
        return (
            <div className="container mx-auto p-6 max-w-7xl">
                <div className="text-center py-20">
                    <p className="text-muted-foreground">Retainership not found</p>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-[28px] md:text-3xl font-bold">Retainership Details</h1>
                        <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
                            Comprehensive view of retainership details and associated tasks
                        </p>
                    </div>
                </div>

                <div className="mb-8">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between gap-4">
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="h-5 w-5" />
                                        Retainership Details
                                    </CardTitle>
                                    {retainership.client?.id && (
                                        <Button variant="outline" onClick={openClientDiary}>
                                            Client Diary
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <Avatar className="h-16 w-16">
                                        <AvatarImage src={retainership.photo || ""} />
                                        <AvatarFallback className="text-lg">
                                            {retainership.name
                                                .toUpperCase()
                                                .split(" ")
                                                .map((n) => n[0])
                                                .join("")}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h2 className="text-2xl font-semibold">{retainership.name}</h2>
                                            <Badge
                                                variant="secondary"
                                                className={retainership.status === "approved"
                                                    ? "bg-green-100 text-green-800"
                                                    : "bg-yellow-100 text-yellow-800"
                                                }
                                            >
                                                {retainership.status === "approved" ? "Approved" : "Pending Approval"}
                                            </Badge>
                                        </div>
                                        <p className="text-muted-foreground mb-4">{retainership.description}</p>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                <span>Created by: {renderCreatedBy()}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                <span>Created: {new Date(retainership.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-muted-foreground" />
                                                <span>Updated: {new Date(retainership.updatedAt).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Tag className="h-4 w-4 text-muted-foreground" />
                                                <span>
                                                    Client: {
                                                        retainership.client
                                                            ? retainership.client.organizationName ||
                                                            `${retainership.client.firstName || ""} ${retainership.client.lastName || ""}`.trim()
                                                            : "Unknown"
                                                    }
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Retainership Legislation
                            </CardTitle>
                            <Button onClick={() => setIsModalOpen(true)}>Add Legislation</Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Legislation Name</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Assigned Agent</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {retainership?.legislation?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                No legislation found for this retainership.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        retainership?.legislation?.map((legislation) => (
                                            <TableRow className="cursor-pointer" key={legislation.id} >
                                                <TableCell onClick={() => router.push(`/legislation/${legislation.id}`)}>
                                                    <div title={legislation.title || ""}>
                                                        {
                                                            legislation.title
                                                                ? (legislation.title.length > 40
                                                                    ? `${legislation.title.slice(0, 40)}...`
                                                                    : legislation.title)
                                                                : "N/A"
                                                        }
                                                    </div>
                                                </TableCell>
                                                <TableCell title={legislation.description || ""} onClick={() => router.push(`/legislation/${legislation.id}`)}>
                                                    {legislation.description?.slice(0, 60)}
                                                    {(legislation.description?.length ?? 0) > 60 && '...'}
                                                </TableCell>
                                                <TableCell onClick={() => router.push(`/legislation/${legislation.id}`)}>
                                                    {typeof legislation.assignedAgent === "string"
                                                        ? legislation.assignedAgent
                                                        : legislation.assignedAgent?.name || "Unknown"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                                <span className="sr-only">Open menu</span>
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>

                                                            <DropdownMenuItem asChild>
                                                                <a href={`/legislation/${legislation.id}`} className="flex items-center">
                                                                    <Eye className="mr-2 h-4 w-4" />
                                                                    View Details
                                                                </a>
                                                            </DropdownMenuItem>

                                                            <DropdownMenuItem asChild>
                                                                <button className="flex items-center w-full" onClick={() => {
                                                                    setIsEdit(true)
                                                                    setModalFormData({
                                                                        id: legislation.id,
                                                                        title: legislation.title,
                                                                        description: legislation.description!,
                                                                        assignedAgent: legislation.assignedAgent?.name || (typeof legislation.assignedAgent === "string" ? legislation.assignedAgent : ""),
                                                                    })
                                                                    setModalAgentSearch(legislation.assignedAgent?.name || legislation?.assignedAgent! as any)
                                                                    setIsModalOpen(true)
                                                                }}>
                                                                    <Pen className="mr-2 h-4 w-4" />
                                                                    Edit
                                                                </button>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem asChild>
                                                                <button className="flex items-center w-full" onClick={() => handleDelete(legislation.id)}>
                                                                    <Trash className="mr-2 h-4 w-4" />
                                                                    Delete
                                                                </button>
                                                            </DropdownMenuItem>

                                                            {retainership.status !== "pending" && (
                                                                <DropdownMenuItem asChild>
                                                                    <a
                                                                        href={`/task/create?legislationId=${legislation.id}&assignedAgent=${legislation.assignedAgentId}&client=${retainership.client?.id}`}
                                                                        className="flex items-center"
                                                                    >
                                                                        <PlusCircle className="mr-2 h-4 w-4" />
                                                                        Create Task
                                                                    </a>
                                                                </DropdownMenuItem>
                                                            )}
                                                        </DropdownMenuContent>

                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card >
            </div >
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{"Add New Legislation"}</DialogTitle>
                        <DialogDescription>
                            {
                                "Fill in the details for the new legislation item."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="modal-title">Legislation Title *</Label>
                            <Input
                                id="modal-title"
                                value={modalFormData.title}
                                onChange={(e) => setModalFormData((prev) => ({ ...prev, title: e.target.value }))}
                                placeholder="Enter legislation title"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="modal-description">Description</Label>
                            <Textarea
                                id="modal-description"
                                value={modalFormData.description}
                                onChange={(e) => setModalFormData((prev) => ({ ...prev, description: e.target.value }))}
                                placeholder="Describe the legislation requirements"
                                rows={3}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="modal-agent">Assigned Agent</Label>
                            <div className="relative">
                                <Input
                                    id="modal-agent"
                                    value={modalAgentSearch}
                                    onChange={(e) => {
                                        setModalAgentSearch(e.target.value);
                                        setModalFormData((prev) => ({ ...prev, assignedAgent: e.target.value }));
                                        setShowModalAgentDropdown(true);
                                    }}
                                    onFocus={() => setShowModalAgentDropdown(true)}
                                    placeholder="Type agent name or select from list..."
                                />
                                {showModalAgentDropdown && modalAgentSearch && filteredModalAgents.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                                        {filteredModalAgents.map((agent) => (
                                            <div
                                                key={agent.id}
                                                className="px-4 py-3 hover:bg-muted cursor-pointer border-b border-border last:border-b-0"
                                                onClick={() => handleModalAgentSelect(agent)}
                                            >
                                                <div className="font-medium">{agent.name}</div>
                                                <div className="text-sm text-muted-foreground">{agent.email}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button disabled={isSubmitting} type="button" onClick={handleSubmit}>
                            {isSubmitting
                                ? (isEdit ? "Updating.." : "Adding..")
                                : (isEdit ? "Edit Legislation" : "Add Legislation")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog
                open={isClientDiaryOpen}
                onOpenChange={(open) => {
                    setIsClientDiaryOpen(open)
                    if (!open) {
                        setSelectedDiaryDate("")
                        setSelectedDiaryEntryForUpdate(null)
                        setSelectedDiaryEntryForView(null)
                        setAddDiaryDraft("")
                        setUpdateDiaryDraft("")
                    }
                }}
            >
                <DialogContent className="w-[90vw] lg:max-w-[90vw] max-h-[90vh] items-start overflow-x-auto p-4 sm:p-6">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <NotebookPen className="h-5 w-5" />
                            Client Diary
                        </DialogTitle>
                        <DialogDescription>
                            {retainership.client
                                ? `Diary for ${getClientDisplayName()}. Choose Add New or Update Existing.`
                                : "Select a client to manage diary notes."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="h-full min-h-0 border rounded-lg p-4 overflow-auto bg-slate-50/60 space-y-4">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                            <div className="space-y-2">
                                <Label>Filter by date</Label>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Popover open={isFilterCalendarOpen} onOpenChange={setIsFilterCalendarOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className={cn(
                                                    "w-60 justify-start text-left font-normal",
                                                    !selectedDiaryDate && "text-muted-foreground",
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {selectedDiaryDate
                                                    ? parseDateString(selectedDiaryDate)?.toLocaleDateString()
                                                    : "Select filter date"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <CalendarComponent
                                                mode="single"
                                                selected={selectedDiaryDate ? parseDateString(selectedDiaryDate) : undefined}
                                                onSelect={(date) => {
                                                    setSelectedDiaryDate(date ? formatDateString(date) : "")
                                                    setIsFilterCalendarOpen(false)
                                                }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setSelectedDiaryDate("")}
                                        disabled={!selectedDiaryDate}
                                    >
                                        All Dates
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {selectedDiaryDate ? `Showing entries for ${selectedDiaryDate}` : "Showing entries for all dates"}
                                </p>
                            </div>

                            <Button type="button" onClick={openAddDiaryModal} className="w-full lg:w-auto" disabled={isDiaryLoading || isDiarySubmitting}>
                                <PlusCircle className="h-4 w-4 mr-2" />
                                Add New Entry
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm">Entries ({diaryEntriesForSelection.length})</Label>
                            {isDiaryLoading ? (
                                <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground bg-white flex items-center justify-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading diary entries...
                                </div>
                            ) : diaryEntriesForSelection.length === 0 ? (
                                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground bg-white">
                                    {selectedDiaryDate
                                        ? "No diary entries for selected date. Use Add New Entry to create one."
                                        : "No diary entries found yet. Use Add New Entry to create your first one."}
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[58vh] overflow-auto pr-1">
                                    {diaryEntriesForSelection.map((entry, index) => (
                                        <div key={entry.id} className="rounded-md border p-3 bg-white">
                                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-xs text-muted-foreground">Date: {normalizeDiaryEntryDate(entry.entryDate)}</p>
                                                    <p className="text-xs text-muted-foreground">Entry {diaryEntriesForSelection.length - index}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Updated: {new Date(entry.updatedAt).toLocaleString()}
                                                    </p>
                                                    <p className="text-sm mt-2 line-clamp-3">{getDiaryPreviewText(entry.content)}</p>
                                                </div>
                                                <div className="flex w-full sm:w-auto flex-col gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full sm:w-auto"
                                                        onClick={() => openViewDiaryModal(entry)}
                                                    >
                                                        <Eye className="h-4 w-4 mr-2" />
                                                        View
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full sm:w-auto"
                                                        disabled={isDiarySubmitting}
                                                        onClick={() => openUpdateDiaryModal(entry)}
                                                    >
                                                        <Edit className="h-4 w-4 mr-2" />
                                                        Update Existing
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={() => setIsClientDiaryOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={isAddDiaryModalOpen}
                onOpenChange={(open) => {
                    setIsAddDiaryModalOpen(open)
                    if (!open) {
                        setAddDiaryDraft("")
                        setAddDiaryDate(new Date())
                    }
                }}
            >
                <DialogContent className="w-[90vw] lg:max-w-[90vw] max-h-[90vh] overflow-x-auto p-4 sm:p-6">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <PlusCircle className="h-5 w-5" />
                            Add New Diary Entry
                        </DialogTitle>
                        <DialogDescription>
                            Create a new rich text diary entry.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col min-h-0 h-full gap-3">
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="space-y-2">
                                <Label>Entry Date</Label>
                                <Popover open={isAddCalendarOpen} onOpenChange={setIsAddCalendarOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className={cn(
                                                "w-60 justify-start text-left font-normal",
                                                !addDiaryDate && "text-muted-foreground",
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {addDiaryDate ? addDiaryDate.toLocaleDateString() : "Select entry date"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <CalendarComponent
                                            mode="single"
                                            selected={addDiaryDate}
                                            onSelect={(date) => {
                                                setAddDiaryDate(date)
                                                setIsAddCalendarOpen(false)
                                            }}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 rounded-md border p-2 bg-muted/30">
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(addDiaryEditorRef, setAddDiaryDraft, "bold")}>
                                <Bold className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(addDiaryEditorRef, setAddDiaryDraft, "italic")}>
                                <Italic className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(addDiaryEditorRef, setAddDiaryDraft, "underline")}>
                                <Underline className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(addDiaryEditorRef, setAddDiaryDraft, "insertUnorderedList")}>
                                <List className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(addDiaryEditorRef, setAddDiaryDraft, "insertOrderedList")}>
                                <ListOrdered className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(addDiaryEditorRef, setAddDiaryDraft, "formatBlock", "<h1>")}>
                                <Heading1 className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(addDiaryEditorRef, setAddDiaryDraft, "formatBlock", "<h2>")}>
                                <Heading2 className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(addDiaryEditorRef, setAddDiaryDraft, "undo")}>
                                <Undo2 className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(addDiaryEditorRef, setAddDiaryDraft, "removeFormat")}>
                                <Eraser className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="relative flex-1 min-h-105 rounded-md border bg-background">
                            <div
                                ref={addDiaryEditorRef}
                                contentEditable
                                suppressContentEditableWarning
                                onInput={() => handleDiaryEditorInput(addDiaryEditorRef, setAddDiaryDraft)}
                                onPaste={handleDiaryEditorPaste}
                                className="h-full w-full overflow-auto p-4 text-sm leading-7 focus-visible:outline-none"
                            />
                            {!getDiaryPreviewText(addDiaryDraft) && (
                                <p className="pointer-events-none absolute left-4 top-4 text-sm text-muted-foreground">
                                    Write client diary notes here...
                                </p>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={() => setIsAddDiaryModalOpen(false)} disabled={isDiarySubmitting}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleCreateDiaryEntry} disabled={isDiarySubmitting || !getDiaryPreviewText(addDiaryDraft) || !addDiaryDate || !retainership?.client?.id}>
                            {isDiarySubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            {isDiarySubmitting ? "Saving..." : "Save Entry"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={isViewDiaryModalOpen}
                onOpenChange={(open) => {
                    setIsViewDiaryModalOpen(open)
                    if (!open) {
                        setSelectedDiaryEntryForView(null)
                    }
                }}
            >
                <DialogContent className="w-[90vw] lg:max-w-[90vw] max-h-[90vh] overflow-x-auto p-4 sm:p-6">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Eye className="h-5 w-5" />
                            View Diary Entry
                        </DialogTitle>
                        <DialogDescription>
                            {selectedDiaryEntryForView
                                ? `Date: ${normalizeDiaryEntryDate(selectedDiaryEntryForView.entryDate)} | Last updated: ${new Date(selectedDiaryEntryForView.updatedAt).toLocaleString()}`
                                : "Select a diary entry to view details."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-65 max-h-[62vh] overflow-auto rounded-md border bg-background p-4">
                        {selectedDiaryEntryForView ? (
                            <div
                                className="prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: selectedDiaryEntryForView.content || "" }}
                            />
                        ) : (
                            <p className="text-sm text-muted-foreground">No diary entry selected.</p>
                        )}
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={() => setIsViewDiaryModalOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={isUpdateDiaryModalOpen}
                onOpenChange={(open) => {
                    setIsUpdateDiaryModalOpen(open)
                    if (!open) {
                        setSelectedDiaryEntryForUpdate(null)
                        setUpdateDiaryDraft("")
                        setUpdateDiaryDate(new Date())
                    }
                }}
            >
                <DialogContent className="w-[90vw] lg:max-w-[90vw] max-h-[90vh] overflow-x-auto p-4 sm:p-6">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Edit className="h-5 w-5" />
                            Update Existing Entry
                        </DialogTitle>
                        <DialogDescription>
                            Edit content and date, then save updates.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col min-h-0 h-full gap-3">
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="space-y-2">
                                <Label>Entry Date</Label>
                                <Popover open={isUpdateCalendarOpen} onOpenChange={setIsUpdateCalendarOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className={cn(
                                                "w-60 justify-start text-left font-normal",
                                                !updateDiaryDate && "text-muted-foreground",
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {updateDiaryDate ? updateDiaryDate.toLocaleDateString() : "Select entry date"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <CalendarComponent
                                            mode="single"
                                            selected={updateDiaryDate}
                                            onSelect={(date) => {
                                                setUpdateDiaryDate(date)
                                                setIsUpdateCalendarOpen(false)
                                            }}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 rounded-md border p-2 bg-muted/30">
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(updateDiaryEditorRef, setUpdateDiaryDraft, "bold")}>
                                <Bold className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(updateDiaryEditorRef, setUpdateDiaryDraft, "italic")}>
                                <Italic className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(updateDiaryEditorRef, setUpdateDiaryDraft, "underline")}>
                                <Underline className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(updateDiaryEditorRef, setUpdateDiaryDraft, "insertUnorderedList")}>
                                <List className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(updateDiaryEditorRef, setUpdateDiaryDraft, "insertOrderedList")}>
                                <ListOrdered className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(updateDiaryEditorRef, setUpdateDiaryDraft, "formatBlock", "<h1>")}>
                                <Heading1 className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(updateDiaryEditorRef, setUpdateDiaryDraft, "formatBlock", "<h2>")}>
                                <Heading2 className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(updateDiaryEditorRef, setUpdateDiaryDraft, "undo")}>
                                <Undo2 className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => runEditorCommand(updateDiaryEditorRef, setUpdateDiaryDraft, "removeFormat")}>
                                <Eraser className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="relative flex-1 min-h-105 rounded-md border bg-background">
                            <div
                                ref={updateDiaryEditorRef}
                                contentEditable
                                suppressContentEditableWarning
                                onInput={() => handleDiaryEditorInput(updateDiaryEditorRef, setUpdateDiaryDraft)}
                                onPaste={handleDiaryEditorPaste}
                                className="h-full w-full overflow-auto p-4 text-sm leading-7 focus-visible:outline-none"
                            />
                            {!getDiaryPreviewText(updateDiaryDraft) && (
                                <p className="pointer-events-none absolute left-4 top-4 text-sm text-muted-foreground">
                                    Write client diary notes here...
                                </p>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={() => setIsUpdateDiaryModalOpen(false)} disabled={isDiarySubmitting}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleUpdateDiaryEntry} disabled={isDiarySubmitting || !getDiaryPreviewText(updateDiaryDraft) || !updateDiaryDate || !selectedDiaryEntryForUpdate}>
                            {isDiarySubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            {isDiarySubmitting ? "Updating..." : "Update Entry"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
