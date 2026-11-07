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
