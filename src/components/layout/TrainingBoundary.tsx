"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const TrainingProvider = dynamic(
  () =>
    import("@/features/capacitacion/ClientMovementGuide").then(
      (module) => module.ClientMovementGuideProvider,
    ),
  {
    loading: () => (
      <div role="status" className="p-6 text-sm">
        Preparando la operación…
      </div>
    ),
  },
);

/** Training stays mounted between operational routes, but is never downloaded by login. */
export default function TrainingBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login" || pathname.startsWith("/login/")) return children;
  return <TrainingProvider>{children}</TrainingProvider>;
}
