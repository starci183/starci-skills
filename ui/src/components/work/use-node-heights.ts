import { useEffect, useState, type RefObject } from 'react';

type NodeHeightOptions = Readonly<{ selector: string; dataKey: string; source: unknown; width?: number }>;

/** Measure rendered nodes after source or width changes, retaining the map when rounded heights match. */
export function useNodeHeights(holder: RefObject<HTMLElement | null>, { selector, dataKey, source, width }: NodeHeightOptions): ReadonlyMap<string, number> {
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(new Map());
  useEffect(() => {
    const cards = [...(holder.current?.querySelectorAll<HTMLElement>(selector) ?? [])];
    const read = () => {
      const next = new Map(cards.map(card => [card.dataset[dataKey]!, Math.ceil(card.getBoundingClientRect().height)]));
      setHeights(previous => previous.size === next.size && [...next].every(([id, value]) => previous.get(id) === value) ? previous : next);
    };
    const observer = new ResizeObserver(read);
    cards.forEach(card => observer.observe(card));
    read();
    return () => observer.disconnect();
  }, [holder, selector, dataKey, source, width]);
  return heights;
}
