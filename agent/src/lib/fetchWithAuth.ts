// Centralized fetch wrapper for authenticated requests in the agent app
let isRedirectingToLogin = false;

interface FetchWithAuthOptions extends RequestInit {
  // When true, a 401 response returns the response object instead of redirecting to login.
  silent401?: boolean;
}

export async function fetchWithAuth(input: RequestInfo, init?: FetchWithAuthOptions) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const { silent401, ...fetchInit } = init ?? {};

  const headers: Record<string, string> = {
    ...(fetchInit?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(input, { ...fetchInit, credentials: 'include', headers });

  if (response.status === 401 && !silent401) {
    if (!isRedirectingToLogin) {
      isRedirectingToLogin = true;
      document.cookie = "agent-auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      localStorage.clear();
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }

  return response;
}
