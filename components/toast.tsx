"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";

/* ── Types ──────────────────────────────────────────────────────── */
export type ToastVariant = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  exiting?: boolean;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

/* ── Context ────────────────────────────────────────────────────── */
const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

/* ── Variant config ─────────────────────────────────────────────── */
const VARIANT_CONFIG: Record<ToastVariant, {
  icon: React.ReactNode;
  border: string;
  bg: string;
  iconColor: string;
}> = {
  success: {
    icon: <CheckCircle2 size={15} />,
    border: "rgba(16,185,129,0.35)",
    bg: "rgba(16,185,129,0.08)",
    iconColor: "#6ee7b7",
  },
  error: {
    icon: <XCircle size={15} />,
    border: "rgba(239,68,68,0.35)",
    bg: "rgba(239,68,68,0.08)",
    iconColor: "#fca5a5",
  },
  info: {
    icon: <Info size={15} />,
    border: "rgba(79,110,247,0.35)",
    bg: "rgba(79,110,247,0.08)",
    iconColor: "#93b4fd",
  },
  warning: {
    icon: <AlertTriangle size={15} />,
    border: "rgba(245,158,11,0.35)",
    bg: "rgba(245,158,11,0.08)",
    iconColor: "#fcd34d",
  },
};

/* ── Single toast item ──────────────────────────────────────────── */
function ToastItem({ t, onRemove }: { t: Toast; onRemove: (id: string) => void }) {
  const cfg = VARIANT_CONFIG[t.variant];
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3.5 rounded-xl shadow-2xl max-w-sm w-full ${
        t.exiting ? "nh-toast-exit" : "nh-toast-enter"
      }`}
      style={{
        background: "rgba(4, 9, 26, 0.96)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: `1px solid ${cfg.border}`,
        boxShadow: `0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px ${cfg.bg}`,
      }}
    >
      <span style={{ color: cfg.iconColor }} className="shrink-0 mt-0.5">{cfg.icon}</span>
      <p className="text-sm text-[#c8d8f0] leading-snug flex-1">{t.message}</p>
      <button
        onClick={() => onRemove(t.id)}
        className="shrink-0 text-[#3a4e70] hover:text-[#6c80a8] transition-colors ml-1"
      >
        <X size={13} />
      </button>
    </div>
  );
}

/* ── Provider ───────────────────────────────────────────────────── */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  function removeToast(id: string) {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 320);
  }

  const toast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = `toast-${++counterRef.current}`;
    setToasts(prev => [...prev, { id, message, variant }]);
    setTimeout(() => removeToast(id), 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast stack */}
      <div
        className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
        aria-live="polite"
      >
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem t={t} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
