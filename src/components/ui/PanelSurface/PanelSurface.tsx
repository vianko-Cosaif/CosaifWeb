"use client";

import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../cn";

export type PanelSurfaceProps = ComponentPropsWithoutRef<"section"> & {
  padded?: boolean;
};

export default function PanelSurface({
  padded = true,
  className,
  children,
  ...props
}: PanelSurfaceProps) {
  return (
    <section
      className={cn(
        "w-full min-w-0 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] shadow-[var(--app-shadow-sm)]",
        padded ? "p-4 sm:p-5" : "",
        className
      )}
      {...props}
    >
      {children}
    </section>
  );
}
