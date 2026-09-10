const overlays: HTMLElement[] = [];
const originalInert = new Map<HTMLElement, boolean>();
let originalOverflow = '';
let originalFocus: HTMLElement | null = null;

function sync() {
  const top = overlays.at(-1);
  for (const node of document.body.children) {
    if (!(node instanceof HTMLElement)) continue;
    if (!originalInert.has(node)) originalInert.set(node, node.inert);
    node.inert = node !== top;
  }
}

/** A shared stack also restores the page when a parent and its child close together. */
export function registerDialog(overlay: HTMLElement) {
  const previousFocus = document.activeElement as HTMLElement | null;
  if (!overlays.length) {
    originalOverflow = document.body.style.overflow;
    originalFocus = previousFocus;
  }
  overlays.push(overlay);
  document.body.style.overflow = 'hidden';
  sync();
  return () => {
    const index = overlays.indexOf(overlay);
    if (index !== -1) overlays.splice(index, 1);
    if (overlays.length) {
      sync();
      if (previousFocus?.isConnected && overlays.at(-1)?.contains(previousFocus)) previousFocus.focus();
    } else {
      for (const [node, inert] of originalInert) node.inert = inert;
      originalInert.clear();
      document.body.style.overflow = originalOverflow;
      if (originalFocus?.isConnected) originalFocus.focus();
      originalFocus = null;
    }
  };
}
