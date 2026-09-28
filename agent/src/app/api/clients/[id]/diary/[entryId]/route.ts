import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/auth";
import {
  recordDeletionAudit,
  recordUpdateAudit,
  actorFromAgent,
  softDeleteData,
  updateStampData,
} from "@/lib/audit";
import { diaryDisplayName } from "@/lib/entityNames";
import {
  fetchDiaryRevisions,
  recordDiaryRevisions,
} from "@/lib/clientDiaryRevisions";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const normalizeEntryDate = (rawDate: string) => {
  const trimmedDate = rawDate.trim();
  if (!trimmedDate) return "";

  if (DATE_ONLY_REGEX.test(trimmedDate)) {
    return trimmedDate;
  }

  const parsedDate = new Date(trimmedDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toISOString().slice(0, 10);
};

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  try {
    const { id: clientId, entryId } = await params;

    if (!clientId || !entryId) {
      return NextResponse.json(
        { error: "Missing client id or entry id" },
        { status: 400 },
      );
    }

    const currentAgent = await getCurrentAgent(req);
    if (!currentAgent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const entryDate =
      typeof body.entryDate === "string"
        ? normalizeEntryDate(body.entryDate)
        : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const heading = typeof body.heading === "string" ? body.heading.trim() : "";

    if (!entryDate) {
      return NextResponse.json(
        { error: "Entry date is required" },
        { status: 400 },
      );
    }

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 },
      );
    }

    const existingEntry = await prisma.clientDiaryEntry.findFirst({
      where: { id: entryId },
      select: {
        id: true,
        clientId: true,
        entryDate: true,
        heading: true,
        content: true,
      },
    });

    if (!existingEntry || existingEntry.clientId !== clientId) {
      return NextResponse.json(
        { error: "Diary entry not found" },
        { status: 404 },
      );
    }

    const actor = actorFromAgent(currentAgent);
    const nextValues = { entryDate, heading: heading || null, content };

    const updatedEntry = await prisma.clientDiaryEntry.update({
      where: { id: entryId },
      data: { ...nextValues, ...updateStampData(actor) },
    });

    // The revision rows hold the old and new values; the audit row keeps the
    // diary edit alongside every other UPDATE in the trail. Both no-op when a
    // save changes nothing, which autosave does constantly.
    const changed = await recordDiaryRevisions({
      entryId,
      before: existingEntry,
      after: nextValues,
      actor,
    });

    if (changed.length > 0) {
      await recordUpdateAudit({
        entityType: "ClientDiaryEntry",
        entityId: entryId,
        entityName: diaryDisplayName(updatedEntry),
        changedFields: changed,
        actor,
        req,
      });
    }

    return NextResponse.json({
      entry: updatedEntry,
      revisions: await fetchDiaryRevisions(entryId),
    });
  } catch (error) {
    console.error("Error updating client diary entry:", error);
    return NextResponse.json(
      { error: "Failed to update client diary entry" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  try {
    const { id: clientId, entryId } = await params;

    if (!clientId || !entryId) {
      return NextResponse.json(
        { error: "Missing client id or entry id" },
        { status: 400 },
      );
    }

    const currentAgent = await getCurrentAgent(req);
    if (!currentAgent) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existingEntry = await prisma.clientDiaryEntry.findFirst({
      where: { id: entryId },
      select: { id: true, clientId: true, heading: true, entryDate: true },
    });

    if (!existingEntry || existingEntry.clientId !== clientId) {
      return NextResponse.json(
        { error: "Diary entry not found" },
        { status: 404 },
      );
    }

    const actor = actorFromAgent(currentAgent);

    await prisma.clientDiaryEntry.update({
      where: { id: entryId },
      data: softDeleteData(actor),
    });

    await recordDeletionAudit({
      entityType: "ClientDiaryEntry",
      entityId: entryId,
      entityName: diaryDisplayName(existingEntry),
      parentEntityType: "Client",
      parentEntityId: clientId,
      actor,
      req,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting client diary entry:", error);
    return NextResponse.json(
      { error: "Failed to delete client diary entry" },
      { status: 500 },
    );
  }
}
