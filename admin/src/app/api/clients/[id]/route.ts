import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import {
  recordDeletionAudit,
  recordUpdateAudit,
  changedFields,
  actorFromAdmin,
  softDeleteData,
} from "@/lib/audit";
import { withActor } from "@/lib/auditContext";
import { clientDisplayName } from "@/lib/entityNames";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const client = await prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    return NextResponse.json(client);
  } catch (error) {
    console.error(`Error fetching client ${params.id}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch client" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { email, ...clientData } = body;

    // Check if another client with the same email exists
    const existingClient = await prisma.client.findUnique({
      where: { email },
    });

    if (existingClient && existingClient.id !== id) {
      return NextResponse.json(
        { error: "Client with this email already exists." },
        { status: 400 }
      );
    }

    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const before = await prisma.client.findFirst({ where: { id } });
    if (!before) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const actor = actorFromAdmin(currentAdmin);
    const patch = { ...clientData, email };

    // Proceed to update
    const updatedClient = await withActor(actor, () =>
      prisma.client.update({
        where: { id: id },
        data: patch,
      })
    );

    await recordUpdateAudit({
      entityType: "Client",
      entityId: id,
      entityName: clientDisplayName(updatedClient),
      changedFields: changedFields(before, patch),
      actor,
      req,
    });

    return NextResponse.json(updatedClient);
  } catch (error) {
    console.error(`Error updating client ${params.id}:`, error);
    return NextResponse.json(
      { error: "Failed to update client" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Unwrap params if it's a Promise (Next.js App Router)
    const resolvedParams =
      typeof params.then === "function" ? await params : params;
    const id = resolvedParams.id;
    if (!id) {
      return NextResponse.json({ error: "Missing client id" }, { status: 400 });
    }
    const currentAdmin = await getCurrentAdmin(req);
    if (!currentAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await prisma.client.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const actor = actorFromAdmin(currentAdmin);

    await prisma.client.update({
      where: { id },
      data: softDeleteData(actor),
    });

    await recordDeletionAudit({
      entityType: "Client",
      entityId: id,
      entityName: clientDisplayName(existing),
      actor,
      req,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(`Error deleting client:`, error);
    return NextResponse.json(
      { error: "Failed to delete client" },
      { status: 500 }
    );
  }
}
