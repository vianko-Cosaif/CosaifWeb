// src/app/Components/ui/Toast.tsx
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  X as CloseIcon,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
} from "lucide-react";

/* =======================
 * Tipos / API pública
 * ======================= */
export type ToastVariant = "success" | "info" | "warning" | "error";

export interface ToastOptions {
  id?: number;
  title?: string;
  description?: React.ReactNode;
  variant?: ToastVariant;
  /** ms; por defecto 5000. Usa 0 para persistente. */
  duration?: number;
  /** Acción secundaria opcional */
  action?: { label: string; onClick: () => void };
}

export interface ToastHandle extends Omit<Required<ToastOptions>, "action"> {
  id: number;
  createdAt: number;
  action?: { label: string; onClick: () => void };
}

type Position =
  | "top-right"
  | "top-center"
  | "top-left"
  | "bottom-right"
  | "bottom-center"
  | "bottom-left";

export interface ToastProviderProps {
  children: React.ReactNode;
  /** Máximo de toasts visibles (FIFO). Default 5 */
  maxToasts?: number;
  /** Posición en pantalla. Default top-right */
  position?: Position;
  /** Duración por defecto (ms). Default 5000 */
  defaultDuration?: number;
}

/* =======================
 * Contexto / Provider
 * ======================= */
type Ctx = {
  push: (opts: ToastOptions) => number;
  dismiss: (id?: number) => void;
  clear: () => void;
  success: (opts: Omit<ToastOptions, "variant">) => number;
  info: (opts: Omit<ToastOptions, "variant">) => number;
  warning: (opts: Omit<ToastOptions, "variant">) => number;
  error: (opts: Omit<ToastOptions, "variant">) => number;
};

const ToastCtx = createContext<Ctx | null>(null);

export function ToastProvider({
  children,
  maxToasts = 5,
  position = "top-right",
  defaultDuration = 5000,
}: ToastProviderProps) {
  const prefersReduced = useReducedMotion();
  const [toasts, setToasts] = useState<ToastHandle[]>([]);
  const timers = useRef<Map<number, number>>(new Map());

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const tm = timers.current.get(id);
    if (tm) {
      clearTimeout(tm);
      timers.current.delete(id);
    }
  }, []);

  const schedule = useCallback((toast: ToastHandle) => {
    if (toast.duration > 0) {
      const tm = window.setTimeout(() => remove(toast.id), toast.duration);
      timers.current.set(toast.id, tm);
    }
  }, [remove]);

  const push = useCallback(
    (opts: ToastOptions) => {
      const id = opts.id ?? Date.now() + Math.floor(Math.random() * 1000);
      const item: ToastHandle = {
        id,
        title: opts.title ?? "",
        description: opts.description ?? "",
        variant: opts.variant ?? "info",
        duration:
          typeof opts.duration === "number" ? Math.max(0, opts.duration) : defaultDuration,
        action: opts.action,
        createdAt: Date.now(),
      };
      setToasts((t) => {
        const next = [item, ...t].slice(0, maxToasts);
        // Si truncamos, limpia temporizador del último
        if (next.length !== t.length + 1) {
          const last = next[next.length - 1];
          const cut = t.find((x) => !next.some((y) => y.id === x.id));
          if (cut) {
            const tm = timers.current.get(cut.id);
            if (tm) clearTimeout(tm);
            timers.current.delete(cut.id);
          }
          // Mantener orden (recientes arriba)
        }
        return next;
      });
      schedule(item);
      return id;
    },
    [defaultDuration, maxToasts, schedule]
  );

  const dismiss = useCallback(
    (id?: number) => {
      if (!id) {
        // Dismiss más reciente
        const top = toasts[0];
        if (top) remove(top.id);
        return;
      }
      remove(id);
    },
    [remove, toasts]
  );

  const clear = useCallback(() => {
    timers.current.forEach((tm) => clearTimeout(tm));
    timers.current.clear();
    setToasts([]);
  }, []);

  const api = useMemo<Ctx>(
    () => ({
      push,
      dismiss,
      clear,
      success: (o) => push({ ...o, variant: "success" }),
      info: (o) => push({ ...o, variant: "info" }),
      warning: (o) => push({ ...o, variant: "warning" }),
      error: (o) => push({ ...o, variant: "error" }),
    }),
    [push, dismiss, clear]
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <Viewport position={position}>
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastItem
              key={t.id}
              toast={t}
              onClose={() => dismiss(t.id)}
              prefersReduced={!!prefersReduced}
            />
          ))}
        </AnimatePresence>
      </Viewport>
    </ToastCtx.Provider>
  );
}

/* =======================
 * Hook de consumo
 * ======================= */
export function useToast(): Ctx {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    throw new Error("useToast() debe usarse dentro de <ToastProvider>");
  }
  return ctx;
}

/* =======================
 * Presentación
 * ======================= */
function Viewport({
  children,
  position,
}: {
  children: React.ReactNode;
  position: Position;
}) {
  const posCls = {
    "top-right": "top-4 right-4 items-end",
    "top-center": "top-4 left-1/2 -translate-x-1/2 items-center",
    "top-left": "top-4 left-4 items-start",
    "bottom-right": "bottom-4 right-4 items-end",
    "bottom-center": "bottom-4 left-1/2 -translate-x-1/2 items-center",
    "bottom-left": "bottom-4 left-4 items-start",
  }[position];

  return (
    <div
      className={[
        "pointer-events-none fixed z-[60] flex w-full max-w-sm flex-col gap-2",
        posCls,
      ].join(" ")}
      aria-live="polite"
      role="region"
      aria-label="Notificaciones"
    >
      {children}
    </div>
  );
}

function ToastItem({
  toast,
  onClose,
  prefersReduced,
}: {
  toast: ToastHandle;
  onClose: () => void;
  prefersReduced: boolean;
}) {
  const { icon, ring, bg, text, border } = variantStyles(toast.variant);

  return (
    <motion.div
      initial={prefersReduced ? { opacity: 0 } : { x: 24, opacity: 0, scale: 0.96 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ x: 24, opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      role={toast.variant === "error" || toast.variant === "warning" ? "alert" : "status"}
      className={[
        "pointer-events-auto overflow-hidden rounded-md border bg-white shadow-lg backdrop-blur-sm",
        "dark:bg-slate-900",
        border,
        ring,
        "w-full",
      ].join(" ")}
    >
      <div className="flex items-start gap-3 p-3">
        <span
          className={[
            "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
            bg,
            text,
          ].join(" ")}
          aria-hidden
        >
          {icon}
        </span>
        <div className="flex-1">
          {toast.title ? (
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {toast.title}
            </div>
          ) : null}
          {toast.description ? (
            <div className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">
              {toast.description}
            </div>
          ) : null}
          {toast.action ? (
            <div className="mt-2">
              <button
                type="button"
                onClick={toast.action.onClick}
                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 active:scale-[.98] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {toast.action.label}
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-1 inline-flex rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 active:scale-[.98] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          aria-label="Cerrar notificación"
          title="Cerrar"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

/* =======================
 * Estilos por variante
 * ======================= */
function variantStyles(v: ToastVariant) {
  switch (v) {
    case "success":
      return {
        icon: <CheckCircle2 className="h-4 w-4" />,
        ring: "ring-1 ring-emerald-500/20",
        bg: "bg-emerald-100 dark:bg-emerald-900/30",
        text: "text-emerald-700 dark:text-emerald-200",
        border: "border-emerald-200/60 dark:border-emerald-800",
      };
    case "warning":
      return {
        icon: <AlertTriangle className="h-4 w-4" />,
        ring: "ring-1 ring-amber-500/20",
        bg: "bg-amber-100 dark:bg-amber-900/30",
        text: "text-amber-800 dark:text-amber-200",
        border: "border-amber-200/60 dark:border-amber-800",
      };
    case "error":
      return {
        icon: <XCircle className="h-4 w-4" />,
        ring: "ring-1 ring-rose-500/20",
        bg: "bg-rose-100 dark:bg-rose-900/30",
        text: "text-rose-700 dark:text-rose-200",
        border: "border-rose-200/60 dark:border-rose-800",
      };
    case "info":
    default:
      return {
        icon: <Info className="h-4 w-4" />,
        ring: "ring-1 ring-sky-500/20",
        bg: "bg-sky-100 dark:bg-sky-900/30",
        text: "text-sky-700 dark:text-sky-200",
        border: "border-sky-200/60 dark:border-sky-800",
      };
  }
}

/* =======================
 * Ejemplo de uso:
 * 1) Agrega <ToastProvider> en app/layout.tsx o en /cliente/layout.tsx
 * 2) Dentro de un componente:
 *    const { success, error, info, warning } = useToast();
 *    success({ title: "Guardado", description: "Cambios aplicados." });
 * ======================= */
