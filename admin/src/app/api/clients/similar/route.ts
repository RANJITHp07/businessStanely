import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

const MAX_MATCHES = 8;
const NAME_FIELDS = ["firstName", "lastName", "organizationName"] as const;

/**
 * Registered clients whose name looks like the one being typed into a
 * create-client form, so the user can pick the existing record instead of
 * entering a duplicate. Every word of `name` must appear (case-insensitive) in
 * one of the client's name fields, so "john smith" finds "John Smith" and
 * "Smith, John" alike. Clients of either type are searched: the same party is
 * sometimes registered as an individual and later re-entered as an
 * organization, or the reverse.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const name = new URL(req.url).searchParams.get("name") ?? "";
    // One-letter words ("J", initials) match nearly every client, so they
    // are ignored rather than allowed to flood the list.
    const words = name
      .trim()
      .split(/\s+/)
      .filter((word) => word.length >= 2)
      .slice(0, 5);

    if (words.length === 0) {
      return NextResponse.json([]);
    }

    // No deletedAt here: the soft-delete extension injects the not-deleted
    // filter, and only clients that can still be selected are worth offering.
    const clients = await prisma.client.findMany({
      where: {
        AND: words.map(
          (word): Prisma.ClientWhereInput => ({
            OR: NAME_FIELDS.map((field) => ({
              [field]: { contains: word, mode: "insensitive" },
            })),
          }),
        ),
      },
      select: {
        id: true,
        clientType: true,
        firstName: true,
        lastName: true,
        organizationName: true,
        email: true,
        phoneNumber: true,
      },
      orderBy: { createdAt: "desc" },
      take: MAX_MATCHES,
    });

    return NextResponse.json(clients);
  } catch (error) {
    console.error("Error searching similar clients:", error);
    return NextResponse.json(
      { error: "Failed to search clients" },
      { status: 500 },
    );
  }
}
