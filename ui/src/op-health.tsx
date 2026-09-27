import { HeartPulse } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { OpHealth, StuckItem } from './contract';

function duration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  if (ms < 60_000) return `${Math.round(ms / 1000)} giây`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} phút`;
  if (ms < 86_400_000) return `${(ms / 3_600_000).toFixed(1)} giờ`;
  return `${(ms / 86_400_000).toFixed(1)} ngày`;
}
function rateTone(rate: number | null): string {
  if (rate == null) return 'text-zinc-500';
  return rate >= 0.8 ? 'text-emerald-400' : rate >= 0.5 ? 'text-amber-400' : 'text-red-400';
}

/** "Sức khỏe op": per-op success rate, median queue wait and top failure class (GET /api/snapshot opHealth, stuck). */
export function OpHealthPanel({ health, stuck }: { health: OpHealth | null | undefined; stuck: StuckItem[] | undefined }) {
  if (!health) return null;
  const past = (stuck ?? []).filter((item) => item.severity !== 'ok');
  const critical = past.filter((item) => item.severity === 'critical').length;
  const t = health.totals;
  return <Card className="border border-zinc-800/80 bg-zinc-950/80 shadow-none">
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><HeartPulse className="size-4 text-emerald-400" /> Sức khỏe op</CardTitle>
      <CardDescription>
        {duration(health.windowMs)} gần nhất: {t.jobs} job, đạt <span className={rateTone(t.successRate)}>{t.successRate == null ? '—' : `${Math.round(t.successRate * 100)}%`}</span>, chờ trung vị {duration(t.queueWaitP50)} · kẹt quá hạn {past.length}{critical ? <span className="text-red-400"> ({critical} nghiêm trọng)</span> : null}
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="overflow-x-auto rounded-lg border border-zinc-800/80">
        <Table>
          <TableHeader><TableRow className="border-zinc-800 hover:bg-transparent"><TableHead>Op</TableHead><TableHead className="text-right">Đạt</TableHead><TableHead className="text-right">Chờ trung vị</TableHead><TableHead>Lỗi nhiều nhất</TableHead></TableRow></TableHeader>
          <TableBody>{health.ops.slice(0, 12).map((row) => <TableRow key={row.key} className="border-zinc-800/70">
            <TableCell className="font-medium text-zinc-200">{row.key}<span className="ml-2 text-xs text-zinc-600">{row.jobs} job</span></TableCell>
            <TableCell className={`text-right tabular-nums ${rateTone(row.successRate)}`}>{row.successRate == null ? '—' : `${Math.round(row.successRate * 100)}%`}</TableCell>
            <TableCell className="text-right tabular-nums text-zinc-400">{duration(row.queueWaitP50)}</TableCell>
            <TableCell className="max-w-[260px] truncate text-xs text-zinc-400" title={row.failureClasses.map((c) => `${c.class} ×${c.n}`).join(', ')}>{row.topFailureClass ?? '—'}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>;
}
