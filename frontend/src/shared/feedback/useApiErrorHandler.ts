import { useCallback } from 'react';
import { ApiError } from '@/shared/api/api';
import { toast } from './toastStore';

export type FieldErrorMap = Record<string, string>;

export interface HandleApiErrorOptions {
    /**
     * Per-form mapping of field name → message. If the error has a `field`
     * and a setter is provided, the message is routed there instead of toasted.
     */
    setFieldErrors?: (next: FieldErrorMap | ((prev: FieldErrorMap) => FieldErrorMap)) => void;
    /**
     * Override the user-visible message (e.g. friendlier copy than the
     * backend returned). Falls back to error.message.
     */
    fallbackMessage?: string;
}

/**
 * Single entry point for surfacing fetch failures to the user.
 *
 * Routing policy:
 *  - ApiError with a `field` and a `setFieldErrors` callback → inline error
 *  - Anything else (network failure, 5xx, ApiError without field) → toast
 *
 * Logging side-effects (Sentry/Datadog) belong here too — add one line.
 */
export function handleApiError(error: unknown, opts: HandleApiErrorOptions = {}): void {
    if (error instanceof ApiError) {
        if (error.field && opts.setFieldErrors) {
            const field = error.field;
            opts.setFieldErrors((prev) => ({ ...prev, [field]: error.message }));
            return;
        }
        toast.error(opts.fallbackMessage ?? error.message, error.requestId);
        return;
    }

    // Native fetch network failure or unexpected throw — generic message.
    const message =
        opts.fallbackMessage ??
        (error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    toast.error(message);
}

/** Hook form for components that need a stable callback identity. */
export function useApiErrorHandler() {
    return useCallback(handleApiError, []);
}
