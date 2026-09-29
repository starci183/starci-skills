import { useApiQuery } from '../../api/query';
import type { AttemptDetailV2, ContractInfo, LegRowV3, PipelineView } from '../../contract';
import { formatAbsolute, formatOpLabel } from '../../i18n/vi';
import { KeyVal } from '../key-val';
import { PathLink } from '../path-link';
import { statusFromOutcome, statusFromVerdict, toneVar, type Tone } from '../status';
import { StatusChip } from '../status-chip';
import type { Concept } from '../concept';
import { Card } from './frame/card';
import { formatSpan, jsonText } from './frame/util';
import { isOpen } from './frame/steps';

export const concept: Concept = 'C8';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;
const none = <span className="text-muted-foreground">không có</span>;
const jsonBox = 'max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-2 font-mono text-xs';

type Assertion = { name: string; tone: Tone };
/** Assertions the op reported: `assertions`/`outcomes` when present, otherwise the checks it declared in report.json. */
function assertionsOf(json: unknown): { items: Assertion[]; source: string } | null {
  if (!isRecord(json)) return null;
  for (const key of ['assertions', 'outcomes', 'checks'] as const) {
    const list = json[key];
    if (!Array.isArray(list) || !list.length) continue;
    const items: Assertion[] = list.filter(isRecord).map((item, index) => {
      const verdict = item.status ?? item.result ?? item.outcome;
      const flag = item.ok ?? item.passed ?? item.pass;
      const exit = typeof item.exitCode === 'number' ? item.exitCode : null;
      const pass = flag === true || verdict === 'pass' || verdict === 'passed' || verdict === 'done' || verdict === 'ok' || (flag == null && verdict == null && exit === 0);
      const fail = flag === false || verdict === 'fail' || verdict === 'failed' || verdict === 'error' || (exit != null && exit !== 0);
      return { name: text(item.name) ?? text(item.id) ?? text(item.claim) ?? `#${index + 1}`, tone: pass ? 'success' : fail ? 'failed' : 'queued' };
    });
    if (items.length) return { items, source: key === 'checks' ? 'check op khai trong report' : key };
  }
  return null;
}

function ToneBar({ items }: { items: Assertion[] }) {
  const tones: Tone[] = ['success', 'failed', 'queued'];
  return <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={tones.map(tone => `${items.filter(item => item.tone === tone).length} ${tone}`).join(', ')}>
    {tones.map(tone => { const n = items.filter(item => item.tone === tone).length; return n ? <span key={tone} className="h-full" style={{ flex: n, background: toneVar(tone) }} /> : null; })}
  </div>;
}

/** What this op does: name from /api/contract, goal from the workflow pipeline's leg for this op. */
function OpAbout({ attempt }: { attempt: AttemptDetailV2 }) {
  const contract = useApiQuery<ContractInfo>('/api/contract', { topics: ['system'], intervalMs: 60_000 });
  const pipeline = useApiQuery<PipelineView>(`/api/workflows/${encodeURIComponent(attempt.project)}/${encodeURIComponent(attempt.wf)}/pipeline`);
  const op = attempt.op;
  const leg = pipeline.data?.legs.find(item => item.op === op) as LegRowV3 | undefined;
  const goal = leg?.info?.goal.vi ?? leg?.info?.goal.en ?? null;
  const name = formatOpLabel(op, contract.data?.opLabels);
  return <div className="rounded-lg border bg-muted/30 p-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Op này làm gì</p>
    <p className="mt-1 text-sm"><b>{name}</b>{name !== op ? <span className="ml-2 font-mono text-xs text-muted-foreground">{op}</span> : null}</p>
    {goal ? <p className="mt-1 text-sm">{goal}</p> : <p className="mt-1 text-xs text-muted-foreground">{pipeline.loading ? 'Đang tải mô tả…' : 'Chưa có mô tả cho op này.'}</p>}
  </div>;
}

function InputCard({ attempt }: { attempt: AttemptDetailV2 }) {
  const input = attempt.input;
  const paths = attempt.where.ownedPaths.length ? attempt.where.ownedPaths : (input?.ownedPaths ?? []).map(rel => ({ rel, abs: null as string | null }));
  const end = attempt.settledAt ?? attempt.reportedAt;
  const duration = attempt.dispatchedAt && end ? end - attempt.dispatchedAt : null;
  const route = input?.route;
  const chosen = attempt.pool ?? input?.profile ?? null;
  return <Card concept="C8" title="Đầu vào" hint="jobs.payload_json → op" className="h-full">
    <div className="grid gap-3"><OpAbout attempt={attempt} />
    {!input ? <p className="text-sm text-muted-foreground">Job này không lưu payload đầu vào.</p> : <dl className="grid gap-3 text-sm">
      <KeyVal label="Việc giao" value={input.what ?? none} />
      <KeyVal label="Quyền ghi" value={paths.length ? <span className="flex flex-col items-start gap-1.5">{paths.map(item => item.abs ? <PathLink key={item.rel} path={item.abs} label={item.rel} /> : <code key={item.rel} className="break-all text-xs">{item.rel}</code>)}</span> : none} />
      <KeyVal label="Record đầu vào" value={input.records.length ? <pre className={jsonBox}>{jsonText(input.records)}</pre> : <span className="text-muted-foreground">không có (op tự đọc Work hiện có)</span>} />
      <KeyVal label="Tham số" value={input.params == null ? none : <pre className={jsonBox}>{jsonText(input.params)}</pre>} />
      <KeyVal label="Goal" value={input.goal ? <>bản {input.goal.revision} · <span className="font-mono text-xs">{input.goal.identity}</span></> : none} />
      <KeyVal label="Agent · mô hình" value={[attempt.agent ?? attempt.where.agent, input.model ?? attempt.model, input.effort && `effort ${input.effort}`, input.difficulty && `độ khó ${input.difficulty}`].filter(Boolean).join(' · ') || none} />
      <KeyVal label="Định tuyến" value={route?.chain.length ? <span>{route.chain.join(' → ')}{chosen ? <> · chọn <b>{chosen}</b></> : null}{route.rejected.length ? ` · loại ${route.rejected.length}` : ''}{route.policy ? ` · chính sách ${route.policy}` : ''}{route.order ? ` · thứ tự ${route.order}` : ''}</span> : none} />
      <KeyVal label="Chạy" value={attempt.dispatchedAt ? <span>{formatAbsolute(attempt.dispatchedAt)} → {attempt.settledAt ? formatAbsolute(attempt.settledAt) : 'chưa chốt'}{duration != null ? ` · ${formatSpan(duration)}` : ''}</span> : none} />
    </dl>}
    </div>
  </Card>;
}

function OutputCard({ attempt }: { attempt: AttemptDetailV2 }) {
  const json = attempt.report?.json;
  const summary = (isRecord(json) ? text(json.summary) : null) ?? attempt.summary;
  const blocker = isRecord(json) && isRecord(json.blocker) ? text(json.blocker.detail) : null;
  const assertions = assertionsOf(json);
  const outcome = statusFromOutcome(attempt.reportOutcome);
  const open = isOpen(attempt);
  const decision = attempt.settle?.decision;
  const failing = assertions?.items.filter(item => item.tone === 'failed') ?? [];
  const evidenceCount = attempt.files.filter(file => file.group === 'evidence').length;
  const checkFiles = attempt.files.filter(file => file.group === 'check').length;
  return <Card concept="C8" title="Đầu ra" hint={`op → report · ${attempt.files.length} tệp · ${attempt.checks.length} check`} className="h-full">
    <div className="grid gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={outcome} label={attempt.reportOutcome ?? (open ? 'chưa báo cáo' : 'không có report')} />
        {assertions ? <span className="text-xs text-muted-foreground">{assertions.items.filter(item => item.tone === 'success').length}/{assertions.items.length} đạt ({assertions.source})</span> : null}
      </div>
      <p className="whitespace-pre-wrap break-words">{summary ?? 'Op chưa gửi tóm tắt.'}</p>
      {blocker ? <p className="rounded-lg border p-3 text-xs" data-tone="failed" style={{ borderColor: 'var(--tone-line)', background: 'var(--tone-bg)' }}><b>Lý do chặn: </b>{blocker}</p> : null}
      {assertions ? <div className="grid gap-2"><ToneBar items={assertions.items} />
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">{assertions.items.map((item, index) => <li key={index} className="inline-flex items-center gap-1.5" data-tone={item.tone}><span className="size-2 rounded-sm bg-[var(--tone)]" aria-hidden="true" />{item.name}</li>)}</ul>
        {failing.length ? <p className="text-xs text-muted-foreground">Chưa đạt: {failing.map(item => item.name).join(', ')}</p> : null}
      </div> : null}
      <dl className="grid gap-3">
        <KeyVal label="Tệp nộp" value={`${attempt.files.length} tệp${attempt.files.length ? ` (${evidenceCount} bằng chứng, ${checkFiles} output check)` : ''}`} />
        <KeyVal label="Check" value={`${attempt.checks.length - attempt.checksRed}/${attempt.checks.length} đạt`} />
        <KeyVal label="Kernel chốt" value={attempt.verdict ? <span className="inline-flex flex-wrap items-center gap-2"><StatusChip status={statusFromVerdict(attempt.verdict)} label={attempt.verdict} />{attempt.settledBy ? <span className="text-xs text-muted-foreground">bởi {attempt.settledBy}</span> : null}</span> : <span className="text-muted-foreground">{open && attempt.reportedAt ? 'đang chốt' : 'chưa chốt'}</span>} />
        <KeyVal label="Quyết định · bước kế" value={decision || attempt.settle?.nextStep ? <span>{decision ? <a className="text-primary hover:underline" href={decision.href}>{decision.kind} {decision.id}</a> : null}{decision && attempt.settle?.nextStep ? ' · ' : ''}{attempt.settle?.nextStep}</span> : <span className="text-muted-foreground">{attempt.retry.next ? <>thử lại: <a className="text-primary hover:underline" href={attempt.retry.next.href}>lần #{attempt.retry.next.id}</a></> : 'chưa có'}</span>} />
        {attempt.failureClass ? <KeyVal label="Nhóm lỗi" value={attempt.failureClass} /> : null}
      </dl>
    </div>
  </Card>;
}

/** "Đầu vào" (what the op received) and "Đầu ra" (what it returned) side by side. */
export function AttemptIO({ attempt }: { attempt: AttemptDetailV2 }) {
  return <div className="grid min-w-0 items-stretch gap-4 lg:grid-cols-2"><InputCard attempt={attempt} /><OutputCard attempt={attempt} /></div>;
}
