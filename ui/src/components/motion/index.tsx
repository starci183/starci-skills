import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, MotionConfig, animate, motion, useInView, useReducedMotion } from 'motion/react';
import type { Concept } from '../concept';
import { t } from '../../i18n/t';
import { Accordion } from '../ui/collapsible';

export const concept: Concept = 'frame';

/**
 * Motion vocabulary for the harness (owner 2026-09-29): subtle, 150–250 ms, never looping,
 * off when the OS asks for reduced motion (MotionConfig reducedMotion="user").
 * Spacing scale (Tailwind default, 4 px based): use only 1·2·3·4·6·8 → 4/8/12/16/24/32 px for
 * padding, margin and gap. Card padding = 6 (24 px, 4 on phones); gap between page blocks = 8 (32 px, 6 on phones).
 */
export const EASE = [0.2, 0.8, 0.2, 1] as const;
export const DURATION = { fast: 0.15, base: 0.2, enter: 0.24 } as const;

export function MotionProvider({ children }: Readonly<{ children: ReactNode }>) {
  return <MotionConfig reducedMotion="user" transition={{ duration: DURATION.base, ease: EASE }}>{children}</MotionConfig>;
}

/** Section/page enter: fade + 8 px slide up. `delay` in seconds. */
export function Enter({ children, className, delay = 0, as = 'div' }: Readonly<{ children: ReactNode; className?: string; delay?: number; as?: 'div' | 'section' | 'li' | 'article' | 'main' }>) {
  const Tag = motion[as];
  return <Tag className={className} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.enter, ease: EASE, delay }}>{children}</Tag>;
}

/** List that staggers its <StaggerItem> children once, on first render (40 ms apart). */
export function Stagger({ children, className, as = 'div' }: Readonly<{ children: ReactNode; className?: string; as?: 'div' | 'ul' | 'ol' | 'section' }>) {
  const Tag = motion[as];
  return <Tag className={className} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}>{children}</Tag>;
}
export function StaggerItem({ children, className, as = 'div' }: Readonly<{ children: ReactNode; className?: string; as?: 'div' | 'li' | 'article' }>) {
  const Tag = motion[as];
  return <Tag className={className} variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE } } }}>{children}</Tag>;
}

/** Hover lift + press for clickable cards. */
export function Lift({ children, className, onClick }: Readonly<{ children: ReactNode; className?: string; onClick?: () => void }>) {
  return <motion.div className={className} onClick={onClick} whileTap={{ scale: 0.995 }} transition={{ duration: DURATION.fast, ease: EASE }}>{children}</motion.div>;
}

/**
 * "Advanced": secondary/technical details, collapsed by default. Nothing is removed, only demoted.
 * Existing consumers mount details only while expanded. `keepMounted` preserves the retained
 * children of migrated native disclosures; HeroUI owns their hidden state and animation.
 */
export function Advanced({ children, summary, title = t('Advanced'), defaultOpen = false, open: controlledOpen, onOpenChange, className = '', variant = 'inline', keepMounted = false }: Readonly<{
  children: ReactNode; summary?: ReactNode; title?: ReactNode; defaultOpen?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void; className?: string; variant?: 'inline' | 'card'; keepMounted?: boolean;
}>) {
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? localOpen;
  const card = variant === 'card';
  return <Accordion hideSeparator variant={card ? 'surface' : 'default'} expandedKeys={open ? ['advanced'] : []} onExpandedChange={(keys) => {
    const nextOpen = keys.has('advanced');
    if (controlledOpen === undefined) setLocalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }}
    className={`ui-advanced min-w-0 ${className}`} data-advanced={open ? 'open' : 'closed'} data-advanced-variant={variant}>
    <Accordion.Item id="advanced">
      <Accordion.Heading>
        <Accordion.Trigger className="w-full min-w-0 gap-2 text-left">
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            <span className={card ? 'min-w-0 text-sm font-semibold' : 'min-w-0 font-medium'}>{title}</span>
            {summary ? <span className="min-w-0 truncate text-xs text-muted-foreground">{summary}</span> : null}
          </span>
          <Accordion.Indicator />
        </Accordion.Trigger>
      </Accordion.Heading>
      <Accordion.Panel>
        <Accordion.Body className="min-w-0">{open || keepMounted ? children : null}</Accordion.Body>
      </Accordion.Panel>
    </Accordion.Item>
  </Accordion>;
}

/** Number that counts up to its value when it first scrolls into view (and on change). */
export function Ticker({ value, format = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n)), className }: Readonly<{ value: number; format?: (n: number) => string; className?: string }>) {
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
export function Grow({ className, style, delay = 0, title }: Readonly<{ className?: string; style?: React.CSSProperties; delay?: number; title?: string }>) {
  return <motion.span className={className} style={{ transformOrigin: 'left center', ...style }} title={title} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: DURATION.enter, ease: EASE, delay }} />;
}

/** Status chip / label that cross-fades when its text changes. */
export function Swap({ children, keyValue, className }: Readonly<{ children: ReactNode; keyValue: string; className?: string }>) {
  return <AnimatePresence mode="wait" initial={false}>
    <motion.span key={keyValue} className={className} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: DURATION.fast, ease: EASE }}>{children}</motion.span>
  </AnimatePresence>;
}
