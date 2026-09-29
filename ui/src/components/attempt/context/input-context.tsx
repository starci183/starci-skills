import { useState } from 'react';
import type { AttemptDetailV3, OpInfo } from '../../../contract';
import { KeyVal } from '../../key-val';
import { statusFromOutcome, statusFromVerdict } from '../../status';
import { StatusChip } from '../../status-chip';
import type { Concept } from '../../concept';
import { Card } from '../frame/card';
import { jsonText } from '../frame/util';

export const concept: Concept = 'C8';

const none = <span className="text-muted-foreground">không có</span>;
const jsonBox = 'max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-2 font-mono text-xs';
const verdictWords: Record<string, string> = { pass: 'đạt', fail: 'hỏng', partial: 'một phần', blocked: 'bị chặn', dropped: 'đã bỏ', cancelled: 'đã huỷ' };
const empty = (value: unknown) => value == null || (Array.isArray(value) && !value.length) || (typeof value === 'object' && !Array.isArray(value) && !Object.keys(value as object).length);
const h3 = 'm-0 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground';

function GoalExcerpt({ text, revision }: { text: string | null; revision: number | null }) {
  const [open, setOpen] = useState(false);
  if (!text) return <p className="m-0 text-sm text-muted-foreground">Chưa đọc được goal của workflow.</p>;
  const long = text.length > 280 || text.split('\n').length > 3;
  return <div>
    <p className={`m-0 whitespace-pre-wrap break-words text-sm ${open ? '' : 'line-clamp-3'}`}>{text}</p>
    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
      {revision != null ? <span>bản goal {revision}</span> : null}
      {long ? <button type="button" className="text-primary hover:underline" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Thu gọn' : 'Xem đầy đủ'}</button> : null}
    </div>
  </div>;
}

/** Block 3 "Đầu vào & ngữ cảnh": workflow goal, what the kernel handed over, what the op must read, and the previous attempt. */
export function InputContextCard({ attempt, info, goal }: { attempt: AttemptDetailV3; info: OpInfo | null; goal: { text: string; revision: number } | null }) {
  const input = attempt.input;
  const route = input?.route;
  const chosen = attempt.pool ?? input?.profile ?? null;
  const reads = info?.reads ?? [];
  const prior = attempt.prior ?? null;
  const reason = prior && prior.settleReason != null ? (typeof prior.settleReason === 'string' ? prior.settleReason : jsonText(prior.settleReason)) : null;
  return <Card id="attempt-input" concept="C8" title="Đầu vào & ngữ cảnh" hint="kernel giao gì, op phải đọc gì">
    <div className="grid gap-6">
      <section><h3 className={h3}>Mục tiêu của workflow</h3><GoalExcerpt text={goal?.text ?? null} revision={goal?.revision ?? null} /></section>
      <section><h3 className={h3}>Kernel giao cho op</h3>
        {!input ? <p className="m-0 text-sm text-muted-foreground">Job này không lưu payload đầu vào.</p> : <dl className="grid gap-3 text-sm md:grid-cols-2">
          <KeyVal label="Việc giao" value={input.what ?? none} />
          <KeyVal label="Quyền ghi" value={input.ownedPaths?.length ? <span className="flex flex-col gap-1">{input.ownedPaths.map(rel => <code key={rel} className="break-all text-xs">{rel}</code>)}</span> : none} />
          <KeyVal label="Record đầu vào" value={input.records?.length ? <pre className={jsonBox}>{jsonText(input.records)}</pre> : <span className="text-muted-foreground">không có (op tự đọc Work hiện có)</span>} />
          <KeyVal label="Tham số" value={empty(input.params) ? none : <pre className={jsonBox}>{jsonText(input.params)}</pre>} />
          {!empty(input.cut) || !empty(input.after) ? <KeyVal label="Cắt · sau" value={<pre className={jsonBox}>{jsonText({ cut: input.cut ?? null, after: input.after ?? null })}</pre>} /> : null}
          <KeyVal label="Goal" value={input.goal ? <>bản {input.goal.revision} · <span className="break-all font-mono text-xs">{input.goal.identity}</span></> : none} />
          <KeyVal label="Mô hình · effort · độ khó" value={[input.model ?? attempt.model, input.effort && `effort ${input.effort}`, input.difficulty && `độ khó ${input.difficulty}`].filter(Boolean).join(' · ') || none} />
          <KeyVal label="Định tuyến" value={route?.chain?.length ? <span>{route.chain.join(' → ')}{chosen ? <> · chọn <b>{chosen}</b></> : null}{route.rejected?.length ? ` · loại ${route.rejected.length}` : ''}{route.policy ? ` · chính sách ${route.policy}` : ''}{route.order ? ` · thứ tự ${route.order}` : ''}</span> : none} />
        </dl>}
      </section>
      <section><h3 className={h3}>Op phải đọc</h3>
        {reads.length ? <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">{reads.map(item => <li key={item.id}><code className="break-all text-xs">{item.id}</code>{item.purpose ? <span className="text-muted-foreground"> — {item.purpose}</span> : null}</li>)}</ul> : <p className="m-0 text-sm text-muted-foreground">Hợp đồng op không khai báo đầu vào phải đọc.</p>}
      </section>
      {prior ? <section className="rounded-lg border p-4"><h3 className={h3}>Lần trước</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <a className="font-medium text-primary hover:underline" href={prior.href}>lần {prior.try} · #{prior.id}</a>
          <StatusChip status={statusFromVerdict(prior.verdict, false, prior.reportOutcome)} label={prior.verdict ? `Kernel chốt: ${verdictWords[prior.verdict] ?? prior.verdict}` : 'Kernel chưa chốt'} />
          {prior.reportOutcome ? <StatusChip status={statusFromOutcome(prior.reportOutcome)} label={`Op tự báo: ${prior.reportOutcome}`} /> : null}
        </div>
        {prior.summary ? <p className="mb-0 mt-2 whitespace-pre-wrap break-words text-sm">{prior.summary}</p> : null}
        {reason ? <p className="mb-0 mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">Lý do chốt: {reason}</p> : null}
        {prior.nextStep ? <p className="mb-0 mt-2 text-xs text-muted-foreground">Bước kế: {prior.nextStep}</p> : null}
      </section> : null}
    </div>
  </Card>;
}
