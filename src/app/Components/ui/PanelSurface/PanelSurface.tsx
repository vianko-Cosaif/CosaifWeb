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
        "w-full overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] shadow-[var(--app-shadow-sm)]",
        padded ? "px-2 py-3 sm:px-5 sm:py-6 lg:px-7 lg:py-8" : "",
        className
      )}
      {...props}
    >
      {children}
    </section>
  );
}
