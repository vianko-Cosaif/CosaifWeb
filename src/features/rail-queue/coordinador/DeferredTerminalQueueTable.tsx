"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { TerminalQueueTableProps } from "../components/TerminalQueueTable/TerminalQueueTable";

const TerminalQueueTable = dynamic(
  () => import("../components/TerminalQueueTable").then((module) => module.TerminalQueueTable),
  { loading: () => <div className="h-72 animate-pulse rounded-lg bg-[var(--app-surface-muted)]" aria-label="Cargando tabla de rondas" /> }
);

/** The desktop-only table should not load Ant Design on phones or above the fold. */
export default function DeferredTerminalQueueTable(props: TerminalQueueTableProps) {
  const placeholder = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    if (typeof window.matchMedia !== "function") {
      setVisible(true);
      return;
    }
    const desktop = window.matchMedia("(min-width: 1024px)");
    let observer: IntersectionObserver | null = null;
    const observe = () => {
      observer?.disconnect();
      if (!desktop.matches) return;
      if (typeof IntersectionObserver === "undefined") {
        setVisible(true);
        return;
      }
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      }, { rootMargin: "200px" });
      if (placeholder.current) observer.observe(placeholder.current);
    };
    observe();
    desktop.addEventListener("change", observe);
    return () => {
      observer?.disconnect();
      desktop.removeEventListener("change", observe);
    };
  }, [visible]);

  return <div ref={placeholder} className="hidden min-h-72 lg:block">{visible ? <TerminalQueueTable {...props} /> : null}</div>;
}
