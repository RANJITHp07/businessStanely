import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

/**
 * Admin-side reads for website enquiries. Writes from the public site come in
 * through /api/public/enquiries; this route is authenticated and read-only
 * except for the status/convert actions on [id].
 */

/**
 * ipAddress and userAgent are kept for spam triage but are not part of the
 * list payload — the table never shows them and they do not need to travel.
 */
const ENQUIRY_LIST_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  company: true,
  services: true,
  payment: true,
  notes: true,
  source: true,
  status: true,
  convertedProspectId: true,
  convertedAt: true,
  createdAt: true,
  convertedByAgent: { select: { id: true, name: true } },
  assignedAgent: { select: { id: true, name: true } },
} satisfies Prisma.EnquirySelect;

export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: Prisma.EnquiryWhereInput = {};
    if (status && status !== "all") {
      where.status = status;
    }

    // The page shows per-status tab counts alongside the filtered list, so the
    // counts are grouped server-side rather than derived from the rows sent.
    const [enquiries, statusGroups] = await Promise.all([
      prisma.enquiry.findMany({
        where,
        select: ENQUIRY_LIST_SELECT,
        orderBy: { createdAt: "desc" },
      }),
      prisma.enquiry.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    let total = 0;
    for (const group of statusGroups) {
      total += group._count._all;
      if (group.status) statusCounts[group.status] = group._count._all;
    }

    return NextResponse.json({ enquiries, statusCounts, total });
  } catch (error) {
    console.error("Failed to fetch enquiries:", error);
    return NextResponse.json(
      { error: "Failed to fetch enquiries" },
      { status: 500 },
    );
  }
}
