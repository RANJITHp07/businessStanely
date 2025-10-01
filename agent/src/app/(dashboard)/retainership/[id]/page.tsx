"use client"

import { useState, useEffect } from "react"
import { use } from "react"
import { toast } from "react-toastify"
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/fetchWithAuth"; // Import fetchWithAuth for authenticated requests

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

// Icons
import {
    User,
    FileText,
    Clock,
    Tag,
    Calendar,
    MoreHorizontal,
    Eye,
    PlusCircle
} from "lucide-react"

// Importing Retainership, Task, and UserInfo types from the types file
import { Retainership } from "@/types"; // Removed unused Task import
import { Button } from "@/components/ui/button";

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

    const resolvedParams = params instanceof Promise ? use(params) : params;
    const [retainership, setRetainership] = useState<Retainership | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const retainershipId = resolvedParams.id;
                const retainershipResponse = await fetchWithAuth(`/api/retainerships/${retainershipId}`);

                if (!retainershipResponse.ok) {
                    throw new Error("Failed to fetch retainership");
                }

                const retainershipData = await retainershipResponse.json();

                // Legislations are already part of retainershipData, no need to fetch separately
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
                                                <span>Client: {retainership.client?.name || "Unknown"}</span>
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
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                No legislation found for this retainership.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        retainership?.legislation?.map((legislation) => (
                                            <TableRow
                                                key={legislation.id}
                                                onClick={() => router.push(`/legislation/${legislation.id}`)}
                                                className="cursor-pointer hover:bg-muted/50"
                                            >
                                                <TableCell>{legislation.title}</TableCell>
                                                <TableCell>{legislation.description}</TableCell>
                                                <TableCell>{legislation.assignedAgent?.name || "Unknown"}</TableCell>
                                                <TableCell className="text-right">
                                                  <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                      <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                                                        <span className="sr-only">Open menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                      </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                      <DropdownMenuItem asChild>
                                                        <a href={`/legislation/${legislation.id}`} onClick={(e) => e.stopPropagation()}>
                                                          <Eye className="mr-2 h-4 w-4" />
                                                          View Details
                                                        </a>
                                                      </DropdownMenuItem>
                                                      {retainership.status !== "pending" && (
                                                        <DropdownMenuItem asChild>
                                                          <a
                                                            href={`/task/create?legislationId=${legislation.id}&assignedAgent=${legislation.assignedAgent?.id}&client=${retainership.client?.id}`}
                                                            onClick={(e) => e.stopPropagation()}
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
                </Card>
            </div>
        </div>
    );
}
