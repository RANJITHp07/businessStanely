import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Eye, Calendar } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
// import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { Task } from "@/types";

function statusKey(s?: string) {
  const k = (s || "").toLowerCase().replace(/\s+/g, "");
  if (["todo", "pending"].includes(k)) return "todo";
  if (["inprogress", "progress"].includes(k)) return "inprogress";
  if (["completed"].includes(k)) return "completed";
  if (["hold"].includes(k)) return "hold";
  return k || "todo";
}

function sectionLabelToStatus(label: string) {
  const l = label.toLowerCase();
  if (l.includes("progress")) return "In Progress";
  if (l.includes("completed")) return "Completed";
  if (l.includes("hold")) return "Hold";
  return "To Do";
}

function formatDate(dateString?: string) {
  if (!dateString) return "-";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function SectionTable({
  label,
  tasks,
  agentId,
  retainershipTasks,
  trigger,
}: {
  label: string;
  tasks: Task[];
  agentId?: string;
  retainershipTasks?: boolean;
  trigger?: boolean;
}) {
  const labelColor = (() => {
    const l = label.toLowerCase();
    if (l.includes("progress")) return "text-sky-600";
    if (l.includes("completed")) return "text-green-600";
    if (l.includes("hold")) return "text-gray-600";
    return "text-blue-600";
  })();

  return (
    <>
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-[96px] h-auto hidden md:flex items-center justify-center self-stretch flex-shrink-0 bg-white rounded-lg py-6 px-2">
          <span className={`block rotate-[-90deg] origin-center whitespace-nowrap tracking-widest font-semibold select-none text-[24px] ${labelColor}`}>
            {label}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <Card className="min-h-[250px] py-0 gap-0 rounded-md shadow-sm">
            <CardContent className="p-0">
              <div className={`md:hidden flex items-center justify-center px-4 py-4 rounded-lg shadow-sm border border-gray-100 font-semibold ${labelColor} text-2xl tracking-widest`}>
                {label}
              </div>
              <div className="rounded-md overflow-hidden p-1 md:p-0 block bg-white shadow-sm">
                <Table className="w-full table-fixed text-sm [&_th]:py-3 [&_th]:h-12 [&_td]:py-3">
                  <colgroup>
                    <col className="w-[180px]" />
                    <col className="w-[130px]" />
                    <col className="w-[140px]" />
                    <col className="w-[90px]" />
                    <col className="w-[100px]" />
                    <col className="w-[110px]" />
                    <col className="w-[110px]" />
                    <col className="w-[60px]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-white">Task</TableHead>
                      <TableHead className="text-white">Client</TableHead>
                      <TableHead className="text-white">Assigned To</TableHead>
                      <TableHead className="text-white">Priority</TableHead>
                      <TableHead className="text-white">Due Date</TableHead>
                      <TableHead className="text-white">Last Completed</TableHead>
                      <TableHead className="text-white">{trigger ? "Prev Progress" : "Progress"}</TableHead>
                      <TableHead className="text-right text-white">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-4 text-muted-foreground">
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
                        const categoryName = t.category?.name;
                        const clientEmail = t.client?.email ?? "";
                        const assignedRole = t.assignedTo?.agentType ?? "";
                        const priority = (t.priority || "").toLowerCase();
                        const isOverdue = t.dueDate
                          ? new Date(t.dueDate) < new Date() && statusKey(t.status) !== "completed"
                          : false;
                        const statusLabel = (() => {
                          const k = statusKey(t.status);
                          if (k === "completed") return "Completed";
                          if (k === "inprogress") return "In Progress";
                          if (k === "hold") return "Hold";
                          return "To Do";
                        })();
                        const priorityBadge = (p: string) => {
                          if (!p)
                            return <span className="text-muted-foreground">-</span>;
                          if (p.includes("high"))
                            return (
                              <span className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm">
                                <span className="text-xs">❗</span> High
                              </span>
                            );
                          if (p.includes("medium"))
                            return (
                              <span className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm">
                                <span className="text-xs">⚠️</span> Medium
                              </span>
                            );
                          return (
                            <span className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                              Low
                            </span>
                          );
                        };
                        return (
                          <TableRow key={t.id} className="hover:bg-muted/50 even:bg-muted/30">
                            <TableCell className="truncate max-w-[260px] aligne-top" title={t.title || shortId}>
                              <div className="flex flex-col">
                                <Link href={`/task/${t.id}`} className="text-foreground font-medium hover:underline truncate">
                                  {t.title || shortId}
                                </Link>
                                {categoryName ? (
                                  <div className="mt-2">
                                    <span className="inline-block bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-xs">
                                      {categoryName}
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="truncate max-w-[180px] align-top" title={clientName || clientEmail}>
                              <div className="flex flex-col">
                                <span className="font-medium truncate">{clientName || "-"}</span>
                                {clientEmail ? (
                                  <span className="text-muted-foreground text-sm truncate">{clientEmail}</span>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="truncate max-w-[200px] align-top">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8 flex-shrink-0">
                                  <AvatarFallback className="text-[10px]">
                                    {(ownerName || "?").split(" ").map((n) => n[0]).join("")}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-medium truncate" title={ownerName}>{ownerName}</span>
                                  {assignedRole ? (
                                    <span className="text-xs text-muted-foreground truncate">{assignedRole}</span>
                                  ) : null}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap align-top">{priorityBadge(priority)}</TableCell>
                            <TableCell className="whitespace-nowrap align-top" title={t.dueDate || ""}>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span className={`${isOverdue ? "text-red-600 font-semibold" : "text-foreground"}`}>{formatDate(t.dueDate)}</span>
                                </div>
                                {isOverdue ? (
                                  <div className="mt-2">
                                    <span className="inline-block bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">Overdue</span>
                                  </div>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap align-top">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span>{t.lastCompletedDate ? formatDate(t.lastCompletedDate) : "—"}</span>
                              </div>
                            </TableCell>
                            <TableCell className="truncate max-w-[160px] align-top" title={statusLabel}>
                              <div className="font-medium truncate">{statusLabel}</div>
                            </TableCell>
                            <TableCell className="text-right align-top">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Link href={`/task/${t.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" aria-label="View task details">
                                    <Eye className="h-5 w-5" />
                                  </Link>
                                </TooltipTrigger>
                                <TooltipContent sideOffset={6}>View task details</TooltipContent>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="flex justify-end">
        <Link
          href={(() => {
            const params = new URLSearchParams();
            if (agentId) params.set("assignedToId", agentId);
            if (trigger) {
              params.set("trigger", "true");
            } else {
              params.set("status", sectionLabelToStatus(label));
              if (retainershipTasks) params.set("retainershipTasks", "true");
            }
            return `/task?${params.toString()}`;
          })()}
          className="bg-[#003459] cursor-pointer text-white text-[14px] py-[10px] mt-[10px] px-[10px] rounded-[5px] inline-block"
        >
          View more
        </Link>
      </div>
    </>
  );
}
