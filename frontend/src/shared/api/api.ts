let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;
export const API_BASE = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000";

async function refreshAccessToken(): Promise<boolean> {
    try {
        const res = await fetch(`${API_BASE}/auth/refresh-token`, {
            method: "POST",
            credentials: "include",
        });

        return res.ok;
    } catch (error) {
        console.error("Error refreshing token:", error);
        return false;
    }
}

export async function fetchWithAuth(
    url: string,
    options: RequestInit = {},
): Promise<Response> {

    const config: RequestInit = {
        ...options,
        credentials: "include",
    };

    console.log("Making API request to:", url, "with options:", config);
    let response = await fetch(url, config);
    console.log("Received response:", response);
    if (response.status === 401) {

        if(!isRefreshing) {
            isRefreshing = true;
            refreshPromise = refreshAccessToken();
    }

    const refreshed = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (refreshed) {

        response = await fetch(url, config);
    } else {
        localStorage.removeItem("username");
        localStorage.removeItem("userId");
        localStorage.removeItem("email");
        window.location.href = "/Login";
        throw new Error("Session expired. Please log in again.");
    }
}
return response;
}