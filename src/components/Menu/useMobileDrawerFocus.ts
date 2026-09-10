"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useMobileDrawerFocus({ open, panel, trigger, onClose }: {
  open: boolean;
  panel: RefObject<HTMLElement | null>;
  trigger: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  useEffect(() => {
    const drawer = panel.current;
    if (!open || !drawer) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    const fallbackTrigger = trigger.current;
    document.body.style.overflow = "hidden";
    const focusable = () => [...drawer.querySelectorAll<HTMLElement>(FOCUSABLE)]
      .filter(node => node.getClientRects().length && !node.closest('[inert]'));
    const focusFirst = () => (focusable()[0] || drawer).focus();
    const hasDialog = () => Boolean(document.querySelector('[data-cosaif-dialog]'));
    focusFirst();
    const onKey = (event: KeyboardEvent) => {
      if (hasDialog()) return;
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const nodes = focusable(), first = nodes[0], last = nodes.at(-1);
      if (!first) { event.preventDefault(); drawer.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === drawer)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !drawer.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (!hasDialog() && !drawer.contains(event.target as Node)) focusFirst();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusin", onFocus);
      document.body.style.overflow = previousOverflow;
      const target = previousFocus?.isConnected && !previousFocus.closest('[inert]') && previousFocus.getClientRects().length
        ? previousFocus : fallbackTrigger;
      target?.focus();
    };
  }, [open, panel, trigger, onClose]);
}
