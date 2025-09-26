/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { ImageWithAuth } from "./ImageWithAuth";

const PROXY = "/bff";

function viaProxy(u: string) {
  if (!u) return "";
  if (u.startsWith(`${PROXY}/`) || u === PROXY) return u;
  if (u.startsWith("/")) return `${PROXY}${u}`;
  if (/^https?:\/\//i.test(u)) {
    try {
      const url = new URL(u);
      return `${PROXY}${url.pathname}${url.search}`;
    } catch {
      return u;
    }
  }
  return `${PROXY}/${u.replace(/^\/+/, "")}`;
}

function cn(...xs: (string | false | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

interface ImageGalleryProps {
  images: string[];
  index: number;
  onChange: (i: number) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function ImageGallery({
  images,
  index,
  onChange,
  fullscreen,
  onToggleFullscreen,
}: ImageGalleryProps) {
  const total = images.length;
  const i = Math.min(index, Math.max(0, total - 1));
  const prev = useCallback(() => onChange(Math.max(i - 1, 0)), [i, onChange]);
  const next = useCallback(() => onChange(Math.min(i + 1, total - 1)), [i, onChange, total]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [prev, next]);

  // Process images with proxy if needed
  const processedImages = images.map((img) =>
    /^https?:\/\//i.test(img) ? viaProxy(img) : viaProxy(`/incidentes/imagen/${encodeURIComponent(img)}`)
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Main viewer: adapt height per breakpoint, use object-contain on IMG */}
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border bg-white shadow-sm",
          fullscreen ? "h-[70vh] sm:h-[78vh]" : "h-[45vh] sm:h-[380px] lg:h-[480px]"
        )}
      >
        {total ? (
          <ImageWithAuth
            src={processedImages[i]}
            alt={`Imagen ${i + 1} de ${total}`}
            containerClassName="h-full w-full bg-slate-50"
            imgClassName="object-contain"
          />
        ) : (
          <img src="" className="h-full w-full object-contain" alt="" />
        )}

        {/* Controls */}
        <div className="absolute inset-x-0 bottom-3 mx-auto flex w-[220px] items-center justify-between rounded-full bg-black/60 px-3 py-1 text-white">
          <button
            onClick={prev}
            disabled={i === 0}
            className={cn("rounded p-1", i === 0 ? "opacity-50 cursor-not-allowed" : "hover:bg-white/20")}
            aria-label="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium">
            {i + 1}/{total || 1}
          </span>
          <button
            onClick={next}
            disabled={i === total - 1}
            className={cn(
              "rounded p-1",
              i === total - 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-white/20"
            )}
            aria-label="Siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={onToggleFullscreen}
          className="absolute right-3 top-3 rounded-md bg-black/55 p-2 text-white hover:bg-black/70"
          aria-label={fullscreen ? "Salir pantalla completa" : "Pantalla completa"}
          title={fullscreen ? "Salir pantalla completa" : "Pantalla completa"}
        >
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Thumbs: fixed square, images object-cover but contained inside square to avoid warp */}
      <div className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3">
          {(total ? processedImages : Array(4).fill("")).map((src, idx) => {
            const active = idx === i;
            return (
              <button
                key={idx}
                onClick={() => onChange(idx)}
                disabled={!src}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-lg border",
                  src ? "hover:border-slate-300" : "opacity-50 cursor-not-allowed",
                  active ? "border-emerald-600 ring-2 ring-emerald-600/20" : "border-slate-200"
                )}
                aria-label={src ? `Ver imagen ${idx + 1}` : "Miniatura no disponible"}
              >
                {src ? (
                  <ImageWithAuth
                    src={src}
                    containerClassName="h-full w-full"
                    imgClassName="object-cover" // cover in thumbnail is ok (square crop)
                  />
                ) : (
                  <img src="" className="h-full w-full object-cover" alt="" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
