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

import { Task } from "@/types";
import { Calendar, Edit, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function LegislationDetail({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = params instanceof Promise ? use(params) : params;

  const [legislation, setLegislation] = useState<any | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

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
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Last Completed Date: {formatDate(legislation.lastCompletedDate)}</span>
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
            <CardTitle className="flex items-center justify-between gap-2">
              <FileText className="h-5 w-5" />
              Legislation Tasks
            </CardTitle>
            <Button onClick={() => router.push(`/task/create?legislationId=${resolvedParams.id}&assignedAgent=${legislation.assignedAgent?.id || ""}&client=${legislation.retainership?.client?.id || ""}`)}>Add Task</Button>
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
                  <TableHead>Last Completion Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No tasks found for this legislation.
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map((task) => (
                    <TableRow
                      key={task.id}
                      onClick={() => router.push(`/task/${task.id}`)}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell className="max-w-xs truncate">{task.title}</TableCell>
                      <TableCell className="max-w-xs truncate">{task.description}</TableCell>
                      <TableCell>{task.status}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(task.lastCompletedDate)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/task/${task.id}/edit`);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTaskToDelete(task);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <AlertDialog open={!!taskToDelete} onOpenChange={() => setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the task &quot;{taskToDelete?.title}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTaskToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeleting}
              onClick={async () => {
                if (!taskToDelete) return;
                setIsDeleting(true);
                try {
                  const response = await fetchWithAuth(`/api/tasks/${taskToDelete.id}`, { method: "DELETE" });
                  if (response.ok) {
                    setTasks((prev) => prev.filter((t) => t.id !== taskToDelete.id));
                    toast.success("Task deleted successfully");
                  } else {
                    toast.error("Failed to delete task. Please try again.");
                  }
                } catch (error) {
                  console.error("Error deleting task:", error);
                  toast.error("An error occurred while deleting the task.");
                } finally {
                  setIsDeleting(false);
                  setTaskToDelete(null);
                }
              }}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}