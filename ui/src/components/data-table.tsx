import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { DURATION, EASE } from './motion';
import { Card, CardContent } from './ui/card';
import { FeedbackState } from './feedback-state';
import type { Concept } from './concept';
import { t } from '../i18n/t';

export const concept: Concept = 'frame';

export type DataColumn<T> = { key: string; header: string; render: (row: T) => ReactNode; className?: string; mobileStack?: boolean; numeric?: boolean };

const columnClass = (column: { className?: string; numeric?: boolean }) => [column.className, column.numeric ? 'text-right' : ''].filter(Boolean).join(' ');

const rowEnter = (index: number) => ({ initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: DURATION.base, ease: EASE, delay: Math.min(index, 12) * 0.03 } });

export function DataTable<T>({ rows, columns, getKey, empty = t('Nothing recorded yet.'), caption }: Readonly<{
  rows: T[]; columns: DataColumn<T>[]; getKey: (row: T) => string | number; empty?: string; caption?: string;
}>) {
  if (rows.length === 0) return <FeedbackState>{empty}</FeedbackState>;
  return <>
    <div className="data-table-desktop">
      <Table className="st-table" aria-label={caption ?? t('Data table')}>
        <TableHeader><TableRow>{columns.map(column => <TableHead key={column.key} scope="col" className={columnClass(column)}>{column.header}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{rows.map(row => <TableRow key={getKey(row)}>{columns.map((column, index) => index === 0
          ? <TableHead key={column.key} scope="row" className={columnClass(column)}>{column.render(row)}</TableHead>
          : <TableCell key={column.key} className={columnClass(column)}>{column.render(row)}</TableCell>)}</TableRow>)}</TableBody>
      </Table>
    </div>
    <ul className="data-table-mobile" aria-label={caption}>
      {rows.map((row, index) => <motion.li key={getKey(row)} className="min-w-0" {...rowEnter(index)}><Card size="sm"><CardContent><dl className="mobile-row-fields">
        {columns.map((column) => <div key={column.key} className={column.mobileStack ? 'mobile-field-stack' : undefined}><dt>{column.header}</dt><dd>{column.render(row)}</dd></div>)}
      </dl></CardContent></Card></motion.li>)}
    </ul>
  </>;
}
