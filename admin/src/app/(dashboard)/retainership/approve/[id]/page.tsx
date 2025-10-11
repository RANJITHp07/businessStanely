"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "react-toastify"
import { Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    CheckCircle,
    X,
    MoreHorizontal,
    Eye,
    Calendar,
    User,
    Clock,
    FileText,
} from "lucide-react"
// import Link from "next/link"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export interface Retainership {
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
    approvedBy?: string | null
    approvedById?: string | null
    approvedAt?: string | null
    rejectedBy?: string | null
    rejectedById?: string | null
    rejectedAt?: string | null
    rejectionReason?: string | null
    photo?: string
    legislation?: {
        id: string
        title: string
        description: string
        assignedAgent: string | { name: string }
    }[]
}


// Define user type for assignedTo and assignedBy
interface UserInfo {
    id: string
    name: string
    email: string
    phoneNumber?: string
    secondaryPhoneNumber?: string
    agentType?: string
    barAssociationId?: string
    jurisdiction?: string
    specializations?: string[]
    photo?: string
    createdAt?: string
    updatedAt?: string
    superiorId?: string
}

export interface Task {
    id: string
    title: string
    description: string
    status: "pending" | "in_progress" | "completed" | "cancelled"
    priority: "low" | "medium" | "high" | "urgent"
    assignedTo: string | UserInfo
    assignedToId: string
    assignedBy: string | UserInfo
    assignedById: string
    dueDate: string
    createdAt: string
    updatedAt: string
    retainershipId: string
    retainershipName?: string
    estimatedHours: number
    actualHours?: number
    completionPercent?: number
    tags: string[]
    attachments?: string[]
}



export default function ApproveRetainership({ params }: { params: Promise<{ id: string }> | { id: string } }) {
    // Unwrap params using React.use() to future-proof the code
    const resolvedParams = params instanceof Promise ? use(params) : params
    const router = useRouter()
    const [retainership, setRetainership] = useState<Retainership | null>(null)
    const [loading, setLoading] = useState(true)
    const [approving, setApproving] = useState(false)
    const [rejecting, setRejecting] = useState(false)
    const [rejectionReason, setRejectionReason] = useState("")
    const [showRejectDialog, setShowRejectDialog] = useState(false)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const retainershipId = resolvedParams.id;
                const retainershipResponse = await fetch(`/api/retainerships/${retainershipId}`);

                if (!retainershipResponse.ok) {
                    throw new Error("Failed to fetch retainership");
                }

                const retainershipData = await retainershipResponse.json();
                setRetainership(retainershipData);
            } catch (error) {
                console.error("Error fetching data:", error);
                const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
                toast.error(`Failed to load retainership: ${errorMessage}`);
                setRetainership(null);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [resolvedParams.id]);


    // Apply sorting to tasks
    // const sortedTasks = sortTasks(tasks, sortBy, sortByDate)



    const handleApprove = async () => {
        if (!retainership) return
        setApproving(true)
        try {
            // Call API to approve retainership
            const response = await fetch(`/api/retainerships/${resolvedParams.id}/approve`, {
                method: 'PUT',
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || 'Failed to approve retainership')
            }

            await response.json()

            // Show success message and redirect
            toast.success("Retainership approved successfully")
            // Redirect to the retainership detail page to show the updated status
            router.push(`/retainership/${resolvedParams.id}`)
        } catch (error) {
            console.error("Error approving retainership:", error)
            const errorMessage = error instanceof Error ? error.message : "Failed to approve retainership"
            toast.error(errorMessage)
        } finally {
            setApproving(false)
        }
    }

    const handleReject = async () => {
        if (!retainership || !rejectionReason.trim()) return
        setRejecting(true)
        try {
            // Call API to reject retainership
            const response = await fetch(`/api/retainerships/${resolvedParams.id}/reject`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ rejectionReason }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || 'Failed to reject retainership')
            }

            await response.json()

            // Show success message and redirect
            toast.success("Retainership rejected successfully")
            setShowRejectDialog(false)
            // Redirect to the retainership detail page to show the updated status
            router.push(`/retainership`)
        } catch (error) {
            console.error("Error rejecting retainership:", error)
            const errorMessage = error instanceof Error ? error.message : "Failed to reject retainership"
            toast.error(errorMessage)
        } finally {
            setRejecting(false)
        }
    }

    // Badge components
    // const getPriorityBadge = (priority: string) => {
    //     const colors = {
    //         low: "bg-gray-100 text-gray-800",
    //         medium: "bg-blue-100 text-blue-800",
    //         high: "bg-orange-100 text-orange-800",
    //         urgent: "bg-red-100 text-red-800",
    //     }
    //     return <Badge className={colors[priority as keyof typeof colors]}>{priority}</Badge>
    // }

    if (loading) {
        return (
            <div className="container mx-auto p-6 max-w-7xl">
                <div className="flex flex-col justify-center items-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Loading retainership data...</p>
                </div>
            </div>
        )
    }

    if (!retainership) {
        return (
            <div className="container mx-auto p-6 max-w-7xl">
                <div className="text-center py-20">
                    <p className="text-muted-foreground text-xl mb-4">Retainership not found</p>
                    <Button
                        onClick={() => router.push('/retainership')}
                        variant="outline"
                    >
                        Return to Services
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-[28px] md:text-3xl font-bold">Approve Retainership</h1>
                        <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
                            Review retainership details and associated tasks before approval
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    Retainership Details
                                </CardTitle>
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
                                                <span>Created by: {retainership.createdBy}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                <span>Created: {new Date(retainership.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-muted-foreground" />
                                                <span>Updated: {new Date(retainership.updatedAt).toLocaleDateString()}</span>
                                            </div>
                                            {/* <div className="flex items-center gap-2">
                                                <Tag className="h-4 w-4 text-muted-foreground" />
                                                <span>Tasks: {retainership. || 0}</span>
                                            </div> */}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div>
                        <Card>
                            <CardHeader>
                                <CardTitle>Actions</CardTitle>
                                <CardDescription>Approve or reject this retainership</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button onClick={handleApprove} disabled={approving} className="w-full bg-green-600 hover:bg-green-700">
                                    {approving ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            Approving...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle className="h-4 w-4 mr-2" />
                                            Approve Retainership
                                        </>
                                    )}
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => setShowRejectDialog(true)}
                                    disabled={rejecting}
                                    className="w-full"
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    Reject Retainership
                                </Button>
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
                        </div>
                    </CardHeader>
                    {loading ? (
                        <div className="flex justify-center items-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <>
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
                                                    <TableRow key={legislation.id}>
                                                        <TableCell>{legislation.title}</TableCell>
                                                        <TableCell>{legislation.description}</TableCell>
                                                        <TableCell>
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
                                                                        <a href={`/legislation/${legislation.id}`}>
                                                                            <Eye className="mr-2 h-4 w-4" />
                                                                            View Details
                                                                        </a>
                                                                    </DropdownMenuItem>
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
                        </>
                    )}
                </Card>

                <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Reject Retainership</AlertDialogTitle>
                            <AlertDialogDescription>
                                Please provide a reason for rejecting this retainership. This will help the creator understand what needs to
                                be improved.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="py-4">
                            <Label htmlFor="rejection-reason">Rejection Reason *</Label>
                            <Textarea
                                id="rejection-reason"
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Enter reason for rejection..."
                                rows={4}
                                className="mt-2"
                            />
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleReject}
                                disabled={!rejectionReason.trim() || rejecting}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                {rejecting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Rejecting...
                                    </>
                                ) : (
                                    "Reject Retainership"
                                )}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    )
}
