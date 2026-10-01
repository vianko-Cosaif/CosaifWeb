"use client";

import { useLinkStatus } from "next/link";

/** Kept inside Link: only the destination being opened shows pending feedback. */
export default function NavigationFeedback({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <>
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--app-accent)] motion-safe:animate-pulse" />
      <span role="status" className="sr-only">Abriendo {label}…</span>
    </>
  );
}
