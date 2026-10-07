"use client"

import { useState, useEffect } from "react"
import { use } from "react"
import { toast } from "react-toastify"

// UI Components
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton";
import { SectionTable } from "@/components/SectionTable"

// Icons
import {
    Calendar,
    User,
    Clock,
    Tag,
    FileText,
    Users,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { clientDisplayName } from "@/lib/entityNames"
import { Task } from "@/types"

export interface TaskCategory {
    id: string
    name: string
    description: string
    color: string
    status: "approved" | "pending"
    taskCount: number
    createdAt: string
    updatedAt: string
    createdBy: string
    createdById: string
    createdByType?: "user" | "agent" | null;
    createdByRole?: "owner" | "admin" | null;
    approvedBy?: string | null
    approvedById?: string | null
    approvedAt?: string | null
    rejectedBy?: string | null
    rejectedById?: string | null
    rejectedAt?: string | null
    rejectionReason?: string | null
    photo?: string
}

type TaskClient = NonNullable<Task["client"]>

// Same buckets as the agent and client task views, so a section here holds
// the same rows its "View more" list does.
function statusKey(s?: string) {
    const k = (s || "").toLowerCase().replace(/\s+/g, "")
    if (["todo", "pending"].includes(k)) return "todo"
    if (["inprogress", "progress"].includes(k)) return "inprogress"
    if (["completed"].includes(k)) return "completed"
    if (["hold"].includes(k)) return "hold"
    return k || "todo"
}

const STATUS_SECTIONS = [
    { label: "New Task", key: "todo", status: "To Do" },
    { label: "In Progress", key: "inprogress", status: "In Progress" },
    { label: "Completed", key: "completed", status: "Completed" },
    { label: "Hold", key: "hold", status: "Hold" },
] as const

export default function CategoryDetail({ params }: { params: Promise<{ id: string }> | { id: string } }) {

    const renderCreatedBy = () => {
        if (!category?.createdBy) return "Unknown";
        return (
            <span>
                {category.createdBy}
                {category.createdByType === "agent" && (
                    <span className="ml-1 text-xs text-blue-600">(Agent)</span>
                )}
                {category.createdByType === "user" && category.createdByRole === "owner" && (
                    <span className="ml-1 text-xs text-purple-600">(Owner)</span>
                )}
                {category.createdByType === "user" && category.createdByRole === "admin" && (
                    <span className="ml-1 text-xs text-green-600">(Admin)</span>
                )}
            </span>
        );
    };
    // Unwrap params using React.use() to future-proof the code
    const router = useRouter()
    const resolvedParams = params instanceof Promise ? use(params) : params
    const [category, setCategory] = useState<TaskCategory | null>(null)
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("tasks")

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch category from API
                const categoryId = resolvedParams.id
                const categoryResponse = await fetch(`/api/task-categories/${categoryId}`)

                if (!categoryResponse.ok) {
                    throw new Error('Failed to fetch category')
                }

                const categoryData = await categoryResponse.json()
                setCategory(categoryData)

                // Fetch tasks associated with this category
                const tasksResponse = await fetch(`/api/tasks?categoryId=${categoryId}`)

                if (tasksResponse.ok) {
                    const tasksData = await tasksResponse.json()
                    setTasks(tasksData)
                } else {
                    console.error("Error fetching tasks:", await tasksResponse.text())
                    setTasks([])
                }
            } catch (error) {
                console.error("Error fetching data:", error)
                const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
                toast.error(`Failed to load category: ${errorMessage}`)
                setCategory(null)
                setTasks([])
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [resolvedParams.id])

    // Distinct clients this service's tasks are for, with how many tasks each.
    const serviceClients = Array.from(
        tasks.reduce((byId, task) => {
            if (!task.client) return byId
            const entry = byId.get(task.client.id)
            if (entry) entry.taskCount += 1
            else byId.set(task.client.id, { client: task.client, taskCount: 1 })
            return byId
        }, new Map<string, { client: TaskClient; taskCount: number }>()).values(),
    ).sort((a, b) => clientDisplayName(a.client).localeCompare(clientDisplayName(b.client)))

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

    if (!category) {
        return (
            <div className="container mx-auto p-6 max-w-7xl">
                <div className="text-center py-20">
                    <p className="text-muted-foreground">Category not found</p>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-[28px] md:text-3xl font-bold">Service Details</h1>
                        <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
                            Comprehensive view of service details and associated tasks
                        </p>
                    </div>
                </div>

                <div className=" mb-8">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    Service Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <Avatar className="h-16 w-16">
                                        <AvatarImage src={category.photo || ""} />
                                        <AvatarFallback className="text-lg">
                                            {category.name
                                                .toUpperCase()
                                                .split(" ")
                                                .map((n) => n[0])
                                                .join("")}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h2 className="text-2xl font-semibold">{category.name}</h2>
                                            <Badge
                                                variant="secondary"
                                                className={category.status === "approved"
                                                    ? "bg-green-100 text-green-800"
                                                    : "bg-yellow-100 text-yellow-800"
                                                }
                                            >
                                                {category.status === "approved" ? "Approved" : "Pending Approval"}
                                            </Badge>
                                        </div>
                                        <p className="text-muted-foreground mb-4">{category.description}</p>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div className="flex items-center gap-2">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                <span>Created by: {renderCreatedBy()}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                <span>Created: {new Date(category.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-muted-foreground" />
                                                <span>Updated: {new Date(category.updatedAt).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Tag className="h-4 w-4 text-muted-foreground" />
                                                <span>Tasks: {tasks.length}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Users className="h-4 w-4 text-muted-foreground" />
                                                <span>Clients: {serviceClients.length}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <TabsList className="grid h-auto w-full md:w-auto grid-cols-2">
                            <TabsTrigger value="tasks" className="flex items-center gap-1 px-4 py-2">
                                <FileText className="h-4 w-4" />
                                Tasks ({tasks.length})
                            </TabsTrigger>
                            <TabsTrigger value="clients" className="flex items-center gap-1 px-4 py-2">
                                <Users className="h-4 w-4" />
                                Clients ({serviceClients.length})
                            </TabsTrigger>
                        </TabsList>
                        <Button onClick={() => router.push(`/task/create?serviceId=${resolvedParams.id}`)}>Add Task</Button>
                    </div>

                    <TabsContent value="tasks" className="space-y-6">
                        {tasks.length === 0 ? (
                            <Card>
                                <CardContent className="text-center py-8 text-muted-foreground">
                                    No tasks found in this service.
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-[40px]">
                                {STATUS_SECTIONS.map((section) => (
                                    <SectionTable
                                        key={section.key}
                                        label={section.label}
                                        tasks={tasks.filter((task) => statusKey(task.status) === section.key).slice(0, 3)}
                                        viewMoreHref={`/task?categoryId=${resolvedParams.id}&status=${encodeURIComponent(section.status)}`}
                                    />
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="clients" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Users className="h-5 w-5" />
                                    Clients ({serviceClients.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border overflow-x-auto">
                                    <Table className="min-w-[600px]">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Client</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Email</TableHead>
                                                <TableHead className="text-right">Tasks in this service</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {serviceClients.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                        No clients mapped to this service yet.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                serviceClients.map(({ client, taskCount }) => (
                                                    <TableRow
                                                        key={client.id}
                                                        className="cursor-pointer hover:bg-muted/50"
                                                        onClick={() => router.push(`/client/${client.id}/tasks`)}
                                                    >
                                                        <TableCell className="font-medium">{clientDisplayName(client)}</TableCell>
                                                        <TableCell>
                                                            {client.clientType === "organization" ? "Organization" : "Individual"}
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">{client.email || "N/A"}</TableCell>
                                                        <TableCell className="text-right">{taskCount}</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
