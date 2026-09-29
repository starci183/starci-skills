import type { Concept } from '../concept';
export const concept: Concept = 'C16';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Measured pixel width of a container, so SVG text stays at a readable size at 375 px and 1440 px. */
export function useWidth(fallback = 640): [(node: HTMLElement | null) => void, number] {
  const [width, setWidth] = useState(fallback);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect();
    if (!node) return;
    setWidth(Math.max(240, Math.round(node.getBoundingClientRect().width) || fallback));
    observer.current = new ResizeObserver(entries => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);
      if (next > 0) setWidth(Math.max(240, next));
    });
    observer.current.observe(node);
  }, [fallback]);
  useEffect(() => () => observer.current?.disconnect(), []);
  return [ref, width];
}
