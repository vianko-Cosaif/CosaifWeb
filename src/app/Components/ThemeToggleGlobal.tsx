"use client";

import { usePathname } from "next/navigation";
import ThemeToggle from "@/app/Components/ui/ThemeToggle";

export default function ThemeToggleGlobal() {
  const pathname = usePathname();

  // Ocultar el theme toggle global en rutas del cliente ya que tienen su propio toggle
  if (pathname.startsWith('/cliente')) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center justify-center">
      <ThemeToggle size="md" title="Cambiar tema" />
    </div>
  );
}
