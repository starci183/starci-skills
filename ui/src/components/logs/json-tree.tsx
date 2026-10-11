import { useState } from 'react';
import { Accordion, Card } from '@heroui/react';
import type { Concept } from '../concept';
import { t } from '../../i18n/t';

export const concept: Concept = 'C17';

const isObject = (value: unknown): value is Record<string, unknown> | unknown[] => typeof value === 'object' && value !== null;

function Scalar({ value }: Readonly<{ value: unknown }>) {
  if (value === null) return <span className="text-muted-foreground">null</span>;
  if (typeof value === 'string') return <span className="break-words whitespace-pre-wrap text-foreground">"{value}"</span>;
  return <span className="text-foreground">{String(value as number | boolean)}</span>;
}

function Node({ name, value, depth }: Readonly<{ name?: string; value: unknown; depth: number }>) {
  const [open, setOpen] = useState(depth < 1);
  const label = name != null ? <span className="text-muted-foreground">{name}: </span> : null;
  if (!isObject(value)) return <div className="py-1 pl-4">{label}<Scalar value={value} /></div>;
  const entries = Array.isArray(value) ? value.map((item, index) => [String(index), item] as const) : Object.entries(value);
  const brackets = Array.isArray(value) ? ['[', ']'] : ['{', '}'];
  if (!entries.length) return <div className="py-1 pl-4">{label}<span className="text-muted-foreground">{brackets[0]}{brackets[1]}</span></div>;
  return <Accordion hideSeparator expandedKeys={open ? ['node'] : []} onExpandedChange={keys => setOpen(keys.has('node'))}>
    <Accordion.Item id="node">
      <Accordion.Heading>
        <Accordion.Trigger className="min-h-9 justify-start gap-1 px-1 py-1 font-mono text-xs pointer-coarse:min-h-11">
          <Accordion.Indicator className="ms-0 size-3.5" />
          <span className="min-w-0 break-words">{label}<span className="text-muted-foreground">{brackets[0]}{open ? '' : ` ${entries.length} ${t('items')} ${brackets[1]}`}</span></span>
        </Accordion.Trigger>
      </Accordion.Heading>
      <Accordion.Panel><Accordion.Body className="ml-2 border-l px-0 pb-0 pl-3 font-mono text-xs text-foreground">
        {open ? <>{entries.map(([key, item]) => <Node key={key} name={key} value={item} depth={depth + 1} />)}<div className="pl-4 text-muted-foreground">{brackets[1]}</div></> : null}
      </Accordion.Body></Accordion.Panel>
    </Accordion.Item>
  </Accordion>;
}

/** Collapsible JSON tree (no HTML injection: every leaf is rendered as text). */
export function JsonTree({ value }: Readonly<{ value: unknown }>) {
  return <Card variant="transparent" className="max-h-80 overflow-auto p-0 font-mono text-xs leading-5" aria-label={t('JSON data')}><Card.Content><Node value={value} depth={0} /></Card.Content></Card>;
}
