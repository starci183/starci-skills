import type { AttemptDetailV3 } from '../../../contract';

const obj = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null);
const list = (value: unknown): string[] => (Array.isArray(value) ? value.map(item => (typeof item === 'string' ? item : JSON.stringify(item))) : []);

const failureClassVi: Record<string, string> = {
  business: 'nghiệp vụ (kết quả chưa đúng yêu cầu)', 'shared-change': 'thay đổi dùng chung (cần op khác xử lý)',
  transient: 'tạm thời (hạ tầng hoặc mạng)', infra: 'hạ tầng', tooling: 'công cụ', timeout: 'quá thời gian', contract: 'sai hợp đồng báo cáo',
};
export const failureClassText = (raw: string): string => failureClassVi[raw] ?? raw;

const nextKindVi: Record<string, string> = { retry: 'Thử lại op này', advance: 'Chuyển sang chặng kế tiếp', escalate: 'Chuyển cho người quyết', block: 'Dừng chờ xử lý', replan: 'Lập lại kế hoạch' };

export type SettleView = { lines: string[]; failedChecks: string[]; nextStep: string | null; failureClass: string | null };

/** Turn `settle.json` (+ the check rows) into short Vietnamese sentences: what failed, which checks, what happens next. */
export function settleView(attempt: AttemptDetailV3): SettleView {
  const json = obj(attempt.settle?.json) ?? {};
  const lines: string[] = [];
  const failureRaw = attempt.failureClass ?? attempt.retry.class ?? (typeof json.failureClass === 'string' ? json.failureClass : null);
  const failureClass = attempt.verdict === 'pass' ? null : failureRaw;
  const failedChecks = [...new Set(attempt.checks.filter(check => check.status === 'fail' || check.status === 'error').map(check => check.name))];
  const evidence = obj(json.checkEvidence);
  if (typeof json.reason === 'string' && json.reason) lines.push(json.reason);
  if (evidence) {
    const observed = Number(evidence.observed ?? 0); const passed = Number(evidence.passed ?? 0); const failed = Number(evidence.failed ?? 0);
    if (observed === 0) lines.push('Kernel không quan sát được kiểm chứng nào để đối chiếu.');
    else lines.push(`Kernel đối chiếu ${observed} kiểm chứng: ${passed} đạt, ${failed} hỏng.`);
  }
  if (failedChecks.length) lines.push(`Kiểm chứng hỏng: ${failedChecks.join(', ')}.`);
  if (json.claimOverruled === true) lines.push('Op tự báo hoàn tất nhưng kernel bác báo cáo đó vì kiểm chứng không xanh.');
  const landed = obj(json.landed);
  if (landed) {
    const missing = list(landed.missing); const dirty = list(landed.dirty);
    if (missing.length) lines.push(`Còn thiếu ở repo: ${missing.join(', ')}.`);
    if (dirty.length) lines.push(`Còn tệp chưa commit: ${dirty.join(', ')}.`);
    if (typeof landed.headCheck === 'string') lines.push(landed.headCheck === 'verified' ? 'Commit cuối mà op báo đã được kernel xác minh trong repo.' : `Kiểm tra commit cuối: ${landed.headCheck}.`);
  }
  if (attempt.verdict === 'blocked' && !lines.length) lines.push('Op báo bị chặn và kernel giữ nguyên kết luận đó.');
  const blocker = obj(obj(attempt.report?.json)?.blocker);
  if (attempt.verdict === 'blocked' && typeof blocker?.detail === 'string') lines.push(`Vướng mắc op nêu: ${blocker.detail}`);
  if (failureClass) lines.unshift(`Nhóm lỗi: ${failureClassText(failureClass)}.`);

  let nextStep: string | null = null;
  const parsedNext = (() => { try { return obj(JSON.parse(attempt.settle?.nextStep ?? 'null')); } catch { return null; } })();
  const next = obj(json.nextStep) ?? parsedNext;
  if (next) {
    const kind = typeof next.kind === 'string' ? (nextKindVi[next.kind] ?? next.kind) : null;
    const reason = typeof next.reason === 'string' ? next.reason : null;
    nextStep = [kind, reason].filter(Boolean).join(' — ') || null;
  } else if (typeof attempt.settle?.nextStep === 'string' && attempt.settle.nextStep) nextStep = attempt.settle.nextStep;
  return { lines, failedChecks, nextStep, failureClass };
}
