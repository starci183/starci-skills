import { useEffect, useState } from 'react';
import { Activity, ArrowRight } from 'lucide-react';
import type { Snapshot } from './types';

type HealthRow = { key: string; jobs: number; successRate: number | null; queueWaitP90: number | null; topFailureClass: string | null };
type HealthWindow = { windowMs: number; at: number; totals: HealthRow; ops: HealthRow[] };
type Stuck = { key: string; workflowId: string; kind: string; ageMs: number; severity: string; owner: string; detail: string };
type MeasuredSnapshot = Snapshot & { opHealth?: HealthWindow | null; stuck?: Stuck[] };

const duration = (ms: number | null) => ms == null ? 'Chưa có dữ liệu' : ms < 60_000 ? `${Math.round(ms / 1000)} giây` : ms < 3_600_000 ? `${Math.round(ms / 60_000)} phút` : `${(ms / 3_600_000).toFixed(1)} giờ`;
const rate = (value: number | null) => value == null ? '—' : `${Math.round(value * 100)}%`;
const waitName = (kind: string) => ({ 'owner-gate': 'Chờ quyết định', 'peer-wait': 'Chờ luồng khác', dependency: 'Chờ phụ thuộc', 'retry-cap': 'Hết lượt thử lại', 'deferred-settle': 'Chờ xác nhận kết quả', 'queued-ready': 'Sẵn sàng nhưng chưa chạy', throttled: 'Chờ tài nguyên máy' }[kind] ?? 'Đang chờ');
const ownerName = (value: string) => value === 'supervisor' ? 'Supervisor' : value === 'owner' ? 'Thầy' : value === 'kernel' ? 'Luồng xử lý' : value.startsWith('peer:') ? 'Luồng liên quan' : 'Chưa rõ';

export function SupervisorHealthPanel({ snapshot }: { snapshot: Snapshot }) {
  const { opHealth: health, stuck } = snapshot as MeasuredSnapshot;
  const [samples, setSamples] = useState<{ at: number; rates: Record<string, number | null> }[]>([]);
  useEffect(() => {
    if (!health) return;
    setSamples((old) => old.at(-1)?.at === health.at ? old : [...old, { at: health.at, rates: Object.fromEntries(health.ops.map((row) => [row.key, row.successRate])) }].slice(-2));
  }, [health]);
  const trend = (row: HealthRow) => {
    if (samples.length < 2 || row.successRate == null) return { arrow: '—', label: 'Chưa đủ hai mẫu đo' };
    const before = samples[0].rates[row.key];
    if (before == null) return { arrow: '—', label: 'Chưa đủ hai mẫu đo' };
    return row.successRate > before ? { arrow: '↗', label: 'Tỷ lệ đạt tăng' } : row.successRate < before ? { arrow: '↘', label: 'Tỷ lệ đạt giảm' } : { arrow: '→', label: 'Tỷ lệ đạt không đổi' };
  };
  const aged = (stuck ?? []).filter((item) => item.severity !== 'ok');
  return <section aria-labelledby="sup-health" className="min-w-0">
    <div className="mb-3 flex items-center gap-2"><Activity className="size-4 text-zinc-400" /><h2 id="sup-health" className="text-lg font-semibold">Sức khỏe các bước</h2></div>
    {!health ? <p className="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">Chưa có dữ liệu sức khỏe từ hệ thống. Xu hướng sẽ hiện khi có hai lần đo.</p> : <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
      <p className="text-sm text-zinc-300">{health.totals.jobs} lượt chạy trong {duration(health.windowMs)} · đạt {rate(health.totals.successRate)}</p>
      <p className="mt-1 text-xs text-zinc-500">Nguồn: bản tổng hợp lúc {new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(new Date(health.at))}. Mũi tên so với mẫu đo trước trong phiên này.</p>
      <div className="mt-3 max-w-full overflow-x-auto rounded-lg border border-zinc-800"><table className="w-full min-w-[520px] text-left text-xs"><thead className="bg-zinc-900/60 text-zinc-500"><tr><th className="p-2 font-medium">Bước</th><th className="p-2 font-medium">Lượt chạy</th><th className="p-2 font-medium">Tỷ lệ đạt</th><th className="p-2 font-medium">Xu hướng</th><th className="p-2 font-medium">Chờ p90</th><th className="p-2 font-medium">Lỗi thường gặp</th></tr></thead><tbody>{health.ops.slice(0, 8).map((row) => <tr key={row.key} className="border-t border-zinc-800 text-zinc-300"><th scope="row" className="max-w-[150px] break-words p-2 font-medium">{row.key}</th><td className="p-2 tabular-nums">{row.jobs}</td><td className="p-2 tabular-nums">{rate(row.successRate)}</td><td className="p-2" aria-label={trend(row).label} title={trend(row).label}>{trend(row).arrow}</td><td className="p-2 tabular-nums">{duration(row.queueWaitP90)}</td><td className="max-w-[150px] break-words p-2">{row.topFailureClass || '—'}</td></tr>)}</tbody></table></div>
      {health.ops.length > 8 && <details className="mt-3 text-xs text-zinc-400"><summary className="cursor-pointer text-sky-400">Xem thêm {health.ops.length - 8} bước</summary><ul className="mt-2 space-y-1">{health.ops.slice(8).map((row) => <li key={row.key}>{row.key}: {rate(row.successRate)} · {row.jobs} lượt</li>)}</ul></details>}
    </div>}
    {aged.length > 0 && <div className="mt-4 rounded-xl border border-zinc-800 p-4"><h3 className="text-sm font-medium">Việc chờ quá hạn · {aged.length}</h3><ul className="mt-3 space-y-2">{aged.slice(0, 5).map((item) => <li key={item.key} className="border-t border-zinc-800 pt-2 text-xs text-zinc-400"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-zinc-200">{waitName(item.kind)}</span><span>{item.severity === 'critical' ? 'Rất lâu' : 'Cần chú ý'} · {duration(item.ageMs)}</span></div><p className="mt-1">Phụ trách: {ownerName(item.owner)}</p><a className="mt-1 inline-flex items-center gap-1 text-sky-400 hover:underline" href={`#/workflows/${encodeURIComponent(item.workflowId)}`}>Mở luồng việc <ArrowRight className="size-3" /></a><details className="mt-1"><summary className="cursor-pointer text-sky-400">Xem chi tiết gốc</summary><p className="mt-1 whitespace-pre-wrap break-words">{item.detail}</p></details></li>)}</ul>{aged.length > 5 && <p className="mt-2 text-xs text-zinc-500">Còn {aged.length - 5} việc trong dữ liệu nguồn.</p>}</div>}
  </section>;
}
