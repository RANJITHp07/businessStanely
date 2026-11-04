import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * Task conditions for "has no category, or an approved one", written on the
 * categoryId column. A `category: {...}` relation filter makes MongoDB join
 * TaskCategory for every candidate task, and repeats that on every query.
 * Absent and null are listed separately because MongoDB treats them differently.
 */
export async function approvedOrNoCategoryConditions(): Promise<Prisma.TaskWhereInput[]> {
  const approved = await prisma.taskCategory.findMany({
    where: { status: "approved" },
    select: { id: true },
  });
  return [
    { categoryId: null },
    { categoryId: { isSet: false } },
    { categoryId: { in: approved.map((category) => category.id) } },
  ];
}
