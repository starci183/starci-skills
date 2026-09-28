import type { ReactNode } from 'react';
import { Card, CardContent } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import type { Concept } from './concept';

export const concept: Concept = 'frame';

export type DataColumn<T> = { key: string; header: string; render: (row: T) => ReactNode; className?: string };

export function DataTable<T>({ rows, columns, getKey, empty = 'Không có dữ liệu phù hợp.', caption }: {
  rows: T[]; columns: DataColumn<T>[]; getKey: (row: T) => string | number; empty?: string; caption?: string;
}) {
  if (rows.length === 0) return <div className="empty-state" role="status">{empty}</div>;
  return <>
    <div className="data-table-desktop">
      <Table>
        {caption && <caption className="sr-only">{caption}</caption>}
        <TableHeader><TableRow>{columns.map((column) => <TableHead key={column.key} className={column.className}>{column.header}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{rows.map((row) => <TableRow key={getKey(row)}>{columns.map((column) => <TableCell key={column.key} className={column.className}>{column.render(row)}</TableCell>)}</TableRow>)}</TableBody>
      </Table>
    </div>
    <div className="data-table-mobile" role="list" aria-label={caption}>
      {rows.map((row) => <Card size="sm" key={getKey(row)} role="listitem"><CardContent><dl className="mobile-row-fields">
        {columns.map((column) => <div key={column.key}><dt>{column.header}</dt><dd>{column.render(row)}</dd></div>)}
      </dl></CardContent></Card>)}
    </div>
  </>;
}
