import { AsyncLocalStorage } from "node:async_hooks";
import type { AuditActor } from "./audit";

/**
 * Request-scoped current actor.
 *
 * The soft-delete extension stamps `updatedById`/`deletedById` on every write,
 * but a Prisma extension has no access to the HTTP request. Route handlers put
 * the actor here once and the extension reads it back, so individual queries do
 * not each have to thread the actor through.
 *
 * AsyncLocalStorage keeps this per-request: concurrent requests each see their
 * own actor, unlike a module-level variable which they would race over.
 */
const actorStorage = new AsyncLocalStorage<AuditActor>();

/**
 * Runs `fn` with `actor` as the current actor.
 *
 * The callback is awaited *inside* the storage scope on purpose. Prisma's
 * query methods return lazy thenables: returning one without awaiting it hands
 * back an unstarted query, which then executes after `run()` has already exited
 * and sees no actor. Awaiting here means callers can write the natural
 * `withActor(actor, () => prisma.x.update(...))` and still get stamped.
 */
export async function withActor<T>(
  actor: AuditActor,
  fn: () => Promise<T> | T
): Promise<T> {
  return actorStorage.run(actor, async () => await fn());
}

/** The actor for the current request, when one was established. */
export function currentActor(): AuditActor | undefined {
  return actorStorage.getStore();
}
