"use client";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

export default function RefreshButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.refresh()} className={className} title="Refrescar">
      <RefreshCw className="h-4 w-4 -mt-px" /><span className="hidden sm:inline">Actualizar</span>
    </button>
  );
}
