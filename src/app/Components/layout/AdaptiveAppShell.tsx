"use client";

import type { ReactNode } from "react";
import SidebarMenu from "@/app/Components/Menu/Menu";
import RealtimeActivityCenter from "@/app/Components/layout/RealtimeActivityCenter";

type AdaptiveAppShellProps = {
  children: ReactNode;
  beforeMain?: ReactNode;
  backgroundClassName?: string;
  gridClassName?: string;
  footerClassName?: string;
  contentClassName?: string;
};

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

const defaultBackground = "bg-[var(--app-bg)] text-[var(--app-text)]";
const defaultGrid = "";

export default function AdaptiveAppShell({
  children,
  beforeMain,
  backgroundClassName = defaultBackground,
  gridClassName = defaultGrid,
  footerClassName = "text-slate-500",
  contentClassName,
}: AdaptiveAppShellProps) {
  return (
    <div data-app-shell="true" className={cn("relative flex min-h-svh w-full overflow-x-hidden", backgroundClassName)}>
      <SidebarMenu />
      <RealtimeActivityCenter />

      {gridClassName ? <div aria-hidden className={cn("pointer-events-none absolute inset-0 z-0", gridClassName)} /> : null}

      <div className="relative z-10 flex min-h-svh min-w-0 flex-1 flex-col overflow-x-hidden">
        {beforeMain}

        <a
          href="#app-main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-[max(0.5rem,env(safe-area-inset-top))] focus:z-50 focus:rounded-md focus:border focus:bg-white focus:px-3 focus:py-2 focus:text-slate-900 dark:focus:bg-slate-800 dark:focus:text-slate-100"
        >
          Saltar al contenido
        </a>

        <main
          id="app-main"
          className={cn(
            "relative z-10 mx-auto w-full max-w-full flex-1 overflow-x-hidden px-3 py-4",
            "pt-[calc(env(safe-area-inset-top)+4.5rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)]",
            "sm:px-5 md:max-w-screen-2xl md:p-8 md:pt-[calc(env(safe-area-inset-top)+1rem)]",
            contentClassName
          )}
        >
          <div className="contents">{children}</div>
        </main>

        <footer
          className={cn(
            "mx-auto w-full max-w-screen-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-xs",
            footerClassName
          )}
        >
          v1
        </footer>
      </div>
    </div>
  );
}
