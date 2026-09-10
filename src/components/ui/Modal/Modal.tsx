'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { registerDialog } from './dialogStack';
import { cn } from '../cn';
type ModalProps = { title: ReactNode; children: ReactNode; onClose: () => void; maxWidth?: string; className?: string; bodyClassName?: string; closeLabel?: string };
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
export default function Modal({ title, children, onClose, maxWidth = 'max-w-2xl', className, bodyClassName, closeLabel = 'Cerrar' }: ModalProps) {
  const id = useId(); const panel = useRef<HTMLDivElement>(null); const overlay = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); const [mounted, setMounted] = useState(false);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted || !panel.current || !overlay.current) return;
    const dialog = panel.current;
    const unregister = registerDialog(overlay.current);
    const elements = () => [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(node => node.getClientRects().length && !node.closest('[inert]'));
    const topmost = () => [...document.querySelectorAll('[data-cosaif-dialog]')].at(-1) === dialog;
    (elements()[0] || dialog).focus();
    const onKey = (event: KeyboardEvent) => {
      if (!topmost()) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key !== 'Tab') return;
      const focusable = elements(); const first = focusable[0]; const last = focusable.at(-1);
      if (!first) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    const onFocus = (event: FocusEvent) => { if (topmost() && !dialog.contains(event.target as Node)) (elements()[0] || dialog).focus(); };
    document.addEventListener('keydown', onKey, true); document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('keydown', onKey, true); document.removeEventListener('focusin', onFocus);
      unregister();
    };
  }, [mounted]);
  if (!mounted) return null;
  return createPortal(<div ref={overlay} className="fixed inset-0 z-[150] flex items-end justify-center bg-black/40 p-2 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panel} data-cosaif-dialog tabIndex={-1} className={cn('relative max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-xl outline-none', maxWidth, className)} role="dialog" aria-modal="true" aria-labelledby={id}>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 sm:px-6">
        <h2 id={id} className="text-lg font-semibold text-[var(--app-text)]">{title}</h2>
        <button type="button" onClick={onClose} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] focus-visible:ring-2 focus-visible:ring-sky-500" aria-label={closeLabel}><X className="h-5 w-5" aria-hidden/></button>
      </header>
      <div className={cn('p-4 sm:p-6',bodyClassName)}>{children}</div>
    </div>
  </div>,document.body);
}
