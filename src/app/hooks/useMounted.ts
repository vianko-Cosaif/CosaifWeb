// src/hooks/useMounted.ts
// src/hooks/useMounted.ts
"use client";
import { useEffect, useState } from "react";

export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}


/**
 * Mutable ref that is `true` while the component is mounted.
 * Useful to guard async state updates.
 */
export function useMountedRef() {
  const ref = useRef(false);
  useEffect(() => {
    ref.current = true;
    return () => {
      ref.current = false;
    };
  }, []);
  return ref;
}
