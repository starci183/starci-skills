import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, MotionConfig, animate, motion, useInView, useReducedMotion } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import type { Concept } from '../concept';

export const concept: Concept = 'frame';

/**
 * Motion vocabulary for the harness (owner 2026-09-29): subtle, 150–250 ms, never looping,
 * off when the OS asks for reduced motion (MotionConfig reducedMotion="user").
 * Spacing scale (Tailwind default, 4 px based): use only 1·2·3·4·6·8 → 4/8/12/16/24/32 px for
 * padding, margin and gap. Card padding = 6 (24 px, 4 on phones); gap between page blocks = 8 (32 px, 6 on phones).
 */
export const EASE = [0.2, 0.8, 0.2, 1] as const;
export const DURATION = { fast: 0.15, base: 0.2, enter: 0.24 } as const;

export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user" transition={{ duration: DURATION.base, ease: EASE }}>{children}</MotionConfig>;
}

/** Section/page enter: fade + 8 px slide up. `delay` in seconds. */
export function Enter({ children, className, delay = 0, as = 'div' }: { children: ReactNode; className?: string; delay?: number; as?: 'div' | 'section' | 'li' | 'article' | 'main' }) {
  const Tag = motion[as];
  return <Tag className={className} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.enter, ease: EASE, delay }}>{children}</Tag>;
}

/** List that staggers its <StaggerItem> children once, on first render (40 ms apart). */
export function Stagger({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'ul' | 'ol' | 'section' }) {
  const Tag = motion[as];
  return <Tag className={className} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}>{children}</Tag>;
}
export function StaggerItem({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'li' | 'article' }) {
  const Tag = motion[as];
  return <Tag className={className} variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE } } }}>{children}</Tag>;
}

/** Hover lift + press for clickable cards. */
export function Lift({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return <motion.div className={className} onClick={onClick} whileTap={{ scale: 0.995 }} transition={{ duration: DURATION.fast, ease: EASE }}>{children}</motion.div>;
}

/**
 * "Nâng cao": secondary/technical details, collapsed by default. Nothing is removed, only demoted.
 * `summary` is a one-line hint of what is inside; height animates open/closed.
 */
export function Advanced({ children, summary, title = 'Nâng cao', defaultOpen = false, className = '', variant = 'inline' }: {
  children: ReactNode; summary?: ReactNode; title?: ReactNode; defaultOpen?: boolean; className?: string; variant?: 'inline' | 'card';
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const card = variant === 'card';
  return <div className={`ui-advanced ${card ? 'rounded-xl border bg-card' : 'border-t pt-3'} min-w-0 ${className}`} data-advanced={open ? 'open' : 'closed'} data-advanced-variant={variant}>
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}
      className={`flex w-full min-w-0 items-center gap-2 text-left ${card ? 'rounded-xl px-6 py-4 hover:bg-muted/60' : 'text-xs text-muted-foreground hover:text-foreground'}`}>
      <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: DURATION.fast, ease: EASE }} className="inline-flex shrink-0"><ChevronRight className="size-3.5" aria-hidden="true" /></motion.span>
      <span className={`shrink-0 whitespace-nowrap ${card ? 'text-sm font-semibold' : 'font-medium'}`}>{title}</span>
      {summary ? <span className="min-w-0 truncate text-xs text-muted-foreground">{summary}</span> : null}
    </button>
    <AnimatePresence initial={false}>
      {open ? <motion.div id={id} key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.22, ease: EASE }} className="overflow-hidden">
        <div className={card ? 'px-6 pb-6' : 'pt-3'}>{children}</div>
      </motion.div> : null}
    </AnimatePresence>
  </div>;
}

/** Number that counts up to its value when it first scrolls into view (and on change). */
export function Ticker({ value, format = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n)), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const from = useRef(0);
  useEffect(() => {
    const node = ref.current;
    if (!node || !inView) return;
    if (reduce) { node.textContent = format(value); from.current = value; return; }
    const controls = animate(from.current, value, { duration: DURATION.enter, ease: EASE, onUpdate: latest => { node.textContent = format(latest); } });
    from.current = value;
    return () => controls.stop();
  }, [value, inView, reduce, format]);
  return <span ref={ref} className={className}>{format(reduce || !inView ? value : from.current)}</span>;
}

/** Bar segment / progress that grows from the left on first render. */
export function Grow({ className, style, delay = 0, title }: { className?: string; style?: React.CSSProperties; delay?: number; title?: string }) {
  return <motion.span className={className} style={{ transformOrigin: 'left center', ...style }} title={title} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: DURATION.enter, ease: EASE, delay }} />;
}

/** Status chip / label that cross-fades when its text changes. */
export function Swap({ children, keyValue, className }: { children: ReactNode; keyValue: string; className?: string }) {
  return <AnimatePresence mode="wait" initial={false}>
    <motion.span key={keyValue} className={className} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: DURATION.fast, ease: EASE }}>{children}</motion.span>
  </AnimatePresence>;
}
