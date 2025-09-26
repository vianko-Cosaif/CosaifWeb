/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

type ImageWithAuthProps = {
  src: string;
  alt?: string;
  containerClassName?: string;
  imgClassName?: string;
};

const EMPTY_IMAGE =
  "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Crect width='100%25' height='100%25' fill='%23ECEFF1'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23546E7A' font-family='sans-serif' font-size='24'%3ESin imagen%3C/text%3E%3C/svg%3E";

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
}

function authHeaders() {
  const t = getCookie("token");
  return t ? ({ Authorization: `Bearer ${t}` } as Record<string, string>) : {};
}

function cn(...xs: (string | false | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

export function ImageWithAuth({
  src,
  alt = "",
  containerClassName,
  imgClassName = "object-contain",
}: ImageWithAuthProps) {
  const [url, setUrl] = useState<string>(EMPTY_IMAGE);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let alive = true;
    let revoked: string | null = null;

    (async () => {
      try {
        if (!src) {
          setUrl(EMPTY_IMAGE);
          setIsLoading(false);
          return;
        }
        setIsLoading(true);
        setHasError(false);

        const r = await fetch(src, {
          headers: authHeaders(),
          credentials: "include",
          cache: "no-store",
        });
        if (!r.ok) throw new Error("img fetch");
        const b = await r.blob();
        if (!alive) return;
        const u = URL.createObjectURL(b);
        revoked = u;
        setUrl(u);
      } catch {
        if (!alive) return;
        setUrl(EMPTY_IMAGE);
        setHasError(true);
      } finally {
        if (alive) setIsLoading(false);
      }
    })();

    return () => {
      alive = false;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [src]);

  return (
    <div className={cn("relative", containerClassName)}>
      <img
        src={url}
        alt={alt}
        draggable={false}
        className={cn("block h-full w-full select-none", imgClassName)}
      />
      {isLoading && (
        <div className="absolute inset-0 grid place-items-center bg-slate-100">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        </div>
      )}
      {hasError && !isLoading && (
        <div className="absolute inset-0 grid place-items-center bg-slate-100 text-slate-500">
          <AlertTriangle className="h-6 w-6" />
        </div>
      )}
    </div>
  );
}
