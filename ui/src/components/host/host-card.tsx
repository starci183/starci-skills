import type { HostView } from '../../contract';
import { useApiQuery } from '../../api/query';
import { toneVar, type Tone } from '../status';
import type { Concept } from '../concept';

export const concept: Concept = 'C14';

const nf = (value: number, digits = 0) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value);
const gb = (mb: number) => `${nf(mb / 1024, 1)} GB`;
const tempTone = (temp: number | null): Tone => temp == null ? 'queued' : temp < 60 ? 'success' : temp < 80 ? 'warning' : 'failed';
const loadTone = (pct: number | null): Tone => pct == null ? 'queued' : pct < 70 ? 'running' : pct < 90 ? 'warning' : 'failed';
const usedTone = (pct: number): Tone => pct < 75 ? 'running' : pct < 90 ? 'warning' : 'failed';
function uptime(sec: number): string {
  const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60);
  return d ? `${d} ngày ${h} giờ` : h ? `${h} giờ ${m} phút` : `${m} phút`;
}

function Bar({ pct, tone, label }: { pct: number | null; tone: Tone; label: string }) {
  const value = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  return <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
    <div className="h-full rounded-full" style={{ width: `${value}%`, background: toneVar(tone) }} />
  </div>;
}

function Row({ label, value, pct, tone }: { label: string; value: string; pct: number | null; tone: Tone }) {
  return <div className="space-y-1">
    <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm"><span className="min-w-0 text-muted-foreground">{label}</span><span className="font-medium tabular-nums">{value}</span></div>
    <Bar pct={pct} tone={tone} label={label} />
  </div>;
}

function Temp({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">không đọc được</span>;
  return <span data-tone={tempTone(value)} className="font-medium tabular-nums" style={{ color: 'var(--tone)' }}>{nf(value)} °C</span>;
}

function Spark({ history }: { history: HostView['history'] }) {
  if (history.length < 2) return <p className="text-sm text-muted-foreground">Chưa đủ mẫu để vẽ xu hướng.</p>;
  const x = (i: number) => (i * 300 / (history.length - 1)).toFixed(1);
  const line = (pick: (row: HostView['history'][number]) => number | null) => history.map((row, i) => {
    const v = pick(row);
    return v == null ? null : `${x(i)},${(58 - Math.max(0, Math.min(100, v)) * 0.56).toFixed(1)}`;
  }).filter(Boolean).join(' ');
  return <div>
    <svg viewBox="0 0 300 60" preserveAspectRatio="none" role="img" aria-label="CPU và RAM trống theo thời gian" className="h-20 w-full">
      {[25, 50, 75].map(g => <line key={g} x1="0" x2="300" y1={58 - g * 0.56} y2={58 - g * 0.56} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
      <polyline fill="none" stroke={toneVar('running')} strokeWidth="2" vectorEffect="non-scaling-stroke" points={line(r => r.cpuPct)} />
      <polyline fill="none" stroke={toneVar('success')} strokeWidth="2" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" points={line(r => r.freeRamPct)} />
    </svg>
    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span data-tone="running" className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: 'var(--tone)' }} />CPU %</span>
      <span data-tone="success" className="inline-flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: 'var(--tone)' }} />RAM trống %</span>
      <span>{history.length} mẫu gần nhất</span>
    </div>
  </div>;
}

/** Host machine card (CPU, RAM, GPU, temperatures, disks, agents' RAM, sparkline) from /api/host. */
export function HostCard({ compact = false }: { compact?: boolean }) {
  const query = useApiQuery<HostView>('/api/host', { topics: ['system'], intervalMs: 10_000 });
  const host = query.data;
  if (!host) return <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground shadow-sm" data-concept="C14">{query.error ? 'Không đọc được thông tin máy chủ.' : 'Đang đọc máy chủ…'}</div>;
  const gpu = host.gpus[0];
  const load = host.cpu.loadPct;
  const usedMb = host.ram.totalMb - host.ram.freeMb;
  const agents = Object.entries(host.agentsRamMb).map(([key, mb]) => [key.replace(/^agent:/, ''), mb] as const).sort((a, b) => b[1] - a[1]);
  const agentMax = Math.max(1, ...agents.map(([, mb]) => mb));
  const cpuTemp = host.cpu.tempC == null
    ? <span className="text-muted-foreground">Windows chặn đọc nhiệt độ CPU (cần quyền admin)</span> : <Temp value={host.cpu.tempC} />;
  const modeTone: Tone = host.throttleMode === 'critical' ? 'failed' : host.throttleMode === 'heavy' ? 'warning' : 'success';

  return <section data-concept="C14" className="min-w-0 rounded-xl border bg-card shadow-sm">
    <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
      <div className="min-w-0"><h2 className="truncate font-semibold">{host.name ?? 'Máy chủ'}</h2><p className="truncate text-xs text-muted-foreground">{host.os} · bật {uptime(host.uptimeSec)}</p></div>
      {host.throttleMode ? <span data-tone={modeTone} className="shrink-0 rounded-full border px-2 py-0.5 text-xs" style={{ color: 'var(--tone)', background: 'var(--tone-bg)', borderColor: 'var(--tone-line)' }}>giới hạn: {host.throttleMode}</span> : null}
    </div>
    <div className="space-y-4 p-4">
      <div>
        <p className="mb-2 truncate text-sm font-medium" title={host.cpu.model}>{host.cpu.model}</p>
        <Row label={`CPU · ${host.cpu.cores} nhân / ${host.cpu.threads} luồng`} value={load == null ? 'chưa có số đo' : `${nf(load)} %`} pct={load} tone={loadTone(load)} />
        <p className="mt-1 text-xs">Nhiệt độ CPU: {cpuTemp}</p>
      </div>
      <Row label="RAM" value={`${gb(usedMb)} / ${gb(host.ram.totalMb)} (${nf(host.ram.usedPct)} %)`} pct={host.ram.usedPct} tone={usedTone(host.ram.usedPct)} />
      {gpu ? <div className="space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm"><span className="min-w-0 truncate font-medium" title={gpu.name}>{gpu.name}</span><span className="tabular-nums"><Temp value={gpu.tempC} />{gpu.utilPct != null ? <span className="text-muted-foreground"> · tải {nf(gpu.utilPct)} %</span> : null}</span></div>
        <Bar pct={gpu.utilPct} tone={loadTone(gpu.utilPct)} label="Tải GPU" />
      </div> : <p className="text-sm text-muted-foreground">Không có GPU NVIDIA.</p>}
      {compact ? <p className="text-xs text-muted-foreground">Bật {uptime(host.uptimeSec)}</p> : <>
        {host.gpus.length ? <div className="space-y-3 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">GPU</p>
          {host.gpus.map((g, i) => <div key={`${g.name}-${i}`} className="space-y-2">
            {g.memUsedMb != null && g.memTotalMb ? <Row label={`VRAM · ${g.name}`} value={`${gb(g.memUsedMb)} / ${gb(g.memTotalMb)}`} pct={g.memUsedMb / g.memTotalMb * 100} tone={usedTone(g.memUsedMb / g.memTotalMb * 100)} /> : null}
            <p className="text-xs text-muted-foreground">Điện năng: {g.powerW == null ? 'không rõ' : `${nf(g.powerW, 1)} W`}</p>
          </div>)}
        </div> : null}
        {host.disks.length ? <div className="space-y-3 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">Ổ đĩa (còn trống)</p>
          {host.disks.map(d => { const usedPct = (1 - d.freeGb / d.totalGb) * 100; return <Row key={d.mount} label={d.mount} value={`${nf(d.freeGb, 1)} GB trống / ${nf(d.totalGb, 1)} GB`} pct={usedPct} tone={usedTone(usedPct)} />; })}
        </div> : null}
        <div className="space-y-3 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">RAM theo agent{host.running != null ? ` · ${host.running} op đang chạy` : ''}</p>
          {agents.length ? agents.map(([name, mb]) => <Row key={name} label={name} value={gb(mb)} pct={mb / agentMax * 100} tone="running" />) : <p className="text-sm text-muted-foreground">Chưa có số đo RAM theo agent.</p>}
        </div>
        <div className="border-t pt-3"><p className="mb-2 text-xs font-medium text-muted-foreground">Xu hướng CPU và RAM trống</p><Spark history={host.history} /></div>
      </>}
    </div>
  </section>;
}
