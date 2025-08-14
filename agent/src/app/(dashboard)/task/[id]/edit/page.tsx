"use client";
import React from "react";
import TaskForm from "../../create/_components/taskForm";
import { useParams } from "next/navigation";

export default function EditTask() {
  const { id } = useParams();
  // Ensure id is always a string
  const taskId = Array.isArray(id) ? id[0] : id;
  return (
    <div>
      <TaskForm id={taskId} />
    </div>
  );
}
