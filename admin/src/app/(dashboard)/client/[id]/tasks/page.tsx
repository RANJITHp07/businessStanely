"use client"

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, AlertCircle } from "lucide-react";

import { Task, Client } from "@/types";

const STATUS_COLUMNS = ["To Do", "In Progress", "Hold", "Completed"] as const;

function getClientDisplayName(client: Client | null) {
  if (!client) return "";
  if (client.clientType === "individual") {
    return `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim();
  }
  return client.organizationName ?? "";
}

function getPriorityBadge(priority: string) {
  const colors: Record<string, string> = {
    low: "bg-green-100 text-green-800 border-green-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    high: "bg-red-100 text-red-800 border-red-200",
  };
  const key = (priority || "").toLowerCase();
  return (
    <Badge className={`${colors[key] ?? ""} border`}>
      {priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : "N/A"}
    </Badge>
  );
}

function formatDate(dateString?: string) {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ClientTasksPage() {
  const params = useParams();
  const id = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [clientRes, tasksRes] = await Promise.all([
          fetchWithAuth(`/api/clients/${id}`),
          fetchWithAuth(`/api/tasks?clientId=${id}`),
        ]);

        if (clientRes.ok) {
          setClient(await clientRes.json());
        }

        if (tasksRes.ok) {
          const data = await tasksRes.json();
          setTasks(Array.isArray(data) ? data : data.tasks || []);
        } else {
          setError("Failed to load tasks for this client.");
        }
      } catch (err) {
        console.error("Error fetching client tasks:", err);
        setError("Failed to load tasks for this client.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const tasksByStatus = STATUS_COLUMNS.reduce<Record<string, Task[]>>((acc, status) => {
    acc[status] = tasks.filter((task) => task.status === status);
    return acc;
  }, {});

  const otherTasks = tasks.filter((task) => !(STATUS_COLUMNS as readonly string[]).includes(task.status));

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="outline">
          <Link href="/client">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clients
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {loading ? <Skeleton className="h-8 w-64" /> : `Tasks for ${getClientDisplayName(client)}`}
        </h1>
        <p className="text-muted-foreground">
          {loading ? "" : `${tasks.length} task${tasks.length === 1 ? "" : "s"} total`}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {STATUS_COLUMNS.map((status) => (
            <Skeleton key={status} className="h-64 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {STATUS_COLUMNS.map((status) => (
            <div key={status} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-semibold text-sm text-gray-700">{status}</h2>
                <Badge variant="outline">{tasksByStatus[status].length}</Badge>
              </div>
              <div className="space-y-3 min-h-[100px]">
                {tasksByStatus[status].length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                    No tasks
                  </div>
                ) : (
                  tasksByStatus[status].map((task) => (
                    <Link key={task.id} href={`/task/${task.id}`}>
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm leading-snug">{task.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-2">
                          <div className="flex items-center justify-between">
                            {getPriorityBadge(task.priority)}
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {formatDate(task.dueDate)}
                            </span>
                          </div>
                          {task.assignedTo?.name && (
                            <p className="text-xs text-muted-foreground truncate">
                              Assigned to: {task.assignedTo.name}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && otherTasks.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm text-gray-700">Other</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {otherTasks.map((task) => (
              <Link key={task.id} href={`/task/${task.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm leading-snug">{task.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    <div className="flex items-center justify-between">
                      {getPriorityBadge(task.priority)}
                      <Badge variant="outline">{task.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!loading && !error && tasks.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No tasks found for this client.
        </div>
      )}
    </div>
  );
}
