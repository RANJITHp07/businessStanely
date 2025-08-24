// Centralized fetch wrapper for authenticated requests
export async function fetchWithAuth(input: RequestInfo, init?: RequestInit) {
	const response = await fetch(input, { ...init, credentials: 'include' });

	if (response.status === 401) {
		// Clear the auth-token cookie if unauthorized
		document.cookie = "auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
		window.location.href = "/login";
		throw new Error("Unauthorized");
	}

	return response;
}
