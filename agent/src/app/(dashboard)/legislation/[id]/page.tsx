"use client";

import { use, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuLabel,
//   DropdownMenuTrigger,
// } from "@/components/ui/dropdown-menu";
// import { Button } from "@/components/ui/button";
// import { FileText, MoreHorizontal, Eye, PlusCircle } from "lucide-react";
// import { Badge } from "@/components/ui/badge";

import { Legislation, Task } from "@/types";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LegislationDetail({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = params instanceof Promise ? use(params) : params;

  const [legislation, setLegislation] = useState<Legislation | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const legislationId = resolvedParams.id; // Extract id safely
        const response = await fetchWithAuth(`/api/legislation/${legislationId}`);

        if (!response.ok) {
          throw new Error("Failed to fetch legislation");
        }

        const data = await response.json();
        setLegislation(data);
        setTasks(data.tasks || []); // Ensure tasks are fetched directly from the legislation details API
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load legislation details");
        setLegislation(null);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [resolvedParams.id]);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    const aCompleted = a.lastCompletedDate
      ? new Date(a.lastCompletedDate).getTime()
      : 0;
    const bCompleted = b.lastCompletedDate
      ? new Date(b.lastCompletedDate).getTime()
      : 0;

    if (bCompleted !== aCompleted) {
      return bCompleted - aCompleted;
    }

    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bCreated - aCreated;
  });

  const computedLastCompletedDate = legislation?.lastCompletedDate
    ? legislation.lastCompletedDate
    : sortedTasks.find((task) => task.lastCompletedDate)?.lastCompletedDate || null;

  const assignedAgentId = legislation?.assignedAgent?.id || "";
  const clientId =
    ((legislation?.retainership?.client as { id?: string } | undefined)?.id) || "";

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Skeleton className="h-8 w-40 mb-4" />
        <Skeleton className="h-5 w-80 mb-2" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!legislation) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <p className="text-center text-muted-foreground">Legislation not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          <div>
            <h1 className="text-[28px] md:text-3xl font-bold">Legislation Details</h1>
            <p className="text-[18px] md:text-[16px] text-muted-foreground mt-2">
              Comprehensive view of legislation details and associated tasks
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Legislation Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-semibold">{legislation.title}</h2>
                </div>
                <p className="text-muted-foreground mb-4">{legislation.description}</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>Assigned Agent: {legislation.assignedAgent?.name || "Unknown"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>Last Completed Date: {formatDate(computedLastCompletedDate)}</span>
                  </div>
                  {legislation.client && (
                    <>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Client Name: {legislation.client.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Client Email: {legislation.client.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Client Phone: {legislation.client.phoneNumber}</span>
                      </div>
                    </>
                  )}
                  {legislation.retainership?.client && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Client Name: {legislation.retainership.client.clientType === "organization" ? legislation.retainership.client.organizationName : `${legislation.retainership.client.firstName} ${legislation.retainership.client.lastName}`}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Client Email: {legislation.retainership.client.email}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Legislation Tasks
            </CardTitle>
            <Button
              onClick={() =>
                router.push(
                  `/task/create?legislationId=${resolvedParams.id}&assignedAgent=${assignedAgentId}&client=${clientId}`,
                )
              }
              disabled={!assignedAgentId}
            >
              Add Task
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  {/* <TableHead className="text-right">Actions</TableHead> */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No tasks found for this legislation.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedTasks.map((task) => (
                    <TableRow
                      key={task.id}
                      onClick={() => router.push(`/task/${task.id}`)}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell className="max-w-xs  truncate">{task.title}</TableCell>
                      <TableCell className="max-w-xs  truncate">{task.description}</TableCell>
                      <TableCell>{task.status}</TableCell>
                      {/* <TableCell className="text-right">
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
                              <a href={`/tasks/${task.id}`} onClick={(e) => e.stopPropagation()}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a
                                href={`/tasks/create?legislationId=${legislation.id}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Create Task
                              </a>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell> */}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div >
  );
}