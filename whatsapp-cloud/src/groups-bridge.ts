import { CloudApiError } from "./graph.js";

// Groups do not go through Meta. The separate `whatsapp-groups/` service is a
// WhatsApp Web linked device on the same number; it pushes group messages into
// this service (POST /groups/ingest) and this service calls it to send.
// Set WHATSAPP_GROUPS_URL to turn the bridge on.

const baseUrl = (process.env.WHATSAPP_GROUPS_URL ?? "").trim().replace(/\/+$/, "");
const token = process.env.WHATSAPP_SERVICE_TOKEN?.trim() || "";
const TIMEOUT_MS = 60 * 1000;

export const groupsBridgeEnabled = Boolean(baseUrl);

export async function groupsRequest<T>(path: string, body: unknown): Promise<T> {
  if (!baseUrl) throw new CloudApiError("WhatsApp groups are not enabled (WHATSAPP_GROUPS_URL is not set).", 503);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-whatsapp-service-token": token },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new CloudApiError(
      `The WhatsApp groups service is not reachable: ${error instanceof Error ? error.message : String(error)}`,
      503,
    );
  }
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new CloudApiError(data.error || `WhatsApp groups service returned ${response.status}.`, response.status);
  }
  return data;
}

export type GroupsHealth = { status: string; error: string | null; linkedAs: string | null };

// Never throws: an unreachable groups service is reported as "unreachable".
export async function groupsHealth(): Promise<GroupsHealth> {
  try {
    const response = await fetch(`${baseUrl}/status`, {
      headers: { "x-whatsapp-service-token": token },
      signal: AbortSignal.timeout(5000),
    });
    const data = (await response.json().catch(() => ({}))) as Partial<GroupsHealth> & { error?: string };
    if (!response.ok) return { status: "error", error: data.error || `HTTP ${response.status}`, linkedAs: null };
    return { status: data.status ?? "unknown", error: data.error ?? null, linkedAs: data.linkedAs ?? null };
  } catch (error) {
    return {
      status: "unreachable",
      error: `The WhatsApp groups service is not reachable: ${error instanceof Error ? error.message : String(error)}`,
      linkedAs: null,
    };
  }
}
