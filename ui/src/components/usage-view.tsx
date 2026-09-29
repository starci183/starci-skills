import type { Usage } from '../contract';
import type { Concept } from './concept';
import { compactNumber, InfoChip, usd } from './infra/rows';

export const concept: Concept = 'C16';

const NOT_RECORDED = 'Bảng llm_usage chưa có dòng nào cho mục này: runtime chưa ghi token.';

/** Token / cost usage block; shows "chưa ghi nhận" honestly when llm_usage is empty. */
export function UsageView({ usage, compact = false }: { usage: Usage; compact?: boolean }) {
  const total = usage.recorded ? usage.total : null;
  if (!usage.recorded || !total) {
    return compact
      ? <span className="inline-flex flex-wrap items-center gap-2 text-xs"><InfoChip tone="warning">chưa ghi nhận</InfoChip><span className="text-muted-foreground">{NOT_RECORDED}</span></span>
      : <div className="flex flex-col gap-1.5 text-[13px]"><span><InfoChip tone="warning">chưa ghi nhận</InfoChip></span><p className="m-0 text-muted-foreground">{NOT_RECORDED}</p></div>;
  }
  const toolErrors = usage.byModel.reduce((sum, row) => sum + (row.toolErrors ?? 0), 0);
  if (compact) {
    return <span className="text-xs text-muted-foreground">vào {compactNumber(total.input)} · ra {compactNumber(total.output)} · {usd(total.costUsd)} · {total.turns} lượt</span>;
  }
  const cells: [string, string][] = [
    ['Token vào', compactNumber(total.input)], ['Token ra', compactNumber(total.output)],
    ['Cache đọc', compactNumber(total.cacheRead)], ['Cache ghi', compactNumber(total.cacheWrite)],
    ['Suy luận', compactNumber(total.reasoning)], ['Chi phí', usd(total.costUsd)],
    ['Lượt', compactNumber(total.turns)], ['Gọi công cụ', `${compactNumber(total.toolCalls)}${toolErrors ? ` (${toolErrors} lỗi)` : ''}`],
  ];
  return <div className="flex flex-col gap-3">
    <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {cells.map(([label, value]) => <div key={label} className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
        <dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="m-0 font-mono text-sm font-semibold">{value}</dd>
      </div>)}
    </dl>
    {usage.byModel.length ? <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-xs">
        <thead><tr className="text-left text-muted-foreground">{['Model', 'Vào', 'Ra', 'Cache đọc', 'Cache ghi', 'Suy luận', 'Chi phí', 'Lượt', 'Công cụ'].map((h) => <th key={h} className="border-b border-border px-2 py-1 font-medium">{h}</th>)}</tr></thead>
        <tbody>{usage.byModel.map((row, index) => <tr key={`${row.model}-${row.subject_type}-${index}`} className="border-b border-border last:border-b-0">
          <td className="px-2 py-1 font-mono [overflow-wrap:anywhere]">{row.model}<span className="ml-1 text-muted-foreground">{row.subject_type}</span></td>
          <td className="px-2 py-1 font-mono">{compactNumber(row.input)}</td><td className="px-2 py-1 font-mono">{compactNumber(row.output)}</td>
          <td className="px-2 py-1 font-mono">{compactNumber(row.cacheRead)}</td><td className="px-2 py-1 font-mono">{compactNumber(row.cacheWrite)}</td>
          <td className="px-2 py-1 font-mono">{compactNumber(row.reasoning)}</td><td className="px-2 py-1 font-mono">{usd(row.costUsd)}</td>
          <td className="px-2 py-1 font-mono">{compactNumber(row.turns)}</td>
          <td className="px-2 py-1 font-mono">{compactNumber(row.toolCalls)}{row.toolErrors ? ` / ${row.toolErrors} lỗi` : ''}</td>
        </tr>)}</tbody>
      </table>
    </div> : null}
  </div>;
}
