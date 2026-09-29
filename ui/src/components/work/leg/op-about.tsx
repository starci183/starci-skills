import { useState } from 'react';
import type { LegRow } from '../../../contract';
import { PathLink } from '../../path-link';
import { legInfo } from '../pipeline/node/op-identity';
import type { Concept } from '../../concept';

export const concept: Concept = 'C4';

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-6"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>{children}</section>;
}

/** "Op này làm gì" + inputs, outputs, side effects, manifest — from the op's own yaml (read-only). */
export function OpAbout({ leg }: { leg: LegRow }) {
  const info = legInfo(leg);
  const [more, setMore] = useState(false);
  if (!info) return null;
  const goalVi = info.goal.vi ?? info.goal.en;
  return <div className="mb-2">
    <Block title="Op này làm gì">
      <p className="text-sm">{goalVi ?? 'Chưa có mô tả cho op này.'}</p>
      {info.goal.en && info.goal.vi ? <div className="mt-2">
        <button type="button" className="text-xs font-medium text-primary hover:underline" aria-expanded={more} onClick={() => setMore(v => !v)}>{more ? 'Ẩn bản gốc tiếng Anh' : 'Xem bản gốc tiếng Anh'}</button>
        {more ? <p className="mt-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">{info.goal.en}</p> : null}
      </div> : null}
    </Block>
    <Block title="Cần đầu vào">{info.reads.length ? <ul className="space-y-2">{info.reads.map(read => <li key={read.id} className="text-xs">
      <span className="font-mono font-semibold">{read.id}</span>{read.purpose ? <span className="block text-muted-foreground">{read.purpose}</span> : null}</li>)}</ul> : <p className="text-xs text-muted-foreground">Không khai báo.</p>}</Block>
    <Block title="Tạo ra">{info.writes.length ? <ul className="space-y-2">{info.writes.map(w => <li key={w} className="break-all font-mono text-xs">{w}</li>)}</ul> : <p className="text-xs text-muted-foreground">Không khai báo.</p>}</Block>
    <Block title="Tác động">{info.sideEffects.length ? <ul className="list-disc space-y-1 pl-4 text-xs">{info.sideEffects.map(e => <li key={e}>{e}</li>)}</ul> : <p className="text-xs text-muted-foreground">Không có tác động ngoài.</p>}</Block>
    <Block title="Tệp khai báo op (manifest)">{info.manifest ? <PathLink path={info.manifest} kind="file" /> : <p className="text-xs text-muted-foreground">Không có.</p>}</Block>
    <hr className="mt-6" />
  </div>;
}
