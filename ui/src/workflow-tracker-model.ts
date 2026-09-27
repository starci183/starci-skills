import type { JobProofs, LegRow, WorkflowEvent, WorkflowRow } from './contract';

export const OP_NAMES: Record<string, string> = {
  'request.analyze': 'Phân tích yêu cầu', 'scope.define': 'Xác định phạm vi', 'business.decide': 'Chốt nghiệp vụ',
  'architecture.decide': 'Thiết kế kiến trúc', 'brand.decide': 'Chốt thương hiệu',
  'interface.draw': 'Vẽ giao diện', 'interface.asset': 'Tạo tài sản ảnh',
  'interface.implement': 'Code giao diện', 'backend.implement': 'Code backend', 'code.refactor': 'Chỉnh sửa mã',
  'interface.audit': 'Soát giao diện', 'integration.verify': 'Kiểm thử tích hợp',
  'e2e.verify': 'Kiểm thử đầu cuối', 'uat.verify': 'Kiểm thử UAT', 'uat.assisted': 'Kiểm thử có hỗ trợ',
  'review.verify': 'Rà soát cuối', 'handover.review': 'Bàn giao', 'work.author': 'Chia việc chi tiết',
  'provision.ask': 'Xin thông tin',
};
export const opName = (op: string) => OP_NAMES[op] || op || 'Việc chưa rõ tên';
/** The shared op labels (modules/ops/labels.yaml, sent with the snapshot) replace the built-in names above. */
export function applyOpNames(labels: Record<string, { vi: string; en: string }> | undefined) {
  if (labels) for (const [op, entry] of Object.entries(labels)) if (entry?.vi) OP_NAMES[op] = entry.vi;
}
const WORKFLOW_NAMES: Record<string, string> = {
  'sn-foundation': 'Nền tảng StarCi Next', 'sn-learn-content': 'Nội dung học StarCi Next',
  'sn-subscription': 'Gói đăng ký StarCi Next', 'nivo-module-studio': 'Xưởng module Nivo',
  'nivo-fe-canon': 'Giao diện chuẩn Nivo',
};
// wf.name is the workflow's display name (workflows.display_name: `<Product> · <what it does>`) once it has one;
// a bare goal slug still reads through the older names or with spaces.
export const workflowName = (wf: WorkflowRow) => (wf.name && /\s/.test(wf.name) ? wf.name : WORKFLOW_NAMES[wf.name] || wf.name?.replaceAll('-', ' ')) || wf.id;

export const STAGES = ['Phạm vi', 'Nghiệp vụ', 'Kiến trúc', 'Vẽ', 'Tài sản ảnh', 'Code', 'Kiểm thử', 'Bàn giao', 'Khác'] as const;
export type Stage = typeof STAGES[number];
export function stageOf(op: string): Stage {
  if (/^(request\.|scope\.|provision\.)/.test(op)) return 'Phạm vi';
  if (/^(business\.|brand\.)/.test(op)) return 'Nghiệp vụ';
  if (/^architecture\./.test(op)) return 'Kiến trúc';
  if (/^interface\.draw/.test(op)) return 'Vẽ';
  if (/^interface\.asset/.test(op)) return 'Tài sản ảnh';
  if (/^(interface\.implement|backend\.implement|code\.|work\.author)/.test(op)) return 'Code';
  if (/^(integration\.|e2e\.|uat\.|interface\.audit|review\.verify)/.test(op)) return 'Kiểm thử';
  if (/^handover\./.test(op)) return 'Bàn giao';
  return 'Khác';
}

export type ItemState = 'done' | 'running' | 'waiting' | 'attention';
export function legState(wf: WorkflowRow, leg: LegRow): ItemState {
  if (wf.running.some((job) => job.op === leg.op)) return 'running';
  if (wf.queued.some((job) => job.op === leg.op)) return 'waiting';
  if (leg.state === 'done' || leg.color === 'green') return 'done';
  if (leg.rework || leg.state === 'failed' || leg.color === 'red') return 'attention';
  return 'waiting';
}
export function stageGroups(wf: WorkflowRow) {
  return STAGES.map((name) => {
    const legs = wf.legs.filter((leg) => stageOf(leg.op) === name)
      .sort((a, b) => (legState(wf, a) === 'done' ? 1 : 0) - (legState(wf, b) === 'done' ? 1 : 0));
    return { name, legs, done: legs.filter((leg) => legState(wf, leg) === 'done').length,
      running: legs.filter((leg) => legState(wf, leg) === 'running').length,
      waiting: legs.filter((leg) => legState(wf, leg) === 'waiting').length,
      attention: legs.filter((leg) => legState(wf, leg) === 'attention').length };
  }).filter((group) => group.legs.length);
}

export function ownerItems(wf: WorkflowRow) {
  const actions = (wf.nextActions || []).filter((action) => action.kind === 'owner-gate' && !wf.asks.some((ask) => ask.op === action.op));
  const linked = new Set(actions.map((action) => action.incidentId).filter(Boolean));
  const reviewOpen = (wf.drawReviews || []).some((review) => review.awaitingOwner);
  const readableGate = (reason: string, op: string) => /failed-retries-the-same-op|the owner decides whether it runs again/i.test(reason)
    ? `Quyết định có cho ${opName(op)} chạy lại sau khi đã hết số lần thử.`
    : /^ask\s+\S+\s+waits on the owner/i.test(reason) ? `Trả lời yêu cầu đang chờ về ${opName(op)}.`
      : `Đưa ra quyết định để ${opName(op)} tiếp tục.`;
  return [
    ...wf.asks.map((ask) => ({ key: `ask-${ask.op}-${ask.text}`, text: ask.text, summary: `Thầy cần trả lời yêu cầu về ${opName(ask.op)}.`, original: '', source: `Yêu cầu · ${opName(ask.op)}`, link: ask.link || (ask.op === 'interface.draw' && reviewOpen ? '#/owner' : null) })),
    ...(wf.drawReviews || []).filter((review) => review.awaitingOwner && !wf.asks.some((ask) => ask.op === 'interface.draw')).map((review) => ({ key: `review-${review.record}`, text: `Duyệt bản vẽ ${review.record}.`, summary: 'Thầy cần duyệt bản vẽ.', original: '', source: 'Bản vẽ chờ duyệt', link: '#/owner' })),
    ...actions.map((action, index) => ({ key: `next-${index}`, text: readableGate(action.reason, action.op), summary: `Thầy cần quyết định về ${opName(action.op)}.`, original: action.reason, source: `Bước tiếp theo · ${opName(action.op)}`, link: null as string | null })),
    ...wf.incidents.filter((incident) => /^\[owner-gate\]/i.test(incident.text) && !linked.has(incident.id))
      .map((incident) => { const op = incident.op || /\b[a-z]+\.[a-z]+\b/.exec(incident.text)?.[0] || ''; return { key: incident.id, text: readableGate(incident.text, op), summary: `Thầy cần quyết định về ${opName(op)}.`, original: incident.text, source: 'Sự cố cần thầy quyết định', link: null as string | null }; }),
  ];
}

export function presentSentence(wf: WorkflowRow, sourceOk: boolean) {
  if (!sourceOk || !wf.frontier) return 'Chưa xác nhận được trạng thái hiện tại.';
  const owner = ownerItems(wf);
  if (owner.length) return owner[0].summary;
  if (wf.frontier.state === 'peer-wait' || wf.frontier.peerWaits.length) return 'Đang chờ một luồng việc khác hoàn tất điều kiện phụ thuộc.';
  if (wf.holds.length) return `Đang chờ ${wf.holds[0].peer ? 'luồng việc khác' : 'điều kiện tiếp tục'} cho ${opName(wf.holds[0].op)}.`;
  if (wf.frontier.state === 'orphaned-frontier') return 'Runtime chưa xác định được bước tiếp theo.';
  if (wf.frontier.state === 'stalled') return 'Công việc đang vướng và cần được xử lý.';
  if (wf.running.length) return `Đang làm ${wf.running.map((job) => opName(job.op)).join(', ')}.`;
  if (wf.frontier.state === 'settle-ready') return 'Kernel đang chờ chốt kết quả công việc.';
  if (wf.queued.length) return `${wf.queued.length} việc đang chờ được bắt đầu.`;
  if (wf.frontier.state === 'idle' && wf.legs.length && wf.legs.every((leg) => legState(wf, leg) === 'done')) return 'Các việc trong kế hoạch đã hoàn tất.';
  if (wf.frontier.actionable) return 'Kernel có bước tiếp theo cần xử lý.';
  return 'Chưa có việc đang chạy; đang chờ trạng thái tiếp theo.';
}

export function etaText(wf: WorkflowRow, now: number, format: (at: number) => string) {
  return wf.etaAt == null ? 'Chưa có ước tính' : wf.etaAt < now ? `Ước tính cũ: ${format(wf.etaAt)}` : `Dự kiến xong: ${format(wf.etaAt)}`;
}

export function eventSentence(event: WorkflowEvent) {
  if (event.kind === 'op-dispatched') return `Bắt đầu ${opName(event.op || '')}.`;
  if (event.kind === 'report-filed') return `${opName(event.op || '')} đã nộp báo cáo; đang chờ chốt kết quả.`;
  if (event.kind === 'op-settled') return `${opName(event.op || '')} được chốt ${event.verdict === 'pass' ? 'đạt' : event.verdict === 'fail' ? 'chưa đạt' : event.verdict === 'blocked' ? 'bị chặn' : 'chưa rõ'}.`;
  return 'Kế hoạch công việc đã được cập nhật.';
}

export function retryGroups(jobs: JobProofs[]) {
  const ordered = [...jobs].sort((a, b) => a.attempt - b.attempt);
  const groups: { first: number; last: number; verdict: string; cause: string; jobs: JobProofs[] }[] = [];
  for (const job of ordered) {
    const verdict = job.verdict || (job.status === 'running' ? 'running' : job.status);
    const cause = job.report?.rootCause?.trim() || '';
    const previous = groups.at(-1);
    if (previous && cause && previous.cause === cause && previous.verdict === verdict && job.attempt === previous.last + 1) {
      previous.last = job.attempt; previous.jobs.push(job);
    } else groups.push({ first: job.attempt, last: job.attempt, verdict, cause, jobs: [job] });
  }
  return groups;
}

export function reportedCause(job: JobProofs) {
  const cause = job.report?.rootCause || '';
  if (!cause) return 'Chưa có nguyên nhân được báo cáo cho lần này.';
  if (/refreshSession|refresh-session\.handler/i.test(cause) && /verifyTwoFactor/i.test(cause))
    return 'Phiên đăng nhập không được khôi phục đúng; bước xác minh hai lớp thiếu đích chuyển.';
  if (/BRAND_DIRECTION_UNACCEPTED|brand\.direction/i.test(cause))
    return 'Hướng thiết kế chưa được duyệt nên bước vẽ chưa thể tiếp tục.';
  if (/DATA_STATUS_DRAWN|shape-slot/i.test(cause))
    return 'Bản vẽ chưa đáp ứng quy tắc trạng thái dữ liệu của công cụ.';
  return 'Báo cáo đã ghi nguyên nhân; xem nội dung gốc để biết chi tiết.';
}
