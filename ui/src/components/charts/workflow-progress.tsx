import type { Concept } from '../concept';
export const concept: Concept = 'C16';
import { motion } from 'motion/react';
import { EASE } from '../motion';
import type { FleetViewV2, PipelineView, WorkflowRowV2 } from '../../contract';
import { useApiQuery } from '../../api/query';
import { statusLabels, statusTone, type Status } from '../status';
import { ChartCard } from './chart-card';
import { num } from './analytics-data';

function Row({ row }: { row: WorkflowRowV2 }) {
  const url = `/api/workflows/${encodeURIComponent(row.project)}/${encodeURIComponent(row.id)}/pipeline`;
  const q = useApiQuery<PipelineView>(url, { topics: [`wf:${row.project}:${row.id}`], intervalMs: 30_000 });
  const pipe = q.data, mini = row.pipeline;
  const legs: { op: string; status: Status; tries: number }[] = pipe ? pipe.legs.map(l => ({ op: l.op, status: l.status, tries: Math.max(0, ...l.units.map(u => u.tries)) })) : mini?.legs ?? [];
  const progress = pipe?.progress ?? mini?.progress;
  return <li className="grid gap-2 py-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
    <a href={`#/w/${encodeURIComponent(row.project)}/${encodeURIComponent(row.id)}`} className="min-w-0 truncate text-sm font-medium hover:underline" title={`${row.name} · ${row.id}`}>{row.name}</a>
    <div className="flex h-3 min-w-0 gap-1" role="img" aria-label={`Tiến độ ${row.name}: ${progress ? `${progress.done}/${progress.total} chặng đạt` : 'đang tải'}`}>
      {legs.length ? legs.map((leg, i) => <motion.span key={`${leg.op}-${i}`} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.36, ease: EASE, delay: Math.min(i, 12) * 0.03 }} style={{ transformOrigin: 'left center' }} data-tone={statusTone[leg.status]} title={`${leg.op} · ${statusLabels[leg.status]}${leg.tries > 1 ? ` · thử ${leg.tries} lần` : ''}`}
        className={`h-full min-w-1 flex-1 rounded-sm ${['deferred', 'external', 'dropped'].includes(leg.status) ? 'border border-dashed border-[var(--tone-line)]' : leg.status === 'planned' || leg.status === 'queued' || leg.status === 'unknown' ? 'bg-[var(--tone-bg)] ring-1 ring-inset ring-[var(--tone-line)]' : 'bg-[var(--tone)]'}`} />)
        : <span className="h-full flex-1 rounded-sm bg-muted" title="Chưa có chặng" />}
    </div>
    <span className="text-sm font-semibold tabular-nums sm:text-right">{progress ? `${num(progress.done, 0)}/${num(progress.total, 0)}` : '—'}<span className="ml-1 text-xs font-normal text-muted-foreground">chặng đạt</span></span>
  </li>;
}

export function WorkflowProgress({ fleet, project }: { fleet: FleetViewV2 | null; project: string }) {
  const rows = (fleet?.workflows ?? []).filter(w => !project || w.project === project);
  return <ChartCard title="Tiến độ workflow" hint="Mỗi workflow một hàng; mỗi ô là một chặng của chuỗi, x/y là số chặng đã đạt trên tổng."
    legend={[{ tone: 'success', label: 'Đạt' }, { tone: 'running', label: 'Đang chạy' }, { tone: 'queued', label: 'Chờ / chưa tới' }, { tone: 'failed', label: 'Hỏng/chặn' }, { tone: 'warning', label: 'Chờ thử lại' }, { tone: 'skipped', label: 'Hoãn / ngoài workflow' }]}
    empty={!rows.length && 'Chưa có workflow nào.'} className="lg:col-span-2">
    <ul className="divide-y">{rows.map(row => <Row key={`${row.project}/${row.id}`} row={row} />)}</ul>
  </ChartCard>;
}
