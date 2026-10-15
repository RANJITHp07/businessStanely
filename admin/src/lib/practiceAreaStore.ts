import { NextResponse } from "next/server";
import type { AdminUser } from "./auth";
import prisma from "./prisma";
import type { PracticeAreaParameterDefinition } from "./practiceAreaParameters";

/**
 * Server-side helpers for the practice area API routes. Pure rules (input
 * parsing, types) live in practiceAreaParameters.ts.
 */

export const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

type ParameterRow = {
  id: string;
  practiceAreaId: string;
  title: string;
  type: string;
  required: boolean;
  options: string[];
  attachmentMode: string;
  maxAttachments: number | null;
  sortOrder: number;
};

export function toDefinition(row: ParameterRow): PracticeAreaParameterDefinition {
  return {
    id: row.id,
    practiceAreaId: row.practiceAreaId,
    title: row.title,
    type: row.type as PracticeAreaParameterDefinition["type"],
    required: row.required,
    options: row.options ?? [],
    attachmentMode: row.attachmentMode as PracticeAreaParameterDefinition["attachmentMode"],
    maxAttachments: row.maxAttachments ?? null,
    sortOrder: row.sortOrder,
  };
}

/** Enquiries that hold an answer for this parameter. */
export function countParameterUsage(parameterId: string): Promise<number> {
  return prisma.enquiry.count({
    where: { parameterValues: { some: { parameterId } } },
  });
}

/** Enquiries that picked this practice area. */
export function countAreaUsage(practiceAreaId: string): Promise<number> {
  return prisma.enquiry.count({ where: { practiceAreaIds: { has: practiceAreaId } } });
}

/**
 * Removing a practice area takes it off the public website, so it is limited
 * to owners, the same rule as deleting a service. Everything else on the
 * Practice Areas page is open to any admin.
 */
export function ownerOnly(admin: AdminUser): NextResponse | null {
  if (admin.adminType === "owner") return null;
  return NextResponse.json(
    { error: "Only owners can delete parameter areas" },
    { status: 403 },
  );
}

export function titleTaken(
  rows: { id: string; title: string }[],
  title: string,
  exceptId?: string,
): boolean {
  const key = title.toLowerCase();
  return rows.some((row) => row.id !== exceptId && row.title.toLowerCase() === key);
}
