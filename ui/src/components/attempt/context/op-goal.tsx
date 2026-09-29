import type { AttemptDetailV3, OpInfo } from '../../../contract';
import { PathLink } from '../../path-link';
import type { Concept } from '../../concept';
import { Card } from '../frame/card';

export const concept: Concept = 'C8';

/** Block 2 "Op này làm gì": Vietnamese goal, what it must produce, its limits. `info` is null while loading or when the op has no yaml. */
export function OpGoalCard({ attempt, info, loading }: { attempt: AttemptDetailV3; info: OpInfo | null; loading: boolean }) {
  const goalVi = info?.goal?.vi ?? null;
  const goalEn = info?.goal?.en ?? null;
  const main = goalVi ?? goalEn;
  const owned = attempt.where?.ownedPaths?.length ? attempt.where.ownedPaths : (attempt.input?.ownedPaths ?? []).map(rel => ({ rel, abs: null as string | null }));
  const produces = info?.writes ?? [];
  const effects = info?.sideEffects ?? [];
  return <Card id="attempt-op-goal" concept="C8" title="Op này làm gì" hint={info?.nameEn ?? undefined}>
    {main ? <p className="m-0 text-base leading-relaxed">{main}</p> : <p className="m-0 text-sm text-muted-foreground">{loading ? 'Đang tải mô tả…' : 'Chưa có mô tả cho op này.'}</p>}
    {goalVi && goalEn ? <details className="mt-2 text-sm"><summary className="cursor-pointer text-xs text-muted-foreground">Bản tiếng Anh</summary><p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{goalEn}</p></details> : null}
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <div>
        <h3 className="m-0 mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phải tạo ra</h3>
        {produces.length ? <ul className="m-0 flex list-none flex-col gap-1 p-0">{produces.map(item => <li key={item} className="break-all font-mono text-xs">{item}</li>)}</ul> : <p className="m-0 text-sm text-muted-foreground">Hợp đồng op chưa khai báo sản phẩm.</p>}
      </div>
      <div>
        <h3 className="m-0 mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Giới hạn</h3>
        <div className="grid gap-2 text-sm">
          <div><span className="text-xs text-muted-foreground">Được ghi vào</span>
            {owned.length ? <div className="mt-1 flex flex-col items-start gap-1.5">{owned.map(item => item.abs ? <PathLink key={item.rel} path={item.abs} label={item.rel} /> : <code key={item.rel} className="break-all text-xs">{item.rel}</code>)}</div> : <p className="m-0 text-muted-foreground">Không giới hạn đường dẫn riêng.</p>}
          </div>
          <div><span className="text-xs text-muted-foreground">Tác động ngoài</span>
            {effects.length ? <ul className="m-0 mt-1 list-disc pl-5 text-xs">{effects.map(item => <li key={item} className="break-words">{item}</li>)}</ul> : <p className="m-0 text-muted-foreground">không có tác động ngoài</p>}
          </div>
        </div>
      </div>
    </div>
  </Card>;
}
