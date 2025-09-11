// src/components/AuthImage.tsx
"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";

export default function AuthImage({
  ruta,
  alt,
  className
}: { ruta?: string; alt?: string; className?: string }) {
  const [src, setSrc] = useState<string>();
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    async function run() {
      try {
        if (!ruta) return setErr(true);
        const url = API.IMG(ruta);
        // intenta directo primero (por si no requiere auth)
        const probe = await fetch(url, { method: "HEAD" });
        if (probe.ok) return void (alive && setSrc(url));
        // si requiere auth, baja como blob
        const { fetchImageObjectURL } = await import("@/lib/api");
        const obj = await fetchImageObjectURL(url);
        if (alive) setSrc(obj);
      } catch { alive && setErr(true); }
    }
    run();
    return () => { alive = false; };
  }, [ruta]);

  if (err) return (
    <div className={`grid place-items-center bg-slate-100 text-slate-500 ${className || ""}`}>
      <span className="text-xs">Sin imagen</span>
    </div>
  );
  return <img src={src} alt={alt} className={className} />;
}
