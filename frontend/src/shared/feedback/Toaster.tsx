import { useToastStore } from './toastStore';
import type { Toast } from './toastStore';

const VARIANT_STYLES: Record<Toast['variant'], string> = {
    error: 'bg-brick-red text-white',
    success: 'bg-emerald-600 text-white',
    info: 'bg-espresso text-warm-cream',
};

export function Toaster() {
    const toasts = useToastStore((s) => s.toasts);
    const dismiss = useToastStore((s) => s.dismiss);

    if (toasts.length === 0) return null;

    return (
        <div
            className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm"
            role="region"
            aria-label="Notifications"
        >
            {toasts.map((t) => (
                <div
                    key={t.id}
                    role={t.variant === 'error' ? 'alert' : 'status'}
                    className={`${VARIANT_STYLES[t.variant]} rounded-lg shadow-lg px-4 py-3 flex items-start gap-3 animate-[fadeIn_0.15s_ease-out]`}
                >
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug break-words">{t.message}</p>
                        {t.requestId && (
                            <p className="text-[10px] opacity-70 mt-0.5 font-mono">id: {t.requestId}</p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => dismiss(t.id)}
                        className="text-lg leading-none opacity-70 hover:opacity-100"
                        aria-label="Dismiss"
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
}
