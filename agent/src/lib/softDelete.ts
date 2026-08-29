import { Prisma } from "@prisma/client";

import { currentActor } from "./auditContext";

/**
 * Prisma client extension that makes soft delete the default everywhere.
 *
 * Two things happen automatically for every model in SOFT_DELETE_MODELS:
 *
 *  1. Reads (findMany/findFirst/findUnique/count/aggregate/groupBy) get
 *     `deletedAt: null` merged into their filter, so deleted rows vanish from
 *     the app without every call site needing to remember.
 *  2. `delete`/`deleteMany` are rewritten into an update that stamps
 *     `deletedAt`, so a stray hard delete cannot slip through.
 *
 * Writing this as an extension rather than editing ~150 query sites is
 * deliberate: a missed call site is invisible until deleted data resurfaces in
 * production, and new code would have to remember the filter forever.
 *
 * To read deleted rows on purpose (restore flows, the audit screen), use the
 * unextended client exported as `prismaRaw`.
 */
export const SOFT_DELETE_MODELS = [
  "Client",
  "Prospect",
  "Opportunity",
  "Task",
  "Comment",
  "TaskCategory",
  "LeadSource",
  "TimeLog",
  "DiaryEntry",
  "Retainership",
  "Legislation",
] as const;

const SOFT_DELETE_MODEL_SET: ReadonlySet<string> = new Set(SOFT_DELETE_MODELS);

const READ_OPERATIONS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);

/**
 * findUnique only accepts unique fields in `where`, so a `deletedAt` filter is
 * illegal there. These are rerouted to findFirst, which accepts it.
 */
const UNIQUE_TO_FIRST: Record<string, string> = {
  findUnique: "findFirst",
  findUniqueOrThrow: "findFirstOrThrow",
};

/**
 * Matches rows that are not soft deleted.
 *
 * On MongoDB, `deletedAt: null` does NOT match documents where the field is
 * absent, and every row written before this feature shipped has no `deletedAt`
 * at all. Filtering on null alone would therefore hide the entire existing
 * dataset, so absent (`isSet: false`) and explicit null are both matched.
 */
export const NOT_DELETED = {
  OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
} as const;

export function withSoftDelete<T>(client: T): T {
  // @ts-expect-error - $extends exists on PrismaClient at runtime.
  return client.$extends({
    name: "softDelete",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          if (!model || !SOFT_DELETE_MODEL_SET.has(model)) {
            return query(args);
          }

          if (READ_OPERATIONS.has(operation)) {
            const next = { ...args };

            // An explicit deletedAt filter from the caller always wins, so
            // restore and audit flows can still look at deleted rows. Nested
            // AND/OR/NOT are searched too, since callers routinely wrap their
            // conditions rather than putting deletedAt at the top level.
            const alreadyFiltered = mentionsDeletedAt(next.where);

            if (!alreadyFiltered) {
              next.where = mergeNotDeleted(next.where);
            }

            next.where = filterRelationConditions(model, next.where);

            // Nested relations are loaded inside the same query, so the
            // extension hook never fires for them. Walk include/select and add
            // the filter to any relation pointing at a soft-deletable model.
            if (next.include) next.include = filterNested(model, next.include);
            if (next.select) next.select = filterNested(model, next.select);

            const rerouted = UNIQUE_TO_FIRST[operation];
            if (rerouted && !alreadyFiltered) {
              // @ts-expect-error - dynamic model access is untyped.
              return client[lowerFirst(model)][rerouted](next);
            }

            return query(next);
          }

          if (operation === "delete" || operation === "deleteMany") {
            const actor = currentActor();
            const data = {
              deletedAt: new Date(),
              ...(actor
                ? { deletedById: actor.id, deletedByType: actor.type }
                : {}),
            };

            // @ts-expect-error - dynamic model access is untyped.
            const delegate = client[lowerFirst(model)];

            if (operation === "delete") {
              return delegate.update({ where: args.where, data });
            }
            return delegate.updateMany({
              where: mergeNotDeleted(args.where),
              data,
            });
          }

          // Stamp who last touched the row. The caller's own values win, so an
          // explicit soft delete or restore is never overwritten here.
          if (operation === "update" || operation === "updateMany") {
            const actor = currentActor();
            if (actor && args.data && typeof args.data === "object") {
              const data: any = args.data;
              const stamped = {
                ...data,
                ...(("updatedById" in data) ? {} : { updatedById: actor.id }),
                ...(("updatedByType" in data) ? {} : { updatedByType: actor.type }),
              };
              return query({ ...args, data: stamped });
            }
          }

          return query(args);
        },
      },
    },
  });
}

/**
 * Relation name -> target model, per model, taken from the generated schema so
 * it cannot drift out of sync with prisma/schema.prisma.
 */
const RELATION_TARGETS: Map<string, Map<string, { type: string; isList: boolean }>> =
  (() => {
    const map = new Map<string, Map<string, { type: string; isList: boolean }>>();
    try {
      const models = (Prisma as any)?.dmmf?.datamodel?.models ?? [];
      for (const m of models) {
        const relations = new Map<string, { type: string; isList: boolean }>();
        for (const f of m.fields) {
          if (f.kind === "object") {
            relations.set(f.name, { type: f.type, isList: !!f.isList });
          }
        }
        map.set(m.name, relations);
      }
    } catch {
      // If the DMMF shape ever changes, nested filtering is skipped rather than
      // throwing. Top-level filtering still applies.
    }
    return map;
  })();

/**
 * Recursively adds the not-deleted condition to nested include/select clauses.
 *
 * Only to-many relations get a `where`: a to-one relation cannot be filtered
 * that way in Prisma, and nulling it out would change the shape callers expect
 * (a task whose client was deleted still needs to render). To-one relations are
 * still walked so deeper to-many relations underneath them are covered.
 */
function filterNested(model: string, clause: any): any {
  if (!clause || typeof clause !== "object") return clause;

  const relations = RELATION_TARGETS.get(model);
  if (!relations) return clause;

  const out: any = Array.isArray(clause) ? [...clause] : { ...clause };

  for (const [key, value] of Object.entries(out)) {
    // `_count: { select: { comments: true } }` counts relation rows, so its
    // inner select needs the same treatment as a normal nested read.
    if (key === "_count") {
      if (value && typeof value === "object" && (value as any).select) {
        out[key] = {
          ...(value as any),
          select: filterNested(model, (value as any).select),
        };
      }
      continue;
    }

    const relation = relations.get(key);
    if (!relation) continue;

    const target = relation.type;
    const targetIsSoftDeletable = SOFT_DELETE_MODEL_SET.has(target);

    // `include: { comments: true }` has no object to merge into, so it is
    // expanded to `{ where: NOT_DELETED }` first.
    if (value === true) {
      if (targetIsSoftDeletable && relation.isList) {
        out[key] = { where: { ...NOT_DELETED } };
      }
      continue;
    }

    if (!value || typeof value !== "object") continue;

    let nested: any = { ...(value as any) };

    if (targetIsSoftDeletable && relation.isList && !mentionsDeletedAt(nested.where)) {
      nested.where = mergeNotDeleted(nested.where);
    }

    if (nested.include) nested.include = filterNested(target, nested.include);
    if (nested.select) nested.select = filterNested(target, nested.select);

    out[key] = nested;
  }

  return out;
}

/** True if `deletedAt` appears anywhere in a filter, including inside AND/OR/NOT. */
function mentionsDeletedAt(where: any): boolean {
  if (!where || typeof where !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(where, "deletedAt")) return true;
  for (const key of ["AND", "OR", "NOT"]) {
    const clause = where[key];
    if (!clause) continue;
    const list = Array.isArray(clause) ? clause : [clause];
    if (list.some(mentionsDeletedAt)) return true;
  }
  return false;
}

/**
 * Adds the not-deleted condition inside relation filters (`some`/`none`/`every`)
 * so a row whose only related records are deleted does not match.
 */
function filterRelationConditions(model: string, where: any): any {
  if (!where || typeof where !== "object") return where;

  const relations = RELATION_TARGETS.get(model);
  if (!relations) return where;

  const out: any = { ...where };

  for (const [key, value] of Object.entries(out)) {
    // Recurse through boolean combinators first.
    if (key === "AND" || key === "OR" || key === "NOT") {
      const list = Array.isArray(value) ? value : [value];
      const mapped = list.map((entry) => filterRelationConditions(model, entry));
      out[key] = Array.isArray(value) ? mapped : mapped[0];
      continue;
    }

    const relation = relations.get(key);
    if (!relation || !value || typeof value !== "object") continue;

    const target = relation.type;
    if (!SOFT_DELETE_MODEL_SET.has(target)) continue;

    const condition: any = { ...(value as any) };

    if (relation.isList) {
      for (const op of ["some", "none", "every"]) {
        if (condition[op] && !mentionsDeletedAt(condition[op])) {
          condition[op] = mergeNotDeleted(
            filterRelationConditions(target, condition[op])
          );
        }
      }
    } else if (!mentionsDeletedAt(condition)) {
      // A to-one relation filter (`client: { name: "x" }`) should not match
      // through a deleted parent.
      Object.assign(condition, NOT_DELETED);
    }

    out[key] = condition;
  }

  return out;
}

/**
 * Adds the not-deleted condition to a filter without clobbering an OR the
 * caller already supplied: the two are combined under AND.
 */
function mergeNotDeleted(where: any) {
  if (!where) return { ...NOT_DELETED };
  if (where.OR) {
    const { OR, ...rest } = where;
    return { ...rest, AND: [...(where.AND ?? []), { OR }, { ...NOT_DELETED }] };
  }
  return { ...where, ...NOT_DELETED };
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

export type SoftDeleteModel = (typeof SOFT_DELETE_MODELS)[number];

/**
 * Filter for reading only deleted rows (restore screens, audit views).
 *
 * Because it mentions `deletedAt`, the extension treats it as an explicit
 * filter and leaves it alone rather than adding the not-deleted condition.
 */
export const onlyDeleted = { deletedAt: { not: null } };

/**
 * Filter that ignores the soft-delete state entirely, returning deleted and
 * live rows together. `isSet` is always true or false, so this matches every
 * row while still counting as an explicit `deletedAt` filter.
 */
export const includeDeleted = {
  OR: [{ deletedAt: { isSet: true } }, { deletedAt: { isSet: false } }],
};
