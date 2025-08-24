// Centralized fetch wrapper for authenticated requests
export async function fetchWithAuth(input: RequestInfo, init?: RequestInit) {
	const response = await fetch(input, { ...init, credentials: 'include' });

	if (response.status === 401) {
		// Clear the auth-token cookie and localStorage if unauthorized
		document.cookie = "auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
		localStorage.clear();
		window.location.href = "/login";
		window.location.reload(); // Force reload to clear all state
		throw new Error("Unauthorized");
	}

	return response;
}
