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
        "w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 text-slate-900 shadow-xl shadow-slate-200/50 backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-950/95 dark:text-slate-100 dark:shadow-slate-900/50 sm:rounded-3xl",
        padded ? "px-2 py-3 sm:px-5 sm:py-6 lg:px-7 lg:py-8" : "",
        className
      )}
      {...props}
    >
      {children}
    </section>
  );
}
