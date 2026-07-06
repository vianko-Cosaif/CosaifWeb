"use client";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/Components/ui";

export default function RefreshButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <Button
      type="button"
      onClick={() => router.refresh()}
      className={className}
      title="Refrescar"
      leftIcon={<RefreshCw className="h-4 w-4 -mt-px" aria-hidden />}
    >
      <span className="hidden sm:inline">Actualizar</span>
    </Button>
  );
}
