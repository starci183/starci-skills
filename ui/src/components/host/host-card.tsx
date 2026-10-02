import type { HostView } from '../../contract';
import { useApiQuery } from '../../api/query';
import { toneVar, type Tone } from '../status';
import { Grow } from '../motion';
import type { Concept } from '../concept';
import { t } from '../../i18n/t';

export const concept: Concept = 'C14';

const nf = (value: number, digits = 0) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value);
const gb = (mb: number) => `${nf(mb / 1024, 1)} GB`;
const tempTone = (temp: number | null): Tone => temp == null ? 'queued' : temp < 60 ? 'success' : temp < 80 ? 'warning' : 'failed';
const loadTone = (pct: number | null): Tone => pct == null ? 'queued' : pct < 70 ? 'running' : pct < 90 ? 'warning' : 'failed';
const usedTone = (pct: number): Tone => pct < 75 ? 'running' : pct < 90 ? 'warning' : 'failed';
function uptime(sec: number): string {
  const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60);
  return d ? t('{d} days {h} h', { d, h }) : h ? t('{h} h {m} min', { h, m }) : t('{m} min', { m });
}

function Bar({ pct, tone, label }: { pct: number | null; tone: Tone; label: string }) {
  const value = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  return <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
    <Grow className="block h-full rounded-full" style={{ width: `${value}%`, background: toneVar(tone) }} />
  </div>;
}

function Row({ label, value, pct, tone }: { label: string; value: string; pct: number | null; tone: Tone }) {
  return <div className="flex flex-col gap-1">
    <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm"><span className="min-w-0 text-muted-foreground">{label}</span><span className="font-medium tabular-nums">{value}</span></div>
    <Bar pct={pct} tone={tone} label={label} />
  </div>;
}

function Temp({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">{t('unreadable')}</span>;
  return <span data-tone={tempTone(value)} className="font-medium tabular-nums" style={{ color: 'var(--tone)' }}>{nf(value)} °C</span>;
}

function Spark({ history }: { history: HostView['history'] }) {
  if (history.length < 2) return <p className="text-sm text-muted-foreground">{t('Not enough samples to draw a trend yet.')}</p>;
  const x = (i: number) => (i * 300 / (history.length - 1)).toFixed(1);
  const line = (pick: (row: HostView['history'][number]) => number | null) => history.map((row, i) => {
    const v = pick(row);
    return v == null ? null : `${x(i)},${(58 - Math.max(0, Math.min(100, v)) * 0.56).toFixed(1)}`;
  }).filter(Boolean).join(' ');
  return <div>
    <svg viewBox="0 0 300 60" preserveAspectRatio="none" role="img" aria-label={t('Free CPU and RAM over time')} className="h-20 w-full">
      {[25, 50, 75].map(g => <line key={g} x1="0" x2="300" y1={58 - g * 0.56} y2={58 - g * 0.56} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
      <polyline fill="none" stroke="var(--chart-ink)" strokeWidth="2" vectorEffect="non-scaling-stroke" points={line(r => r.cpuPct)} />
      <polyline fill="none" stroke="var(--chart-muted)" strokeWidth="2" vectorEffect="non-scaling-stroke" points={line(r => r.freeRamPct)} />
    </svg>
    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4" style={{ background: 'var(--chart-ink)' }} />CPU %</span>
      <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4" style={{ background: 'var(--chart-muted)' }} />{t('Free RAM %')}</span>
      <span>{t('{n} latest samples', { n: history.length })}</span>
    </div>
  </div>;
}

/** Host machine card (CPU, RAM, GPU, temperatures, disks, agents' RAM, sparkline) from /api/host. */
export function HostCard({ compact = false, bare = false }: { compact?: boolean; bare?: boolean }) {
  const query = useApiQuery<HostView>('/api/host', { topics: ['system'], intervalMs: 10_000 });
  const host = query.data;
  if (!host) return <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground shadow-sm" data-concept="C14">{query.error ? t('Could not read the host info.') : t('Reading the host…')}</div>;
  const gpu = host.gpus[0];
  const load = host.cpu.loadPct;
  const usedMb = host.ram.totalMb - host.ram.freeMb;
  const agents = Object.entries(host.agentsRamMb).map(([key, mb]) => [key.replace(/^agent:/, ''), mb] as const).sort((a, b) => b[1] - a[1]);
  const agentMax = Math.max(1, ...agents.map(([, mb]) => mb));
  const cpuTemp = host.cpu.tempC == null
    ? <span className="text-muted-foreground">{t('Windows blocks CPU temperature reading (needs admin)')}</span> : <Temp value={host.cpu.tempC} />;
  const modeTone: Tone = host.throttleMode === 'critical' ? 'failed' : host.throttleMode === 'heavy' ? 'warning' : 'success';

  return <section data-concept="C14" className={`min-w-0 ${bare ? '' : 'rounded-xl border bg-card shadow-sm'}`}>
    <div className={`flex items-start justify-between gap-3 border-b py-3 ${bare ? "" : "px-4 sm:px-6"}`}>
      <div className="min-w-0"><h2 className="truncate font-semibold">{host.name ?? t('Host')}</h2><p className="truncate text-xs text-muted-foreground">{host.os} · {t('up {uptime}', { uptime: uptime(host.uptimeSec) })}</p></div>
      {host.throttleMode ? <span data-tone={modeTone} className="shrink-0 rounded-full border px-2 py-0.5 text-xs" style={{ color: 'var(--tone)', background: 'var(--tone-bg)', borderColor: 'var(--tone-line)' }}>{t('throttled: {mode}', { mode: host.throttleMode })}</span> : null}
    </div>
    <div className={`flex flex-col gap-4 ${bare ? 'pt-4' : 'p-4 sm:p-6'}`}>
      <div>
        <p className="mb-2 truncate text-sm font-medium" title={host.cpu.model}>{host.cpu.model}</p>
        <Row label={t('CPU · {cores} cores / {threads} threads', { cores: host.cpu.cores, threads: host.cpu.threads })} value={load == null ? t('no reading yet') : `${nf(load)} %`} pct={load} tone={loadTone(load)} />
        <p className="mt-1 text-xs">{t('CPU temperature:')} {cpuTemp}</p>
      </div>
      <Row label="RAM" value={`${gb(usedMb)} / ${gb(host.ram.totalMb)} (${nf(host.ram.usedPct)} %)`} pct={host.ram.usedPct} tone={usedTone(host.ram.usedPct)} />
      {gpu ? <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm"><span className="min-w-0 truncate font-medium" title={gpu.name}>{gpu.name}</span><span className="tabular-nums"><Temp value={gpu.tempC} />{gpu.utilPct != null ? <span className="text-muted-foreground"> · {t('load {n} %', { n: nf(gpu.utilPct) })}</span> : null}</span></div>
        <Bar pct={gpu.utilPct} tone={loadTone(gpu.utilPct)} label={t('GPU load')} />
      </div> : <p className="text-sm text-muted-foreground">{t('No NVIDIA GPU.')}</p>}
      {compact ? <p className="text-xs text-muted-foreground">{t('Up {uptime}', { uptime: uptime(host.uptimeSec) })}</p> : <>
        {host.gpus.length ? <div className="flex flex-col gap-3 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">GPU</p>
          {host.gpus.map((g, i) => <div key={`${g.name}-${i}`} className="flex flex-col gap-2">
            {g.memUsedMb != null && g.memTotalMb ? <Row label={`VRAM · ${g.name}`} value={`${gb(g.memUsedMb)} / ${gb(g.memTotalMb)}`} pct={g.memUsedMb / g.memTotalMb * 100} tone={usedTone(g.memUsedMb / g.memTotalMb * 100)} /> : null}
            <p className="text-xs text-muted-foreground">{t('Power:')} {g.powerW == null ? t('unknown') : `${nf(g.powerW, 1)} W`}</p>
          </div>)}
        </div> : null}
        {host.disks.length ? <div className="flex flex-col gap-3 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">{t('Disks (free space)')}</p>
          {host.disks.map(d => { const usedPct = (1 - d.freeGb / d.totalGb) * 100; return <Row key={d.mount} label={d.mount} value={t('{free} GB free / {total} GB', { free: nf(d.freeGb, 1), total: nf(d.totalGb, 1) })} pct={usedPct} tone={usedTone(usedPct)} />; })}
        </div> : null}
        <div className="flex flex-col gap-3 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">{t('RAM per agent')}{host.running != null ? t(' · {n} ops running', { n: host.running }) : ''}</p>
          {agents.length ? agents.map(([name, mb]) => <Row key={name} label={name} value={gb(mb)} pct={mb / agentMax * 100} tone="running" />) : <p className="text-sm text-muted-foreground">{t('No per-agent RAM reading yet.')}</p>}
        </div>
        <div className="border-t pt-3"><p className="mb-2 text-xs font-medium text-muted-foreground">{t('CPU and free RAM trend')}</p><Spark history={host.history} /></div>
      </>}
    </div>
  </section>;
}
