import { NextRequest } from "next/server";
import prisma from "./prisma";

/**
 * Soft-delete and update auditing.
 *
 * Nothing in the business tables is ever hard deleted. A delete stamps
 * `deletedAt`/`deletedById` on the row and appends a DeletionAudit entry; every
 * read path filters on `deletedAt: null` so the row disappears from the app
 * while staying recoverable and traceable.
 *
 * Updates are stamped on the row (`updatedById`/`updatedByType`) and recorded as
 * an UPDATE audit listing which fields changed. Old values are deliberately not
 * stored — the audit answers who and when.
 *
 * The admin app acts as a User and the agent app as an Agent, so every actor is
 * carried as an (id, type) pair rather than a bare user id.
 */

export type ActorType = "USER" | "AGENT";

export interface AuditActor {
  id: string;
  type: ActorType;
  email: string;
  username: string;
}

/** Entity names recorded in the audit trail. */
export type AuditEntityType =
  | "Client"
  | "Prospect"
  | "Opportunity"
  | "Task"
  | "Comment"
  | "TaskCategory"
  | "LeadSource"
  | "TimeLog"
  | "ClientDiaryEntry"
  | "DiaryEntry"
  | "Retainership"
  | "Legislation";

/** Builds an actor from the admin app's getCurrentAdmin() result. */
export function actorFromAdmin(admin: {
  id: string;
  email: string;
  username: string;
}): AuditActor {
  return {
    id: admin.id,
    type: "USER",
    email: admin.email,
    username: admin.username,
  };
}

/** Builds an actor from the agent app's getCurrentAgent() result. */
export function actorFromAgent(agent: {
  id: string;
  email: string;
  name: string;
}): AuditActor {
  return {
    id: agent.id,
    type: "AGENT",
    email: agent.email,
    username: agent.name,
  };
}

/** Fields every soft-deletable row carries. Spread into an update's `data`. */
export function softDeleteData(actor: AuditActor, at: Date = new Date()) {
  return {
    deletedAt: at,
    deletedById: actor.id,
    deletedByType: actor.type,
  };
}

/** Clears the soft-delete stamp. Spread into an update's `data` to restore. */
export function restoreData() {
  return {
    deletedAt: null,
    deletedById: null,
    deletedByType: null,
  };
}

/** Stamps who last updated a row. Spread into an update's `data`. */
export function updateStampData(actor: AuditActor) {
  return {
    updatedById: actor.id,
    updatedByType: actor.type,
  };
}

/**
 * Compares an existing row against an incoming patch and returns the names of
 * the fields whose value actually changes. Used so an UPDATE audit records a
 * real diff rather than every field present in the request body.
 */
export function changedFields(
  before: Record<string, unknown>,
  patch: Record<string, unknown>
): string[] {
  return Object.keys(patch).filter((key) => {
    const a = before[key];
    const b = patch[key];
    if (a instanceof Date || b instanceof Date) {
      const at = a instanceof Date ? a.getTime() : a;
      const bt = b instanceof Date ? b.getTime() : b;
      return at !== bt;
    }
    if (a && b && typeof a === "object" && typeof b === "object") {
      return JSON.stringify(a) !== JSON.stringify(b);
    }
    // Loose compare so null and undefined (absent vs cleared) are not a change.
    return a == null && b == null ? false : a !== b;
  });
}

async function writeAudit(params: {
  entityType: AuditEntityType;
  entityId: string;
  entityName: string;
  action: "SOFT_DELETE" | "RESTORE" | "UPDATE";
  reason?: string | null;
  changedFields?: string[];
  affectedTaskCount?: number;
  affectedLegislationCount?: number;
  parentEntityType?: string | null;
  parentEntityId?: string | null;
  actor: AuditActor;
  req?: NextRequest;
}) {
  const { actor, req } = params;

  return prisma.deletionAudit.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      entityName: params.entityName,
      action: params.action,
      reason: params.reason ?? null,
      changedFields: params.changedFields ?? [],
      affectedTaskCount: params.affectedTaskCount ?? 0,
      affectedLegislationCount: params.affectedLegislationCount ?? 0,
      parentEntityType: params.parentEntityType ?? null,
      parentEntityId: params.parentEntityId ?? null,
      performedById: actor.id,
      performedByType: actor.type,
      performedByEmail: actor.email,
      performedByUsername: actor.username,
      ipAddress: req ? getClientIp(req) : null,
      userAgent: req?.headers.get("user-agent") ?? null,
    },
  });
}

/** Records a soft delete (or a cascaded one, via parentEntity*). */
export async function recordDeletionAudit(params: {
  entityType: AuditEntityType;
  entityId: string;
  entityName: string;
  action?: "SOFT_DELETE" | "RESTORE";
  reason?: string | null;
  affectedTaskCount?: number;
  affectedLegislationCount?: number;
  parentEntityType?: string | null;
  parentEntityId?: string | null;
  actor: AuditActor;
  req?: NextRequest;
}) {
  return writeAudit({ ...params, action: params.action ?? "SOFT_DELETE" });
}

/**
 * Records an update. No-ops when nothing actually changed, so a save that
 * touches no values does not fill the trail with empty rows.
 */
export async function recordUpdateAudit(params: {
  entityType: AuditEntityType;
  entityId: string;
  entityName: string;
  changedFields: string[];
  actor: AuditActor;
  req?: NextRequest;
}) {
  if (params.changedFields.length === 0) return null;
  return writeAudit({ ...params, action: "UPDATE" });
}

function getClientIp(req: NextRequest): string | null {
  // Behind a proxy the original client is the first entry of x-forwarded-for.
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}
