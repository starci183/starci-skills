import type { FleetSummary } from '../../contract';
import type { Concept } from '../concept';
import { AgentAvatar, agentOf } from '../agent/agent-avatar';
import { attemptAgent, useAttemptAgents } from '../agent/use-running-agents';
import { familyTint } from '../agent/agent-marks';
import { Grow } from '../motion';

export const concept: Concept = 'C2';

const number = (value: number) => new Intl.NumberFormat('vi-VN').format(value);

/** Running ops per model as bars, plus 24 h token usage. */
export function ModelsPanel({ summary, bare = false }: { summary: FleetSummary | undefined; bare?: boolean }) {
  const { running } = useAttemptAgents();
  if (!summary) return <p className="p-6 text-sm text-muted-foreground">Đang đọc…</p>;
  const families = new Map<string, ReturnType<typeof attemptAgent>[]>();
  for (const item of running) { const agent = attemptAgent(item, true); const list = families.get(agent.family); if (list) list.push(agent); else families.set(agent.family, [agent]); }
  const max = Math.max(1, ...summary.models.map(item => item.running));
  const usage = summary.usage24h;
  return <div className={`flex flex-col gap-4 ${bare ? '' : 'p-4 sm:p-6'}`}>
    <div>
      <p className="text-xs font-medium text-muted-foreground">Agent đang chạy</p>
      {families.size ? <div className="mt-2 flex flex-col gap-2">{[...families.entries()].map(([family, list]) => <div key={family} className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="w-14 shrink-0 text-xs font-medium">{familyTint[list[0].family].name}</span>
        <span className="flex flex-wrap items-center gap-2">{list.map(agent => <AgentAvatar key={agent.href} agent={agent} size={26} live />)}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{list.length}</span>
      </div>)}</div> : <p className="mt-1 text-sm text-muted-foreground">Không có agent nào đang chạy.</p>}
    </div>
    {summary.models.length ? <ul className="flex flex-col gap-3">
      {summary.models.map((item, index) => <li key={`${item.model ?? item.pool ?? 'unknown'}-${index}`} data-tone="running">
        <div className="flex items-baseline justify-between gap-2 text-sm"><span className="flex min-w-0 items-center gap-2"><AgentAvatar agent={agentOf(item)} size={22} /><span className="min-w-0 truncate font-medium">{item.model ?? item.pool ?? 'Chưa rõ mô hình'}</span></span><span className="tabular-nums">{item.running} op</span></div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><Grow className="block h-full rounded-full" style={{ width: `${(item.running / max) * 100}%`, background: 'var(--tone)' }} /></div>
        <p className="mt-1 truncate text-xs text-muted-foreground">{[item.agent, item.pool].filter(Boolean).join(' · ') || 'agent chưa rõ'}</p>
      </li>)}
    </ul> : <p className="text-sm text-muted-foreground">Không có op nào đang chạy.</p>}
    <div className="border-t pt-3">
      <p className="text-xs font-medium text-muted-foreground">Token 24 giờ</p>
      {usage.recorded ? <p className="mt-1 text-sm tabular-nums">vào {number(usage.inputTokens)} · ra {number(usage.outputTokens)}{usage.costUsd != null ? ` · $${usage.costUsd.toFixed(2)}` : ''}</p>
        : <p className="mt-1 text-sm text-muted-foreground">chưa ghi nhận</p>}
    </div>
  </div>;
}
