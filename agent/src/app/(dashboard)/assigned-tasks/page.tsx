"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Task } from "@/types";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { ClipboardList, CheckCircle2, Loader2, Clock } from "lucide-react";
import { SectionTable, StatCard } from "../my-task/page";

const SECTION_LIMIT = 3;

export default function AssignedTasksPage() {
  const [sections, setSections] = useState<Record<string, Task[]>>({});
  const [counts, setCounts] = useState({
    total: 0,
    completed: 0,
    inprogress: 0,
    todo: 0,
  });
  const [loading, setLoading] = useState(true);
  const { agent, isLoading: authLoading } = useAuth();

  useEffect(() => {
    const load = async () => {
      if (!agent) {
        setSections({});
        setLoading(false);
        return;
      }
      try {
        // Tasks this agent owns but handed to a junior, bucketed by status.
        const res = await fetchWithAuth(
          `/api/tasks?summary=true&limit=${SECTION_LIMIT}&assignedBy=me`
        );
        if (!res.ok) throw new Error("Failed to fetch assigned tasks");
        const data = await res.json();
        setSections(data.sections ?? {});
        setCounts(
          data.counts ?? {
            total: 0,
            completed: 0,
            inprogress: 0,
            todo: 0,
          }
        );
      } catch (e) {
        console.error(e);
        setSections({});
      } finally {
        setLoading(false);
      }
    };
    if (!authLoading) {
      load();
    }
  }, [agent, authLoading]);

  const { total, completed, inprogress, todo } = counts;

  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <section className="container mx-auto p-6 max-w-7xl space-y-8 overflow-x-hidden min-w-0">
      <div>
        <h1 className="text-3xl font-bold">Assigned Tasks</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tasks you have assigned to your team
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Tasks"
          value={total}
          percent={100}
          Icon={ClipboardList}
          variant="total"
        />
        <StatCard
          title="Completed"
          value={completed}
          percent={pct(completed)}
          Icon={CheckCircle2}
          variant="completed"
        />
        <StatCard
          title="In Progress"
          value={inprogress}
          percent={pct(inprogress)}
          Icon={Loader2}
          variant="inprogress"
        />
        <StatCard
          title="Pending"
          value={todo}
          percent={pct(todo)}
          Icon={Clock}
          variant="pending"
        />
      </div>

      {/* Tables */}
      {loading ? (
        <div className="flex justify-center items-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading tasks...
        </div>
      ) : (
        <div className="space-y-[40px]">
          <SectionTable label="New Task" tasks={sections.todo ?? []} assignedByMe />
          <SectionTable label="In Progress" tasks={sections.inprogress ?? []} assignedByMe />
          <SectionTable label="Completed" tasks={sections.completed ?? []} assignedByMe />
          <SectionTable label="Hold" tasks={sections.hold ?? []} assignedByMe />
        </div>
      )}
    </section>
  );
}
