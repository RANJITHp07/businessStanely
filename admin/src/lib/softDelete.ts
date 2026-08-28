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
  "ClientDiaryEntry",
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
