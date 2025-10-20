"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Task } from "@/types";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ClipboardList, CheckCircle2, Loader2, Clock, Eye, Plus } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

function formatDate(dateString?: string) {
  if (!dateString) return "-";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function statusKey(s?: string) {
  const k = (s || "").toLowerCase().replace(/\s+/g, "");
  if (["todo", "pending"].includes(k)) return "todo";
  if (["inprogress", "progress"].includes(k)) return "inprogress";
  if (["completed"].includes(k)) return "completed";
  return k || "todo";
}

type StatVariant = "total" | "completed" | "inprogress" | "pending";

const STAT_STYLES: Record<StatVariant, { bar: string; iconWrap: string; value: string; title: string; light: string; indicator: string }> = {
  total: { bar: "bg-blue-500", iconWrap: "text-blue-700 bg-blue-100", value: "text-blue-800", title: "text-blue-800", light: "bg-blue-50", indicator: "[&_[data-slot=progress-indicator]]:bg-blue-500" },
  completed: { bar: "bg-green-500", iconWrap: "text-green-700 bg-green-100", value: "text-green-800", title: "text-green-800", light: "bg-green-50", indicator: "[&_[data-slot=progress-indicator]]:bg-green-500" },
  inprogress: { bar: "bg-sky-500", iconWrap: "text-sky-700 bg-sky-100", value: "text-sky-800", title: "text-sky-800", light: "bg-sky-50", indicator: "[&_[data-slot=progress-indicator]]:bg-sky-500" },
  pending: { bar: "bg-amber-500", iconWrap: "text-amber-700 bg-amber-100", value: "text-amber-800", title: "text-amber-800", light: "bg-amber-50", indicator: "[&_[data-slot=progress-indicator]]:bg-amber-500" },
};

function StatCard({ title, value, percent, Icon, variant }: { title: string; value: number; percent: number; Icon: any; variant: StatVariant }) {
  const s = STAT_STYLES[variant];
  return (
    <Card className="relative overflow-hidden border border-border">
      <span className={`absolute inset-x-0 top-0 h-1 ${s.bar}`} />
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className={`text-sm font-semibold ${s.title}`}>{title}</CardTitle>
          <div className={`rounded-full p-2 ${s.iconWrap}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline justify-between">
          <div className={`text-4xl leading-none font-bold ${s.value}`}>{value}</div>
          <div className="text-xs font-medium text-muted-foreground">{percent}%</div>
        </div>
  <Progress value={percent} className={`${s.light} ${s.indicator}`} />
      </CardContent>
    </Card>
  );
}

function SectionTable({ label, tasks }: { label: string; tasks: Task[] }) {
  const labelColor = (() => {
    const l = label.toLowerCase();
    if (l.includes("progress")) return "text-sky-600";
    if (l.includes("completed")) return "text-green-600";
    return "text-blue-600"; // New Task
  })();

  return (
    <div className="flex items-stretch gap-4 min-w-0">
      {/* Rotated label column shown on md+ */}
      <div className="w-[96px] hidden md:flex items-center justify-center">
        <span className={`block rotate-[-90deg] origin-center whitespace-nowrap tracking-widest font-semibold select-none text-xl md:text-2xl ${labelColor}`}>
          {label}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <Card className="py-0 gap-0 rounded-md shadow-sm">
          <CardContent className="p-0">
            {/* Mobile heading */}
            <div className={`md:hidden px-4 pt-4 pb-2 font-semibold ${labelColor}`}>{label}</div>

            {/* Desktop table */}
            <div className="rounded-sm overflow-hidden hidden md:block">
              <Table className="w-full table-auto text-sm [&_th]:py-0 [&_th]:h-9 [&_td]:py-2">
                <colgroup>
                  <col className="w-[110px]" />
                  <col className="w-[18%]" />
                  <col />
                  <col className="w-[130px]" />
                  <col className="w-[150px]" />
                  <col className="w-[22%]" />
                  <col className="w-[72px]" />
                </colgroup>
                <TableHeader>
                  <TableRow className="bg-[#002FFF]">
                    <TableHead className="text-white">Task ID</TableHead>
                    <TableHead className="text-white">Client</TableHead>
                    <TableHead className="text-white">Description</TableHead>
                    <TableHead className="text-white">Start Date</TableHead>
                    <TableHead className="text-white">Completion Date</TableHead>
                    <TableHead className="text-white">Assigned To</TableHead>
                    <TableHead className="text-right text-white">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                        No tasks found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tasks.map((t) => {
                      const clientName = t.client
                        ? t.client.clientType === "individual"
                          ? `${t.client.firstName ?? ""} ${t.client.lastName ?? ""}`.trim()
                          : t.client.organizationName ?? ""
                        : "-";
                      const ownerName = t.assignedTo?.name ?? "-";
                      const shortId = `T-${t.id.slice(0, 6).toUpperCase()}`;
                      return (
                        <TableRow key={t.id} className="hover:bg-muted/50 even:bg-muted/30">
                          <TableCell>
                            <Link href={`/task/${t.id}`} className="text-[#1f7aff] hover:underline whitespace-nowrap">
                              {shortId}
                            </Link>
                          </TableCell>
                          <TableCell className="truncate max-w-[220px]" title={clientName}>
                            {clientName || "-"}
                          </TableCell>
                          <TableCell className="truncate max-w-[320px]" title={t.description}>
                            {t.description || "-"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{formatDate(t.createdAt)}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatDate(t.dueDate)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="text-[10px]">
                                  {(ownerName || "-")
                                    .toUpperCase()
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("") || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm truncate max-w-[160px]" title={ownerName}>
                                {ownerName}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link
                              href={`/task/${t.id}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile list */}
            <div className="md:hidden px-4 pb-4 space-y-3">
              {tasks.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">No tasks found.</div>
              ) : (
                tasks.map((t) => {
                  const clientName = t.client
                    ? t.client.clientType === "individual"
                      ? `${t.client.firstName ?? ""} ${t.client.lastName ?? ""}`.trim()
                      : t.client.organizationName ?? ""
                    : "-";
                  const ownerName = t.assignedTo?.name ?? "-";
                  const shortId = `T-${t.id.slice(0, 6).toUpperCase()}`;
                  return (
                    <div key={t.id} className="rounded-md border bg-white p-3 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <Link href={`/task/${t.id}`} className="font-medium text-[#1f7aff]">
                          {shortId}
                        </Link>
                        <Link
                          href={`/task/${t.id}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                          aria-label="View task"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </div>
                      <div className="mt-1 text-sm text-foreground/80 line-clamp-2">{t.description || "-"}</div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div><span className="font-medium text-foreground">Client:</span> <span className="truncate inline-block max-w-[120px] align-bottom" title={clientName}>{clientName || "-"}</span></div>
                        <div><span className="font-medium text-foreground">Start:</span> {formatDate(t.createdAt)}</div>
                        <div><span className="font-medium text-foreground">Due:</span> {formatDate(t.dueDate)}</div>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[9px]">
                              {(ownerName || "-")
                                .toUpperCase()
                                .split(" ")
                                .map((n) => n[0])
                                .join("") || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate max-w-[120px]" title={ownerName}>{ownerName}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchWithAuth("/api/tasks");
        if (!res.ok) throw new Error("Failed to fetch tasks");
        const data = await res.json();
        const arr = Array.isArray(data) ? data : data.tasks ?? [];
        setTasks(arr);
      } catch (e) {
        console.error(e);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const { total, completed, inprogress, todo } = useMemo(() => {
    const counts = { total: tasks.length, completed: 0, inprogress: 0, todo: 0 };
    tasks.forEach((t) => {
      const k = statusKey(t.status);
      if (k === "completed") counts.completed += 1;
      else if (k === "inprogress") counts.inprogress += 1;
      else counts.todo += 1;
    });
    return counts;
  }, [tasks]);

  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  const tasksNew = tasks.filter((t) => ["todo"].includes(statusKey(t.status)));
  const tasksInProgress = tasks.filter((t) => ["inprogress"].includes(statusKey(t.status)));
  const tasksCompleted = tasks.filter((t) => ["completed"].includes(statusKey(t.status)));

  return (
    <section className="container mx-auto p-6 max-w-7xl space-y-8 overflow-x-hidden min-w-0">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Tasks</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard title="Total Tasks" value={total} percent={100} Icon={ClipboardList} variant="total" />
        <StatCard title="Completed" value={completed} percent={pct(completed)} Icon={CheckCircle2} variant="completed" />
        <StatCard title="In Progress" value={inprogress} percent={pct(inprogress)} Icon={Loader2} variant="inprogress" />
        <StatCard title="Pending" value={todo} percent={pct(todo)} Icon={Clock} variant="pending" />
      </div>

      {/* Sub header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Task Management</h2>
          <p className="text-muted-foreground text-sm">Manage and track your legal tasks</p>
        </div>
        <Link href="/task/create">
          <Button className="bg-[#003459] cursor-pointer hover:bg-[#003459] text-white">
            <Plus className="h-4 w-4 mr-2" /> Add New Task
          </Button>
        </Link>
      </div>

      {/* Tables */}
      {loading ? (
        <div className="flex justify-center items-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading tasks...
        </div>
      ) : (
        <div className="space-y-[100px]">
          <SectionTable label="New Task" tasks={tasksNew.slice(0, 3)} />
          <SectionTable label="In Progress" tasks={tasksInProgress.slice(0, 3)} />
          <SectionTable label="Completed" tasks={tasksCompleted.slice(0, 3)} />
        </div>
      )}
    </section>
  );
}
