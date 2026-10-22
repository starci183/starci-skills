import type { HostView } from '../../contract';
import { useApiQuery } from '../../api/query';
import { toneVar, type Tone } from '../status';
import { Advanced } from '../motion';
import { Card, Chip, ProgressBar } from '@heroui/react';
import { DataTable } from '../data-table';
import type { Concept } from '../concept';
import { PageSkeleton } from '../feedback-state';
import { QueryReadNotice } from '../system/panel';
import { formatAbsolute } from '../../i18n/vi';
import { t } from '../../i18n/t';

/** The business concept id (C14) under which the host machine card is filed; it is stamped on data-concept so the rendered DOM traces back to its spec. */
export const concept: Concept = 'C14';

const nf = (value: number, digits = 0) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value);
const gb = (mb: number) => `${nf(mb / 1024, 1)} GB`;
const readingTone = (value: number | null): Tone => value == null ? 'queued' : 'running';
const uptime = (sec: number): string => {
  const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60);
  if (d) return t('{d} days {h} h', { d, h });
  if (h) return t('{h} h {m} min', { h, m });
  return t('{m} min', { m });
};

const Bar = ({ pct, tone, label, valueText }: Readonly<{ pct: number | null; tone: Tone; label: string; valueText?: string }>) => {
  const value = pct == null || !Number.isFinite(pct) ? null : Math.max(0, Math.min(100, pct));
  const text = value == null ? t('No reading yet') : valueText;
  return <ProgressBar size="sm" aria-label={label} isIndeterminate={value == null}
    {...(value == null ? {} : { value })}
    {...(text === undefined ? {} : { 'aria-valuetext': text })}>
    <ProgressBar.Track>{value != null ? <ProgressBar.Fill style={{ background: toneVar(tone) }} /> : null}</ProgressBar.Track>
  </ProgressBar>;
};

const Row = ({ label, value, pct, tone, barLabel, barValueText }: Readonly<{ label: string; value: string; pct: number | null; tone: Tone; barLabel?: string; barValueText?: string }>) => {
  return <div className="flex flex-col gap-1">
    <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm"><span className="min-w-0 text-muted-foreground">{label}</span><span className="font-medium tabular-nums">{value}</span></div>
    <Bar pct={pct} tone={tone} label={barLabel ?? label} {...(barValueText === undefined ? {} : { valueText: barValueText })} />
  </div>;
};

const Temp = ({ value }: Readonly<{ value: number | null }>) => {
  if (value == null) return <span className="text-muted-foreground">{t('unreadable')}</span>;
  return <span className="font-medium tabular-nums">{nf(value)} °C</span>;
};

const Spark = ({ history }: Readonly<{ history: HostView['history'] }>) => {
  if (history.length < 2) return <p className="text-sm text-muted-foreground">{t('Not enough samples to draw a trend yet.')}</p>;
  const x = (i: number) => (i * 300 / (history.length - 1)).toFixed(1);
  const line = (pick: (row: HostView['history'][number]) => number | null) => {
    let connected = false;
    const points: string[] = [];
    history.forEach((row, i) => {
      const value = pick(row);
      if (value == null || !Number.isFinite(value)) { connected = false; return; }
      points.push(`${connected ? 'L' : 'M'}${x(i)},${(58 - Math.max(0, Math.min(100, value)) * 0.56).toFixed(1)}`);
      connected = true;
    });
    return points.join(' ');
  };
  return <div>
    <svg viewBox="0 0 300 60" preserveAspectRatio="none" role="img" aria-label={t('CPU and free RAM trend')} className="h-20 w-full">
      {[25, 50, 75].map(g => <line key={g} x1="0" x2="300" y1={58 - g * 0.56} y2={58 - g * 0.56} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
      <path fill="none" stroke="var(--chart-ink)" strokeWidth="2" vectorEffect="non-scaling-stroke" d={line(r => r.cpuPct)} />
      <path fill="none" stroke="var(--chart-muted)" strokeWidth="2" vectorEffect="non-scaling-stroke" d={line(r => r.freeRamPct)} />
    </svg>
    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4" style={{ background: 'var(--chart-ink)' }} />CPU %</span>
      <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4" style={{ background: 'var(--chart-muted)' }} />{t('Free RAM %')}</span>
      <span>{t('{n} latest samples', { n: history.length })}</span>
    </div>
  </div>;
};

const modeToneOf = (mode: HostView['throttleMode']): Tone => {
  if (mode === 'critical') return 'failed';
  if (mode === 'heavy') return 'warning';
  if (mode === 'normal') return 'success';
  return 'queued';
};
const availabilityLabel = (availability: string) => {
  if (availability === 'pending') return t('Reading');
  if (availability === 'available') return t('Available');
  return t('Unavailable');
};

const GpuSummary = ({ gpu }: Readonly<{ gpu: HostView['gpus'][number] | undefined }>) => {
  if (!gpu) return <p className="text-sm text-muted-foreground">{t('No GPU reading recorded.')}</p>;
  return <div className="flex flex-col gap-1">
    <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm"><span className="min-w-0 truncate font-medium" title={gpu.name}>{gpu.name}</span><span className="tabular-nums"><Temp value={gpu.tempC} />{gpu.utilPct != null ? <span className="text-muted-foreground"> · {t('load {n} %', { n: nf(gpu.utilPct) })}</span> : null}</span></div>
    <Bar pct={gpu.utilPct} tone={readingTone(gpu.utilPct)} label={t('GPU load')} />
  </div>;
};

const GpuList = ({ gpus }: Readonly<{ gpus: HostView['gpus'] }>) => {
  if (!gpus.length) return null;
  const seen = new Map<string, number>();
  const keyed = gpus.map(gpu => {
    const nth = (seen.get(gpu.name) ?? 0) + 1;
    seen.set(gpu.name, nth);
    return { gpu, key: `${gpu.name}#${nth}` };
  });
  return <div className="flex flex-col gap-3 border-t pt-3">
    <p className="text-xs font-medium text-muted-foreground">GPU</p>
    {keyed.map(({ gpu: g, key }) => <div key={key} className="flex flex-col gap-2">
      {g.memUsedMb != null && g.memTotalMb ? <Row label={`VRAM · ${g.name}`} value={`${gb(g.memUsedMb)} / ${gb(g.memTotalMb)}`} pct={g.memUsedMb / g.memTotalMb * 100} tone="running" /> : null}
      <p className="text-xs text-muted-foreground">{t('Power:')} {g.powerW == null ? t('unknown') : `${nf(g.powerW, 1)} W`}</p>
    </div>)}
  </div>;
};

const DiskRow = ({ disk }: Readonly<{ disk: HostView['disks'][number] }>) => {
  const freePct = Number.isFinite(disk.freeGb) && Number.isFinite(disk.totalGb) && disk.totalGb > 0 && disk.freeGb >= 0 && disk.freeGb <= disk.totalGb
    ? disk.freeGb / disk.totalGb * 100 : null;
  const value = t('{free} GB free / {total} GB', { free: nf(disk.freeGb, 1), total: nf(disk.totalGb, 1) });
  const barValueText = freePct == null ? {} : { barValueText: `${nf(freePct, 1)}% · ${value}` };
  return <Row label={disk.mount} value={value} pct={freePct} tone={readingTone(freePct)} barLabel={`${t('Disks (free space)')} · ${disk.mount}`} {...barValueText} />;
};

const DiskList = ({ disks }: Readonly<{ disks: HostView['disks'] }>) => {
  if (!disks.length) return null;
  return <div className="flex flex-col gap-3 border-t pt-3">
    <p className="text-xs font-medium text-muted-foreground">{t('Disks (free space)')}</p>
    {disks.map(d => <DiskRow key={d.mount} disk={d} />)}
  </div>;
};

const AgentRam = ({ host }: Readonly<{ host: HostView }>) => {
  const agents = Object.entries(host.agentsRamMb).map(([key, mb]) => [key.replace(/^agent:/, ''), mb] as const).sort((a, b) => b[1] - a[1]);
  const agentMax = Math.max(1, ...agents.map(([, mb]) => mb));
  return <div className="flex flex-col gap-3 border-t pt-3">
    <p className="text-xs font-medium text-muted-foreground">{t('RAM per agent')}{host.running != null ? t(' · {n} ops running', { n: host.running }) : ''}</p>
    {agents.length ? agents.map(([name, mb]) => <Row key={name} label={name} value={gb(mb)} pct={mb / agentMax * 100} tone="running" />) : <p className="text-sm text-muted-foreground">{t('No per-agent RAM reading yet.')}</p>}
  </div>;
};

const SourceObservations = ({ host }: Readonly<{ host: HostView }>) => {
  return <Advanced title={t('Source observations')} summary={t('Sensor observations retain their own timestamps and read failures.')}>
    <DataTable rows={Object.entries(host.sources ?? {}).map(([key, source]) => ({ key, ...source }))} getKey={row => row.key} caption={t('Host source observations')} columns={[
      { key: 'source', header: t('Source'), render: row => <span className="break-words">{row.source}</span> },
      { key: 'observed', header: t('Observed'), render: row => row.observedAt == null ? '—' : formatAbsolute(row.observedAt) },
      { key: 'read', header: t('Read at'), render: row => row.readAt == null ? '—' : formatAbsolute(row.readAt) },
      { key: 'state', header: t('Read availability'), render: row => <span>{availabilityLabel(row.availability)}{row.cached ? t(' · cached observation') : ''}{row.refreshing ? t(' · refreshing') : ''}</span> },
      { key: 'error', header: t('Read failure'), mobileStack: true, render: row => row.error ?? '—' },
    ]} />
  </Advanced>;
};

const ExpandedSections = ({ host }: Readonly<{ host: HostView }>) => {
  return <>
    <GpuList gpus={host.gpus} />
    <DiskList disks={host.disks} />
    <AgentRam host={host} />
    <div className="border-t pt-3"><p className="mb-2 text-xs font-medium text-muted-foreground">{t('CPU and free RAM trend')}</p><Spark history={host.history} /></div>
  </>;
};

const HostHeader = ({ host, bare }: Readonly<{ host: HostView; bare: boolean }>) => {
  const modeTone = modeToneOf(host.throttleMode);
  const padding = bare ? '' : 'px-4 sm:px-6';
  return <Card.Header className={`flex-row items-start justify-between gap-3 border-b py-3 ${padding}`}>
    <div className="min-w-0"><Card.Title<"h2"> render={props => <h2 {...props} />} className="truncate">{host.name ?? t('Host')}</Card.Title><Card.Description className="truncate text-xs">{host.os} · {t('up {uptime}', { uptime: uptime(host.uptimeSec) })}</Card.Description></div>
    {host.throttleMode ? <Chip size="sm" variant="soft" data-tone={modeTone} className="shrink-0" style={{ color: 'var(--tone)', background: 'var(--tone-bg)' }}><Chip.Label>{t('throttled: {mode}', { mode: host.throttleMode })}</Chip.Label></Chip> : null}
  </Card.Header>;
};

/** Host machine card (CPU, RAM, GPU, temperatures, disks, agents' RAM, sparkline) from /api/host. */
export const HostCard = ({ compact = false, bare = false }: Readonly<{ compact?: boolean; bare?: boolean }>) => {
  const query = useApiQuery<HostView>('/api/host', { topics: ['system'], intervalMs: 10_000 });
  const host = query.data;
  if (!host) return <Card<"section"> render={(props) => <section {...props} />} className="p-4 sm:p-6" data-concept="C14">
    {query.error ? <QueryReadNotice query={query} url="/api/host" /> : <PageSkeleton label={t('Reading the host…')} />}
  </Card>;
  const load = host.cpu.loadPct;
  const usedMb = host.ram.totalMb - host.ram.freeMb;
  const cpuTemp = host.cpu.tempC == null
    ? <span className="text-muted-foreground">{t('No CPU temperature observation.')}</span> : <Temp value={host.cpu.tempC} />;

  return <Card<"section"> render={(props) => <section {...props} />} variant={bare ? 'transparent' : 'default'} data-concept="C14" className="min-w-0 gap-0 p-0">
    <HostHeader host={host} bare={bare} />
    <Card.Content className={`flex flex-col gap-4 ${bare ? 'pt-4' : 'p-4 sm:p-6'}`}>
      <QueryReadNotice query={query} url="/api/host" />
      <div>
        <p className="mb-2 truncate text-sm font-medium" title={host.cpu.model}>{host.cpu.model}</p>
        <Row label={t('CPU · {cores} physical cores / {threads} logical processors', { cores: host.cpu.cores ?? '—', threads: host.cpu.threads ?? '—' })} value={load == null ? t('no reading yet') : `${nf(load)} %`} pct={load} tone={readingTone(load)} />
        <p className="mt-1 text-xs">{t('CPU temperature:')} {cpuTemp}</p>
      </div>
      <Row label="RAM" value={`${gb(usedMb)} / ${gb(host.ram.totalMb)} (${nf(host.ram.usedPct)} %)`} pct={host.ram.usedPct} tone={readingTone(host.ram.usedPct)} />
      <GpuSummary gpu={host.gpus[0]} />
      {compact ? <p className="text-xs text-muted-foreground">{t('Up {uptime}', { uptime: uptime(host.uptimeSec) })}</p> : <ExpandedSections host={host} />}
      <p className="text-xs text-muted-foreground">{t('Host data read {at}', { at: formatAbsolute(host.at) })}</p>
      <SourceObservations host={host} />
    </Card.Content>
  </Card>;
};
