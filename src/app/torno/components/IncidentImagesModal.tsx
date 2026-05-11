"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, ChevronLeft, ChevronRight, X } from "lucide-react";
import TornoImage from "./TornoImage";
import type { TornoImageRef } from "../lib/types";

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function IncidentImagesModal({
  open,
  title,
  images,
  onClose,
}: {
  open: boolean;
  title: string;
  images: TornoImageRef[];
  onClose: () => void;
}) {
  const safeImages = useMemo(() => images.filter((image) => image.url), [images]);
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open, images]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") setIndex((prev) => Math.max(0, prev - 1));
      if (event.key === "ArrowRight") setIndex((prev) => Math.min(safeImages.length - 1, prev + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, safeImages.length]);

  if (!open || !mounted) return null;

  const current = safeImages[index];

  return createPortal(
    <div className="fixed inset-0 z-[2147483647] bg-slate-950/95 text-white backdrop-blur-sm">
      <div className="flex h-full min-w-0 flex-col">
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-white/10 bg-slate-950/90 px-3 shadow-lg shadow-black/30 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white/10 text-white">
              <Camera className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-black sm:text-base">{title}</h2>
              <p className="text-xs font-semibold text-slate-300">
                {safeImages.length ? `Imagen ${index + 1} de ${safeImages.length}` : "Sin imagenes"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Cerrar galeria"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <main className="relative min-h-0 flex-1 overflow-hidden bg-slate-950">
          {current ? (
            <div className="grid h-full w-full place-items-center p-3 sm:p-6">
              <div className="h-full max-h-full w-full max-w-7xl overflow-hidden rounded-md border border-white/10 bg-slate-900 shadow-2xl shadow-black/40">
                <TornoImage
                  key={current.url}
                  src={current.url}
                  alt={current.name ?? title}
                  containerClassName="h-full w-full bg-slate-900"
                  className="object-contain"
                />
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center text-sm text-slate-300">Sin imagenes registradas</div>
          )}

          {safeImages.length > 1 && (
            <>
              <button
                type="button"
                disabled={index === 0}
                onClick={() => setIndex((prev) => Math.max(0, prev - 1))}
                className={cn(
                  "absolute left-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/60 shadow-lg hover:bg-black/80 disabled:opacity-30 sm:left-5",
                )}
                aria-label="Imagen anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                disabled={index === safeImages.length - 1}
                onClick={() => setIndex((prev) => Math.min(safeImages.length - 1, prev + 1))}
                className="absolute right-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/60 shadow-lg hover:bg-black/80 disabled:opacity-30 sm:right-5"
                aria-label="Imagen siguiente"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </main>

        {safeImages.length > 1 && (
          <footer className="shrink-0 overflow-x-auto border-t border-white/10 bg-slate-950/90 px-3 py-3">
            <div className="mx-auto flex max-w-7xl gap-2">
              {safeImages.map((image, itemIndex) => (
                <button
                  key={`${image.url}-${itemIndex}`}
                  type="button"
                  onClick={() => setIndex(itemIndex)}
                  className={cn(
                    "h-16 w-20 shrink-0 overflow-hidden rounded-md border bg-slate-900 transition",
                    itemIndex === index ? "border-white ring-2 ring-white/30" : "border-white/20 opacity-70 hover:opacity-100",
                  )}
                  aria-label={`Ver imagen ${itemIndex + 1}`}
                >
                  <TornoImage src={image.url} alt="" containerClassName="h-full w-full bg-slate-900" className="object-cover" />
                </button>
              ))}
            </div>
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
