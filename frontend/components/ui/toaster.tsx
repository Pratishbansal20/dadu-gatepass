"use client";
import { useState, createContext, useContext, useCallback } from "react";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

interface ToasterContextValue {
  toast: (t: Omit<Toast, "id">) => void;
}

const ToasterContext = createContext<ToasterContextValue>({ toast: () => {} });

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToasterContext.Provider value={{ toast: addToast }}>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg border p-4 shadow-lg animate-fade-in text-sm ${
              t.variant === "destructive"
                ? "bg-destructive text-destructive-foreground border-destructive"
                : "bg-card text-card-foreground border-border"
            }`}
          >
            <p className="font-semibold">{t.title}</p>
            {t.description && <p className="mt-1 opacity-80">{t.description}</p>}
          </div>
        ))}
      </div>
    </ToasterContext.Provider>
  );
}

export function useToast() {
  return useContext(ToasterContext);
}
