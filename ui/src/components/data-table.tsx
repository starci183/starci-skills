import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Table } from './ui/table';
import { DURATION, EASE } from './motion';
import { Card, CardContent } from './ui/card';
import { FeedbackState } from './feedback-state';
import type { Concept } from './concept';
import { t } from '../i18n/t';

export const concept: Concept = 'frame';

export type DataColumn<T> = { key: string; header: string; render: (row: T) => ReactNode; className?: string; mobileStack?: boolean; numeric?: boolean };

const columnClass = (column: { className?: string; numeric?: boolean }) => ['align-top', column.className, column.numeric ? 'text-right tabular-nums' : ''].filter(Boolean).join(' ');

const rowEnter = (index: number) => ({ initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: DURATION.base, ease: EASE, delay: Math.min(index, 12) * 0.03 } });

export function DataTable<T>({ rows, columns, getKey, empty = t('Nothing recorded yet.'), caption }: Readonly<{
  rows: T[]; columns: DataColumn<T>[]; getKey: (row: T) => string | number; empty?: string; caption?: string;
}>) {
  if (rows.length === 0) return <FeedbackState>{empty}</FeedbackState>;
  return <>
    <div className="data-table-desktop min-w-0">
      <Table><Table.ScrollContainer><Table.Content aria-label={caption ?? t('Data table')}>
        <Table.Header columns={columns}>{column => <Table.Column
          id={column.key}
          isRowHeader={column.key === columns[0]?.key}
          className={columnClass(column)}
          textValue={column.header}
        >{column.header}</Table.Column>}</Table.Header>
        <Table.Body>{rows.map(row => <Table.Row key={getKey(row)} id={getKey(row)} columns={columns} dependencies={[row]}>
          {column => <Table.Cell className={columnClass(column)}>{column.render(row)}</Table.Cell>}
        </Table.Row>)}</Table.Body>
      </Table.Content></Table.ScrollContainer></Table>
    </div>
    <ul className="data-table-mobile" aria-label={caption ?? t('Data table')}>
      {rows.map((row, index) => <motion.li key={getKey(row)} className="min-w-0" {...rowEnter(index)}><Card size="sm"><CardContent><dl className="mobile-row-fields">
        {columns.map((column) => <div key={column.key} className={column.mobileStack ? 'mobile-field-stack' : undefined}><dt>{column.header}</dt><dd>{column.render(row)}</dd></div>)}
      </dl></CardContent></Card></motion.li>)}
    </ul>
  </>;
}
