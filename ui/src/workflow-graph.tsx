import { useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { LegColor, LegRow, WorkflowRow, WorkGraph, WorkGraphNode } from './types';
import { colorOrder, colorView, FlowDag, FlowLegend, type FlowEdgeIn, type FlowEdgeKind, type FlowNodeIn } from './flow-dag';
import { ProofDrawer, type ProofTarget, type ProofUnit } from './proofs';

// `api status` sets each leg's colour; the UI derives one only when status carries none.
function derivedColor(leg: LegRow): LegColor {
  if (leg.rework || leg.state === 'failed') return 'red';
  if (leg.state === 'running') return 'yellow';
  if (leg.state === 'done') return 'green';
  return 'gray';
}

function ColorCounts({ colors, ready }: { colors: LegColor[]; ready?: number }) {
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
    {colorOrder.map((color) => <span key={color} className="inline-flex items-center gap-1.5 text-zinc-400"><span className={`size-2.5 rounded-full ${colorView[color].dot}`} /><span>{colorView[color].name}</span><span className="tabular-nums text-zinc-600">{colors.filter((item) => item === color).length}</span></span>)}
    {ready != null && <span className="inline-flex items-center gap-1.5 text-zinc-400"><span className="size-2.5 rounded-sm outline outline-2 outline-violet-500" />chạy được ngay<span className="tabular-nums text-zinc-600">{ready}</span></span>}
  </div>;
}

const opLine = (op: string | null | undefined, labelOf: (op: string) => string) => (op ? `${op} · ${labelOf(op)}` : null);

/** The leg DAG (derivedPlan.edges, else the linear chain) with each leg's parallel units; a click opens its proofs. */
export function LegGraph({ wf, labelOf, ageOf }: { wf: WorkflowRow; labelOf: (op: string) => string; ageOf: (value: number | null) => string }) {
  const [target, setTarget] = useState<ProofTarget | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const { nodes, edges, linear } = useMemo(() => {
    const ops = wf.legs.map((leg) => leg.op);
    const known = new Set(ops);
    const planned = (wf.plan?.edges || []).filter(([from, to]) => known.has(from) && known.has(to) && from !== to);
    const linearChain = !wf.plan || wf.plan.source === 'linear' || (!planned.length && ops.length > 1);
    const pairs: [string, string][] = linearChain ? ops.slice(1).map((op, index) => [ops[index], op]) : planned;
    const flowNodes: FlowNodeIn[] = wf.legs.map((leg) => {
      const color = leg.color || derivedColor(leg);
      return { id: leg.op, title: labelOf(leg.op), opLine: leg.op, sub: `${colorView[color].name}${color === 'yellow' && leg.since ? ` · ${ageOf(leg.since)}` : ''}`, color, units: leg.units ?? null, strong: true };
    });
    return { nodes: flowNodes, edges: pairs.map(([from, to]) => ({ from, to, kind: 'plan' as FlowEdgeKind })), linear: linearChain };
  }, [wf.legs, wf.plan, labelOf, ageOf]);
  if (!wf.legs.length) return <p className="text-sm text-zinc-500">Chưa đọc được chuỗi công việc.</p>;
  const fromStatus = wf.legs.some((leg) => leg.color);
  const pick = (op: string) => {
    const leg = wf.legs.find((item) => item.op === op);
    setPicked(op);
    const units: ProofUnit[] = (leg?.units?.units ?? []).map((unit) => ({ ...unit, op, jobIds: unit.jobId ? [unit.jobId] : [] }));
    setTarget({ title: `${op} · ${labelOf(op)}`, op, jobIds: null, units });
  };
  return <div className="min-w-0 space-y-3">
    <ColorCounts colors={nodes.map((node) => node.color)} />
    <FlowLegend kinds={['plan']} />
    <FlowDag nodes={nodes} edges={edges} picked={picked} onPick={pick} testId="leg-graph-dag" />
    <p className="text-[11px] leading-5 text-zinc-600">{linear ? 'Kế hoạch chưa có đồ thị phụ thuộc: hiển thị theo chuỗi tuyến tính.' : 'Đồ thị phụ thuộc từ derivedPlan.edges.'} {fromStatus ? 'Màu lấy từ api status.' : 'api status chưa gửi màu: màu được suy ra từ trạng thái job.'} ×N đếm từ job trong ledger. Chạm vào một chặng để xem bằng chứng.</p>
    <ProofDrawer projectId={wf.projectId} workflowId={wf.id} target={target} onClose={() => { setTarget(null); setPicked(null); }} labelOf={labelOf} />
  </div>;
}

// api status nextActions kinds (modules/kernel/api.yaml): the first four are Kernel moves.
const kindView: Record<string, { name: string; tone: string }> = {
  retry: { name: 'Chạy lại', tone: 'border-sky-500/25 bg-sky-500/10 text-sky-400' },
  'root-verify': { name: 'Xác minh gốc', tone: 'border-sky-500/25 bg-sky-500/10 text-sky-400' },
  dispatch: { name: 'Giao việc', tone: 'border-sky-500/25 bg-sky-500/10 text-sky-400' },
  'impact-check': { name: 'Kiểm tra ảnh hưởng', tone: 'border-sky-500/25 bg-sky-500/10 text-sky-400' },
  'owner-gate': { name: 'Chờ thầy', tone: 'border-amber-500/25 bg-amber-500/10 text-amber-400' },
  wait: { name: 'Chờ', tone: 'border-zinc-700 text-zinc-400' },
};

/** What the runtime says comes next (`api status` nextActions). `orphaned-frontier` is a runtime defect. */
export function NextActions({ wf, labelOf, fallback }: { wf: WorkflowRow; labelOf: (op: string) => string; fallback: string }) {
  const orphaned = wf.frontier?.state === 'orphaned-frontier';
  const actions = wf.nextActions;
  return <div className="mt-3 max-w-4xl space-y-3">
    {orphaned && <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"><ShieldAlert className="mt-0.5 size-4 shrink-0" /><div><div className="font-medium">Lỗi runtime</div><p className="mt-1 leading-6">Luồng đang chạy nhưng ledger không nêu bước tiếp theo nào. Đây là lỗi của runtime, không phải việc chờ kernel hay chờ thầy.</p></div></div>}
    {actions == null ? !orphaned && <p className="text-sm leading-6 text-zinc-400">{fallback}</p>
      : actions.length ? <div><div className="mb-2 text-xs font-medium text-zinc-500">Bước tiếp theo</div><ol className="space-y-2">{actions.map((action, index) => <li key={`${action.kind}-${action.op}-${action.jobId ?? index}`} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
        <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={kindView[action.kind]?.tone}>{kindView[action.kind]?.name ?? action.kind}</Badge>{action.op && <span className="text-sm font-medium text-zinc-200">{action.displayName || labelOf(action.op)}</span>}{[action.jobId, action.incidentId].filter(Boolean).map((id) => <span key={id} className="font-mono text-[11px] text-zinc-500">{id}</span>)}</div>
        {action.reason && <p className="mt-1.5 break-words text-xs leading-5 text-zinc-400">{action.reason}</p>}
      </li>)}</ol></div>
      : !orphaned && <p className="text-sm text-zinc-500">Runtime không có bước tiếp theo cần làm lúc này.</p>}
  </div>;
}


const eventName: Record<string, string> = { draw: 'Vẽ v0', revise: 'Sửa', cut: 'Cắt slice', backfill: 'Dựng lại từ Work' };
const kindName: Record<string, string> = { foundation: 'Nền', slice: 'Slice', task: 'Việc' };
const upOf = (node: WorkGraphNode) => node.parent ?? (node.slice !== node.id ? node.slice : null);
const shortSlice = (node: WorkGraphNode) => (node.slice.startsWith(`${node.domain}.`) ? node.slice.slice(node.domain.length + 1) : node.slice);

/**
 * The work graph at its latest version as a pannable DAG: the graph's edges plus a `contains` link from a slice (or
 * parent) to each of its nodes no node of that slice feeds, so the foundation leads, slices and entry tasks follow
 * and fan-in nodes come last; one lane per domain. A slice with child nodes shows ×N. A click opens the proofs of
 * the op that last ran the node.
 */
export function WorkGraphView({ wf, graph, labelOf, timeOf }: { wf: WorkflowRow; graph: WorkGraph; labelOf: (op: string) => string; timeOf: (value: number | null) => string }) {
  const [target, setTarget] = useState<ProofTarget | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const domains = useMemo(() => [...new Set(graph.nodes.map((node) => node.domain))], [graph.nodes]);
  const [domain, setDomain] = useState(() => graph.nodes.find((node) => node.color === 'yellow' || node.color === 'red')?.domain || domains[0] || 'all');
  const selectedDomain = domain === 'all' || domains.includes(domain) ? domain : domains[0];
  const byId = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph]);
  const childrenOf = useMemo(() => {
    const out = new Map<string, WorkGraphNode[]>();
    for (const node of graph.nodes) { const up = upOf(node); if (up && byId.has(up)) out.set(up, [...(out.get(up) ?? []), node]); }
    return out;
  }, [graph, byId]);
  const unitsOf = (id: string): ProofUnit[] => (childrenOf.get(id) ?? []).map((kid) => ({
    label: kid.title, jobId: kid.jobs[0]?.jobId ?? null, status: kid.color, model: kid.jobs[0]?.model ?? null, op: kid.lastOp, jobIds: kid.jobs.filter((job) => job.op === kid.lastOp).map((job) => job.jobId),
  }));
  const frontier = useMemo(() => new Set(graph.frontier), [graph]);
  const { nodes, edges, crossing } = useMemo(() => {
    const selected = selectedDomain === 'all' ? graph.nodes : graph.nodes.filter((node) => node.domain === selectedDomain);
    const visible = new Set(selected.map((node) => node.id));
    const crossingEdges = graph.edges.filter((edge) => byId.has(edge.from) && byId.has(edge.to) && byId.get(edge.from)!.domain !== byId.get(edge.to)!.domain);
    if (selectedDomain === 'all') {
      const overviewNodes: FlowNodeIn[] = domains.map((item) => {
        const group = graph.nodes.filter((node) => node.domain === item);
        const running = group.filter((node) => node.color === 'yellow').length;
        const rework = group.filter((node) => node.color === 'red').length;
        const done = group.filter((node) => node.color === 'green').length;
        return { id: `domain:${item}`, title: item, opLine: `${group.length} nút · ${done} xong · ${running} đang chạy`,
          sub: rework ? `${rework} cần làm lại · Chọn để xem` : 'Chọn để xem chi tiết', color: rework ? 'red' : running ? 'yellow' : done === group.length ? 'green' : 'gray', strong: true };
      });
      const pairs = new Set<string>();
      const overviewEdges: FlowEdgeIn[] = [];
      for (const edge of crossingEdges) {
        const from = byId.get(edge.from)!.domain; const to = byId.get(edge.to)!.domain;
        const key = `${from}>${to}`;
        if (!pairs.has(key)) { pairs.add(key); overviewEdges.push({ from: `domain:${from}`, to: `domain:${to}`, kind: 'summary' }); }
      }
      return { nodes: overviewNodes, edges: overviewEdges, crossing: crossingEdges.length };
    }
    const flowEdges: FlowEdgeIn[] = graph.edges.filter((edge) => visible.has(edge.from) && visible.has(edge.to) && edge.from !== edge.to);
    for (const node of selected) {
      const up = upOf(node);
      if (up && visible.has(up) && !flowEdges.some((edge) => edge.to === node.id && byId.get(edge.from)!.slice === node.slice)) flowEdges.push({ from: up, to: node.id, kind: 'contains' });
    }
    const flowNodes: FlowNodeIn[] = selected.map((node) => {
      const kids = childrenOf.get(node.id) ?? [];
      const units = kids.length ? { total: kids.length, planned: false, units: kids.map((kid) => ({ label: kid.title, jobId: kid.jobs[0]?.jobId ?? null, status: kid.color, model: kid.jobs[0]?.model ?? null })) } : null;
      return { id: node.id, title: `${node.title}${node.inferred ? ' *' : ''}`, opLine: opLine(node.lastOp, labelOf) ?? 'chưa có op chạy', lane: selectedDomain === 'all' ? node.domain : undefined,
        sub: `${kindName[node.kind] ?? node.kind} · ${node.kind === 'task' ? shortSlice(node) : colorView[node.color].name}`, color: node.color, ready: frontier.has(node.id), units, strong: node.kind !== 'task' };
    });
    return { nodes: flowNodes, edges: flowEdges, crossing: crossingEdges.filter((edge) => visible.has(edge.from) || visible.has(edge.to)).length };
  }, [graph, byId, childrenOf, frontier, labelOf, selectedDomain, domains]);
  const pick = (id: string) => {
    if (id.startsWith('domain:')) { setDomain(id.slice('domain:'.length)); setPicked(null); return; }
    const node = byId.get(id);
    if (!node) return;
    setPicked(id);
    setTarget({ title: node.title, op: node.lastOp, jobIds: node.jobs.filter((job) => job.op === node.lastOp).map((job) => job.jobId), units: unitsOf(id) });
  };
  const chosen = picked ? byId.get(picked) : null;
  const kinds = selectedDomain === 'all' ? ['summary' as FlowEdgeKind] : (['data', 'contract', 'order', 'contains'] as FlowEdgeKind[]).filter((kind) => kind !== 'contains' || edges.some((edge) => edge.kind === 'contains'));
  const en = document.documentElement.lang === 'en';
  return <div className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2"><ColorCounts colors={graph.nodes.map((node) => node.color)} ready={frontier.size} /><Badge variant="outline" className="font-mono text-[11px]">v{graph.version} · {eventName[graph.event] || graph.event}</Badge></div>
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/35 p-3"><div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{en ? 'Browse by domain' : 'Xem từng domain'}</div><div className="flex flex-wrap gap-1.5" role="group" aria-label={en ? 'Work Graph domain filter' : 'Lọc domain của Work Graph'}>
      {domains.map((item) => { const group = graph.nodes.filter((node) => node.domain === item); const hot = group.filter((node) => node.color === 'yellow' || node.color === 'red').length; return <button key={item} type="button" onClick={() => { setDomain(item); setPicked(null); }} data-testid="domain-filter" aria-pressed={selectedDomain === item} className={`rounded-md border px-2.5 py-1.5 text-xs ${selectedDomain === item ? 'border-sky-500/50 bg-sky-500/10 text-sky-200' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>{item} <span className="ml-1 text-[10px] opacity-70">{group.length}{hot ? ` · ${hot} ${en ? 'active' : 'đang xử lý'}` : ''}</span></button>; })}
      {domains.length > 1 && <button type="button" onClick={() => { setDomain('all'); setPicked(null); }} data-testid="domain-filter-all" aria-pressed={selectedDomain === 'all'} className={`rounded-md border px-2.5 py-1.5 text-xs ${selectedDomain === 'all' ? 'border-sky-500/50 bg-sky-500/10 text-sky-200' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>{en ? 'Domain overview' : 'Tổng quan domain'} · {domains.length}</button>}
    </div><p className="mt-2 text-[11px] text-zinc-500">{selectedDomain === 'all' ? (en ? `${nodes.length} domains · ${crossing} cross-domain links from the work graph. Select a domain to inspect its nodes.` : `${nodes.length} domain · ${crossing} liên kết liên domain từ Work Graph. Chọn domain để xem từng nút.`) : en ? `${nodes.length} nodes · ${edges.length} visible links${crossing ? ` · ${crossing} cross-domain links (open Domain overview)` : ''}. Select a node for its operation, report and evidence.` : `${nodes.length} nút · ${edges.length} liên kết trong khung${crossing ? ` · ${crossing} liên kết sang domain khác (xem ở Tổng quan domain)` : ''}. Chọn nút để xem op, report và bằng chứng.`}</p></div>
    <FlowLegend kinds={kinds} />
    <FlowDag nodes={nodes} edges={edges} picked={picked} onPick={pick} direction={selectedDomain === 'all' ? 'TB' : 'LR'} testId="work-graph-dag" />
    {chosen ? <p className="break-all font-mono text-[11px] text-zinc-500">{chosen.id} · slice {chosen.slice}{chosen.frs.length ? ` · ${chosen.frs.join(', ')}` : ''}</p>
      : <p className="text-[11px] text-zinc-600">Kéo để di chuyển, chụm hai ngón (hoặc Ctrl + cuộn) để phóng to, nút Vừa khung để xem cả đồ thị. Chạm vào một nút để mở bằng chứng.</p>}
    <details className="text-xs text-zinc-500"><summary className="cursor-pointer">Lịch sử phiên bản ({graph.history.length})</summary><ol className="mt-2 space-y-1.5">{graph.history.map((version) => <li key={version.version} className="rounded-md border border-zinc-800 p-2">
      <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-zinc-300">v{version.version}</span><span>{eventName[version.event] || version.event}</span><span className="text-zinc-400">{labelOf(version.authorOp)}</span>{version.authorJob && <span className="font-mono text-zinc-600">{version.authorJob}</span>}<span className="ml-auto">{timeOf(version.at)}</span></div>
      <p className="mt-1 break-words leading-5 text-zinc-400">{version.reason}</p>
      <p className="mt-1 text-zinc-600">+{version.added} −{version.removed} ~{version.changed}{version.red.length ? ` · đỏ: ${version.red.join(', ')}` : ''}</p>
    </li>)}</ol></details>
    <p className="text-[11px] leading-5 text-zinc-600">Màu lấy từ các job ghi lên đường dẫn của từng nút: xanh = job cuối xong, vàng = có job đang chạy, đỏ = job cuối hỏng hoặc phải làm lại, xám = chưa có job. ×N của slice = số nút con; ✓ xong, ▶ đang chạy, ⏳ chưa tới, ✗ làm lại. * = phần suy ra khi dựng lại từ Work.</p>
    <ProofDrawer projectId={wf.projectId} workflowId={wf.id} target={target} onClose={() => { setTarget(null); setPicked(null); }} labelOf={labelOf} />
  </div>;
}
