import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Table } from '@heroui/react';
import { DURATION, EASE } from './motion';
import { Card, CardContent } from './ui/card';
import { FeedbackState } from './feedback-state';
import type { Concept } from './concept';

export const concept: Concept = 'frame';

export type DataColumn<T> = { key: string; header: string; render: (row: T) => ReactNode; className?: string; mobileStack?: boolean; numeric?: boolean };

const columnClass = (column: { className?: string; numeric?: boolean }) => [column.className, column.numeric ? 'text-right' : ''].filter(Boolean).join(' ');

const rowEnter = (index: number) => ({ initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: DURATION.base, ease: EASE, delay: Math.min(index, 12) * 0.03 } });

export function DataTable<T>({ rows, columns, getKey, empty = 'Không có dữ liệu phù hợp.', caption }: {
  rows: T[]; columns: DataColumn<T>[]; getKey: (row: T) => string | number; empty?: string; caption?: string;
}) {
  if (rows.length === 0) return <FeedbackState>{empty}</FeedbackState>;
  return <>
    <div className="data-table-desktop">
      <Table variant="secondary" className="st-table">
        <Table.ScrollContainer>
          <Table.Content aria-label={caption ?? 'Bảng dữ liệu'}>
            <Table.Header data-slot="table-header">{columns.map((column, index) => <Table.Column id={column.key} key={column.key} isRowHeader={index === 0} data-slot="table-head" className={columnClass(column)}>{column.header}</Table.Column>)}</Table.Header>
            <Table.Body data-slot="table-body">{rows.map((row) => <Table.Row id={String(getKey(row))} key={getKey(row)} data-slot="table-row">{columns.map((column) => <Table.Cell key={column.key} data-slot="table-cell" className={columnClass(column)}>{column.render(row)}</Table.Cell>)}</Table.Row>)}</Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </div>
    <div className="data-table-mobile" role="list" aria-label={caption}>
      {rows.map((row, index) => <motion.div key={getKey(row)} role="listitem" {...rowEnter(index)}><Card size="sm"><CardContent><dl className="mobile-row-fields">
        {columns.map((column) => <div key={column.key} className={column.mobileStack ? 'mobile-field-stack' : undefined}><dt>{column.header}</dt><dd>{column.render(row)}</dd></div>)}
      </dl></CardContent></Card></motion.div>)}
    </div>
  </>;
}
