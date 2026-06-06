"use client";
import { useState, createContext, useContext, useCallback, type ReactNode } from "react";
import { X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

interface ToastContextValue {
  toast: (t: Omit<Toast, "id">) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

// Null default forces the hook to detect missing provider instead of silently
// falling back to a no-op.
const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Provider (mount once at the root) ───────────────────────────────────────

/**
 * Wraps the entire app so that any descendant can call `useToast()`.
 * Also renders the fixed-position toast stack inside its own Provider boundary,
 * which is why the display container must live here — not as a sibling.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...t, id }]);
    // Auto-dismiss after 4 seconds
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}

      {/* Toast display — lives inside the Provider so it shares the same state */}
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`
              rounded-lg border p-4 shadow-lg animate-fade-in text-sm
              pointer-events-auto flex items-start gap-3
              ${
                t.variant === "destructive"
                  ? "bg-destructive text-destructive-foreground border-red-600"
                  : "bg-card text-card-foreground border-border"
              }
            `}
          >
            <div className="flex-1 min-w-0">
              <p className="font-semibold leading-tight">{t.title}</p>
              {t.description && (
                <p className="mt-1 text-xs opacity-75 leading-snug">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="shrink-0 opacity-50 hover:opacity-100 transition-opacity mt-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the `toast()` function. Must be called inside a `<ToastProvider>`.
 * Falls back gracefully with a console warning rather than hard-crashing.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[useToast] Called outside <ToastProvider>. Toasts will not appear.");
    }
    return { toast: () => {} };
  }
  return ctx;
}

// ─── Legacy export ────────────────────────────────────────────────────────────

/**
 * Kept for import compatibility. The root layout now uses <ToastProvider> directly.
 * This component intentionally renders nothing.
 */
export function Toaster() {
  return null;
}
