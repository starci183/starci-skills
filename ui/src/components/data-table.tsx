import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Table } from './ui/table';
import { DURATION, EASE } from './motion';
import { Card, CardContent } from './ui/card';
import { FeedbackState } from './feedback-state';
import type { Concept } from './concept';
import { t } from '../i18n/t';

/** The business concept id (frame) under which the shared data table is filed; it is stamped on data-concept so the rendered DOM traces back to its spec. */
export const concept: Concept = 'frame';

/** One column of a data table: its header, how a row renders into it, and the layout hints for the desktop and stacked mobile forms. */
export type DataColumn<T> = { key: string; header: string; render: (row: T) => ReactNode; className?: string; mobileStack?: boolean; numeric?: boolean };

const columnClass = (column: Pick<DataColumn<unknown>, 'className' | 'numeric'>) => ['align-top', column.className, column.numeric ? 'text-right tabular-nums' : ''].filter(Boolean).join(' ');

const rowEnter = (index: number) => ({ initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: DURATION.base, ease: EASE, delay: Math.min(index, 12) * 0.03 } });

/** The shared table: a sortable-looking grid on desktop that collapses to a stack of field cards on mobile, with one empty state. */
export const DataTable = <T,>({ rows, columns, getKey, empty = t('Nothing recorded yet.'), caption }: Readonly<{
  rows: T[]; columns: DataColumn<T>[]; getKey: (row: T) => string | number; empty?: string; caption?: string;
}>) => {
  if (rows.length === 0) return <FeedbackState>{empty}</FeedbackState>;
  const keyedRows = rows.map(row => ({ row, key: getKey(row), dependencies: [row] }));
  return <>
    <div className="data-table-desktop min-w-0">
      <Table><Table.ScrollContainer><Table.Content aria-label={caption ?? t('Data table')}>
        <Table.Header columns={columns}>{column => <Table.Column
          id={column.key}
          isRowHeader={column.key === columns[0]?.key}
          className={columnClass(column)}
          textValue={column.header}
        >{column.header}</Table.Column>}</Table.Header>
        <Table.Body>{keyedRows.map(({ row, key, dependencies }) => <Table.Row key={key} id={key} columns={columns} dependencies={dependencies}>
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
};
