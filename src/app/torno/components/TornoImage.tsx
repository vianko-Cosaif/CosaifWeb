/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff } from "lucide-react";
import { toTornoImageUrl } from "../lib/tornoService";

type Props = {
  src?: string;
  alt?: string;
  className?: string;
  containerClassName?: string;
};

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function TornoImage({
  src,
  alt = "Imagen Torno",
  className = "object-contain",
  containerClassName,
}: Props) {
  const [state, setState] = useState<{
    original?: string;
    resolved?: string;
    loading: boolean;
    error: boolean;
  }>({ loading: Boolean(src), error: false });
  const objectRef = useRef<{ original: string; url: string } | null>(null);

  useEffect(() => {
    let alive = true;
    const original = src || "";
    const resolved = toTornoImageUrl(original);

    const cleanupCurrent = () => {
      if (objectRef.current) {
        URL.revokeObjectURL(objectRef.current.url);
        objectRef.current = null;
      }
    };

    if (!original) {
      cleanupCurrent();
      setState({ original, loading: false, error: true });
      return cleanupCurrent;
    }

    if (original.startsWith("blob:") || original.startsWith("data:")) {
      cleanupCurrent();
      setState({ original, resolved: original, loading: false, error: false });
      return cleanupCurrent;
    }

    setState({ original, loading: true, error: false });

    (async () => {
      try {
        const response = await fetch(resolved, {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (!alive) return;

        cleanupCurrent();
        const objectUrl = URL.createObjectURL(blob);
        objectRef.current = { original, url: objectUrl };
        setState({ original, resolved: objectUrl, loading: false, error: false });
      } catch {
        if (!alive) return;
        cleanupCurrent();
        setState({ original, loading: false, error: true });
      }
    })();

    return () => {
      alive = false;
      if (objectRef.current?.original !== original) cleanupCurrent();
      else cleanupCurrent();
    };
  }, [src]);

  return (
    <div className={cn("relative overflow-hidden bg-slate-100 dark:bg-slate-900", containerClassName)}>
      {state.resolved && !state.error ? (
        <img
          src={state.resolved}
          alt={alt}
          draggable={false}
          className={cn("block h-full w-full select-none", className)}
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-slate-400">
          <div className="flex flex-col items-center gap-2 text-xs font-semibold">
            <ImageOff className="h-5 w-5" />
            Sin imagen
          </div>
        </div>
      )}

      {state.loading && (
        <div className="absolute inset-0 grid place-items-center bg-white/70 dark:bg-slate-950/70">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
        </div>
      )}
    </div>
  );
}
