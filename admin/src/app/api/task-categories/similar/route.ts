import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

const MAX_MATCHES = 8;

/**
 * Existing services whose name looks like the one being typed into a
 * create-service form, so the user can pick the existing service instead of
 * entering a duplicate. Every word of `name` must appear (case-insensitive)
 * in the service name, so "gst filing" finds "GST Return Filing".
 *
 * Rejected services are left out: they cannot be selected for a task, and
 * re-creating one is how a rejected service gets resubmitted.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const name = new URL(req.url).searchParams.get("name") ?? "";
    // One-letter words match nearly every service, so they are ignored
    // rather than allowed to flood the list.
    const words = name
      .trim()
      .split(/\s+/)
      .filter((word) => word.length >= 2)
      .slice(0, 5);

    if (words.length === 0) {
      return NextResponse.json([]);
    }

    // No deletedAt here: the soft-delete extension injects the not-deleted
    // filter.
    const services = await prisma.taskCategory.findMany({
      where: {
        status: { not: "rejected" },
        AND: words.map((word) => ({
          name: { contains: word, mode: "insensitive" as const },
        })),
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        timePeriod: true,
      },
      orderBy: { name: "asc" },
      take: MAX_MATCHES,
    });

    return NextResponse.json(services);
  } catch (error) {
    console.error("Error searching similar services:", error);
    return NextResponse.json(
      { error: "Failed to search services" },
      { status: 500 },
    );
  }
}
