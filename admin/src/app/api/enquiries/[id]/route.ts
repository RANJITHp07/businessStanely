import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import {
  actorFromAdmin,
  recordDeletionAudit,
  recordUpdateAudit,
  softDeleteData,
} from "@/lib/audit";
import { withActor } from "@/lib/auditContext";

/** Statuses an agent may set by hand. "Converted" is set by the convert action. */
const SETTABLE_STATUSES = ["New", "Reviewed", "Spam"] as const;

/** Next 15 passes route params as a promise. */
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  req: NextRequest,
  { params }: RouteContext,
) {
  try {
    const admin = await getCurrentAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const enquiry = await prisma.enquiry.findFirst({
      where: { id },
      include: {
        convertedByAgent: { select: { id: true, name: true } },
        assignedAgent: { select: { id: true, name: true } },
        // Newest first, so the detail page can render the feed as returned.
        comments: {
          where: {
            OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
          },
          orderBy: { createdAt: "desc" },
          include: {
            agent: { select: { id: true, name: true } },
            user: { select: { id: true, username: true } },
          },
        },
      },
    });

    if (!enquiry) {
      return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
    }

    return NextResponse.json({ enquiry });
  } catch (error) {
    console.error("Failed to fetch enquiry:", error);
    return NextResponse.json(
      { error: "Failed to fetch enquiry" },
      { status: 500 },
    );
  }
}

/** Caps a single interaction so one comment cannot write an unbounded document. */
const MAX_COMMENT_LENGTH = 5000;

/**
 * Logs an interaction against an enquiry. These are the same Comment rows the
 * leads screen writes, linked through Comment.enquiryId instead of prospectId.
 *
 * Unlike the prospect equivalent this does not move the enquiry's status: an
 * enquiry advances only when an agent marks it Reviewed/Spam or converts it,
 * and taking a note should not silently make that decision for them.
 *
 * `visibleToClient` decides whether the message appears in the client's portal.
 * It defaults to TRUE: an agent writing on an enquiry is normally talking to
 * the client, so a message typed and sent reaches them. Keeping something
 * private is the deliberate act, and the caller says so by sending false.
 */
export async function POST(
  req: NextRequest,
  { params }: RouteContext,
) {
  try {
    const admin = await getCurrentAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const {
      content,
      attachmentName,
      attachmentUrl,
      attachmentSize,
      attachmentType,
      attachments,
      visibleToClient,
    } = body;

    const trimmed = typeof content === "string" ? content.trim() : "";
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

    // An interaction is allowed to be a file with no words, but not empty.
    if (!trimmed && !hasAttachments && !attachmentUrl) {
      return NextResponse.json(
        { error: "An interaction needs a note or an attachment" },
        { status: 400 },
      );
    }

    const enquiry = await prisma.enquiry.findFirst({
      where: { id },
      select: { id: true },
    });
    if (!enquiry) {
      return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
    }

    const created = await prisma.comment.create({
      data: {
        content: trimmed.slice(0, MAX_COMMENT_LENGTH),
        attachmentName,
        attachmentUrl,
        attachmentSize,
        attachmentType,
        ...(hasAttachments ? { attachments } : {}),
        // getCurrentAdmin resolves a User, so the author is a USER here even
        // though the row can also be written by an agent elsewhere.
        authorId: admin.id,
        authorType: "USER",
        enquiryId: id,
        // Shared unless the agent explicitly marked the message internal. Only
        // an outright false keeps it private, so a caller that omits the field
        // gets the same visible message the form sends.
        visibleToClient: visibleToClient !== false,
      },
    });

    const comment = await prisma.comment.findUnique({
      where: { id: created.id },
      include: {
        agent: { select: { id: true, name: true } },
        user: { select: { id: true, username: true } },
      },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("Failed to add interaction:", error);
    return NextResponse.json(
      { error: "Failed to add interaction" },
      { status: 500 },
    );
  }
}

/**
 * Two actions share this handler:
 *
 *  - `{ status }` marks an enquiry Reviewed or Spam.
 *  - `{ action: "convert", assignedAgentId, leadSourceId? }` creates the
 *    Prospect and links it back.
 *
 * Conversion is guarded on the enquiry's own status rather than only on
 * convertedProspectId, so two agents clicking Convert at the same moment
 * cannot produce two prospects from one enquiry.
 */
export async function PATCH(
  req: NextRequest,
  { params }: RouteContext,
) {
  try {
    const admin = await getCurrentAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const actor = actorFromAdmin(admin);

    const existing = await prisma.enquiry.findFirst({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
    }

    if (body.action === "convert") {
      const { assignedAgentId, leadSourceId } = body;

      if (!assignedAgentId) {
        return NextResponse.json(
          { error: "An agent must be selected to convert this enquiry" },
          { status: 400 },
        );
      }

      if (existing.status === "Converted" || existing.convertedProspectId) {
        return NextResponse.json(
          { error: "This enquiry has already been converted" },
          { status: 409 },
        );
      }

      const agent = await prisma.agent.findFirst({
        where: { id: assignedAgentId },
        select: { id: true },
      });
      if (!agent) {
        return NextResponse.json(
          { error: "Assigned agent not found" },
          { status: 404 },
        );
      }

      // Claim the enquiry first. If another request got here first this matches
      // nothing, and we stop rather than writing a second prospect.
      //
      // On MongoDB `convertedProspectId: null` does not match documents where
      // the field was never written, which is every unconverted enquiry. Both
      // null and absent have to be matched or the claim never succeeds.
      const claim = await prisma.enquiry.updateMany({
        where: {
          id,
          status: { not: "Converted" },
          OR: [
            { convertedProspectId: null },
            { convertedProspectId: { isSet: false } },
          ],
        },
        data: { status: "Converted", convertedAt: new Date() },
      });

      if (claim.count === 0) {
        return NextResponse.json(
          { error: "This enquiry has already been converted" },
          { status: 409 },
        );
      }

      // The website form has no single "service" field; the ticked services are
      // joined for the prospect's service line and the notes carry the rest.
      const service = existing.services.join(", ");
      const descriptionParts = [
        existing.notes,
        existing.payment ? `Payment preference: ${existing.payment}` : null,
        "Source: businessPlus website enquiry",
      ].filter(Boolean);

      const prospect = await withActor(actor, () =>
        prisma.prospect.create({
          data: {
            name: existing.name,
            email: existing.email,
            phone: existing.phone,
            phoneNumber: existing.phone,
            address: existing.company,
            service,
            description: descriptionParts.join("\n"),
            status: "New",
            leadSourceId: leadSourceId || undefined,
            assignedAgentId,
          },
          select: { id: true, name: true },
        }),
      );

      const enquiry = await prisma.enquiry.update({
        where: { id },
        data: {
          convertedProspectId: prospect.id,
          convertedByAgentId: assignedAgentId,
          updatedById: actor.id,
          updatedByType: actor.type,
        },
        include: { convertedByAgent: { select: { id: true, name: true } } },
      });

      await recordUpdateAudit({
        entityType: "Enquiry",
        entityId: id,
        entityName: existing.name,
        changedFields: ["status", "convertedProspectId"],
        actor,
        req,
      });

      return NextResponse.json({ enquiry, prospect });
    }

    const { status } = body;
    if (!SETTABLE_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${SETTABLE_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }

    if (existing.status === "Converted") {
      return NextResponse.json(
        { error: "A converted enquiry cannot change status" },
        { status: 409 },
      );
    }

    const enquiry = await prisma.enquiry.update({
      where: { id },
      data: { status, updatedById: actor.id, updatedByType: actor.type },
      include: { convertedByAgent: { select: { id: true, name: true } } },
    });

    if (existing.status !== status) {
      await recordUpdateAudit({
        entityType: "Enquiry",
        entityId: id,
        entityName: existing.name,
        changedFields: ["status"],
        actor,
        req,
      });
    }

    return NextResponse.json({ enquiry });
  } catch (error) {
    console.error("Failed to update enquiry:", error);
    return NextResponse.json(
      { error: "Failed to update enquiry" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: RouteContext,
) {
  try {
    const admin = await getCurrentAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.enquiry.findFirst({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
    }

    const actor = actorFromAdmin(admin);

    await prisma.enquiry.update({
      where: { id },
      data: softDeleteData(actor),
    });

    await recordDeletionAudit({
      entityType: "Enquiry",
      entityId: id,
      entityName: existing.name,
      actor,
      req,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete enquiry:", error);
    return NextResponse.json(
      { error: "Failed to delete enquiry" },
      { status: 500 },
    );
  }
}
