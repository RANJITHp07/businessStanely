// Thin client for Meta's WhatsApp Cloud API (Graph API).
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api

export const graphVersion = process.env.WA_CLOUD_GRAPH_VERSION?.trim() || "v23.0";
// Overridable so the service can be exercised against a local mock.
const graphBaseUrl = (
  process.env.WA_CLOUD_GRAPH_BASE_URL?.trim() || "https://graph.facebook.com"
).replace(/\/+$/, "");

const requestTimeoutMs = Number(process.env.WA_CLOUD_REQUEST_TIMEOUT_MS ?? 30000);

export class CloudApiError extends Error {
  status: number;
  code: number | null;

  constructor(message: string, status: number, code: number | null = null) {
    super(message);
    this.name = "CloudApiError";
    this.status = status;
    this.code = code;
  }
}

type GraphErrorBody = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    error_data?: { details?: string };
  };
};

function graphUrl(path: string, query?: Record<string, string>) {
  const url = new URL(`${graphBaseUrl}/${graphVersion}/${path.replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value);
  }
  return url;
}

async function parseGraphResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = (data as GraphErrorBody | null)?.error;
    const details = error?.error_data?.details;
    const message =
      [error?.message, details].filter(Boolean).join(" — ") ||
      `Graph API request failed with HTTP ${response.status}.`;
    // Graph returns 400 for most business-rule failures; surface them as 422
    // so the admin UI shows the reason instead of a generic server error.
    const status = response.status === 400 ? 422 : response.status;
    throw new CloudApiError(message, status, error?.code ?? null);
  }

  return data as T;
}

export async function graphRequest<T>(
  token: string,
  method: "GET" | "POST" | "DELETE",
  path: string,
  options: { query?: Record<string, string>; body?: unknown } = {},
): Promise<T> {
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(graphUrl(path, options.query), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body !== undefined && !isForm
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body:
      options.body === undefined
        ? undefined
        : isForm
          ? (options.body as FormData)
          : JSON.stringify(options.body),
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  return parseGraphResponse<T>(response);
}

// Exchanges the short-lived Embedded Signup code for a business token.
export async function exchangeSignupCode(
  appId: string,
  appSecret: string,
  code: string,
  redirectUris: string[] = [],
) {
  const exchange = async (redirectUri?: string) => {
    const response = await fetch(
      graphUrl("oauth/access_token", {
        client_id: appId,
        client_secret: appSecret,
        code,
        // Keep Meta's error messages in English whatever the account locale.
        locale: "en_US",
        ...(redirectUri !== undefined ? { redirect_uri: redirectUri } : {}),
      }),
      { signal: AbortSignal.timeout(requestTimeoutMs) },
    );
    return parseGraphResponse<{ access_token?: string }>(response);
  };

  // Meta binds the code to the redirect_uri of the login request. For the
  // JavaScript SDK popup that is usually none, sometimes an empty one, and
  // sometimes the page the login started from. A rejected attempt does not use
  // up the code, so try each candidate until one is accepted.
  // The page sends the exact redirect_uri of a redirect-flow login: try it first.
  // Meta often stores the redirect_uri with a trailing slash and then wants
  // that form at exchange time, so try each address with and without it.
  const withSlashVariants = redirectUris
    .filter(Boolean)
    .flatMap((uri) => (uri.endsWith("/") ? [uri, uri.replace(/\/+$/, "")] : [uri, `${uri}/`]));
  const candidates: Array<string | undefined> = [...new Set(withSlashVariants), undefined, ""];
  let data: { access_token?: string } | null = null;
  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      data = await exchange(candidate);
      if (candidate !== undefined) {
        console.log(`[WhatsApp Cloud] Code exchange accepted with redirect_uri "${candidate}".`);
      }
      break;
    } catch (error) {
      lastError = error;
      // 100 = redirect_uri mismatch, 191 = URL domain not in the app's domains.
      // Messages can come back localized, so check the code too.
      const retryable =
        error instanceof CloudApiError &&
        (error.code === 100 || error.code === 191 || /redirect_uri|domain/i.test(error.message));
      if (!retryable) throw error;
      console.warn(
        `[WhatsApp Cloud] Code exchange rejected for redirect_uri ${JSON.stringify(candidate ?? null)}: ${(error as Error).message}`,
      );
    }
  }
  if (!data) throw lastError;
  if (!data.access_token) {
    throw new CloudApiError("Meta did not return an access token.", 502);
  }
  return data.access_token;
}

export type TokenInfo = {
  /** Unix seconds; 0 means the token never expires. */
  expiresAt: number;
  scopes: string[];
  /** WhatsApp Business account ids the token was granted. */
  wabaIds: string[];
};

// Asks Meta what a token can access. Used when Embedded Signup returns only
// the auth code and not the phone number / WABA ids.
export async function inspectToken(appId: string, appSecret: string, token: string): Promise<TokenInfo> {
  const response = await fetch(
    graphUrl("debug_token", { input_token: token, access_token: `${appId}|${appSecret}` }),
    { signal: AbortSignal.timeout(requestTimeoutMs) },
  );
  const { data } = await parseGraphResponse<{
    data?: {
      expires_at?: number;
      scopes?: string[];
      granular_scopes?: Array<{ scope: string; target_ids?: string[] }>;
    };
  }>(response);
  const wabaIds = new Set<string>();
  for (const grant of data?.granular_scopes ?? []) {
    if (grant.scope.startsWith("whatsapp_business_")) {
      for (const id of grant.target_ids ?? []) wabaIds.add(id);
    }
  }
  return { expiresAt: data?.expires_at ?? 0, scopes: data?.scopes ?? [], wabaIds: [...wabaIds] };
}

// Media URLs returned by Graph are short-lived and must be fetched with the
// same bearer token.
export async function downloadMedia(token: string, mediaId: string) {
  const meta = await graphRequest<{
    url?: string;
    mime_type?: string;
    file_size?: number;
  }>(token, "GET", mediaId);
  if (!meta.url) {
    throw new CloudApiError("Media is no longer available on WhatsApp.", 404);
  }

  const response = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(requestTimeoutMs * 2),
  });
  if (!response.ok) {
    throw new CloudApiError(
      `Failed to download media (HTTP ${response.status}).`,
      response.status === 404 ? 404 : 502,
    );
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimetype: meta.mime_type || response.headers.get("content-type") || "application/octet-stream",
  };
}
