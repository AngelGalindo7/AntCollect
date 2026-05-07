import { clearSession } from '@/shared/auth/session';

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;
export const API_BASE = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000";

/**
 * Backend canonical error envelope (see backend/errors.py + main.py handlers).
 * `detail` is a transitional shim and may disappear once all callers migrate.
 */
export interface ApiErrorEnvelope {
    error?: {
        code?: string;
        message?: string;
        field?: string | null;
        request_id?: string | null;
    };
    detail?: string;
}

/**
 * Thrown by fetchWithAuth on any non-2xx response. Carries the structured
 * code/field so feature code can branch on `e.code` and surface
 * field-specific errors inline without parsing strings.
 */
export class ApiError extends Error {
    readonly status: number;
    readonly code: string;
    readonly field: string | null;
    readonly requestId: string | null;

    constructor(opts: {
        status: number;
        code: string;
        message: string;
        field?: string | null;
        requestId?: string | null;
    }) {
        super(opts.message);
        this.name = 'ApiError';
        this.status = opts.status;
        this.code = opts.code;
        this.field = opts.field ?? null;
        this.requestId = opts.requestId ?? null;
    }
}

async function buildApiError(response: Response): Promise<ApiError> {
    let envelope: ApiErrorEnvelope = {};
    try {
        envelope = (await response.clone().json()) as ApiErrorEnvelope;
    } catch {
        // Body wasn't JSON (HTML error page, network appliance) — fall through
        // and synthesize a generic error from the status code.
    }
    const message =
        envelope.error?.message ?? envelope.detail ?? `Request failed with status ${response.status}`;
    return new ApiError({
        status: response.status,
        code: envelope.error?.code ?? 'UNKNOWN_ERROR',
        message,
        field: envelope.error?.field ?? null,
        requestId: envelope.error?.request_id ?? response.headers.get('X-Request-ID'),
    });
}

export async function refreshAccessToken(): Promise<boolean> {
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

/**
 * Pass `throwOnError: true` to make non-2xx responses throw an ApiError.
 * Default is false so legacy callers that read `res.status` keep working;
 * new code should always opt in. Once all callers migrate, the default flips.
 */
export interface FetchWithAuthOptions extends RequestInit {
    throwOnError?: boolean;
}

export async function fetchWithAuth(
    url: string,
    options: FetchWithAuthOptions = {},
): Promise<Response> {
    const { throwOnError = false, ...rest } = options;
    const config: RequestInit = {
        ...rest,
        credentials: "include",
    };

    let response = await fetch(url, config);
    if (response.status === 401) {

        if (!isRefreshing) {
            isRefreshing = true;
            refreshPromise = refreshAccessToken();
        }

        const refreshed = await refreshPromise;
        isRefreshing = false;
        refreshPromise = null;

        if (refreshed) {
            response = await fetch(url, config);
        } else {
            clearSession();
            window.location.href = "/Login";
            throw new Error("Session expired. Please log in again.");
        }
    }

    if (throwOnError && !response.ok) {
        throw await buildApiError(response);
    }

    return response;
}

/**
 * Thin wrapper that always throws ApiError on non-2xx. Use this from new
 * features and migrated callers; the underlying fetchWithAuth retains its
 * legacy Response-returning behavior for back-compat.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
    return fetchWithAuth(url, { ...options, throwOnError: true });
}

/**
 * Fetch for public (optional-auth) endpoints. Sends cookies so authenticated
 * users get personalized data (is_liked, is_owner). On 401 does NOT redirect
 * to login — the backend simply returns guest-level data instead.
 * Use this for read endpoints that back optional_auth_token on the server.
 */
export async function fetchPublic(url: string, options: RequestInit = {}): Promise<Response> {
    return fetch(url, { ...options, credentials: 'include' });
}
