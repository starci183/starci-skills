import type { ContractInfo, Reason, UiState } from '../contract';

export const navLabels = {
  overview: 'Tổng quan',
  decisions: 'Quyết định',
  system: 'Hệ thống',
  logs: 'Nhật ký',
  analytics: 'Phân tích',
} as const;

export const stateLabels: Record<UiState, string> = {
  bad: 'Hỏng / Kẹt',
  warn: 'Chậm / Cảnh báo',
  running: 'Đang chạy',
  waiting: 'Chờ',
  ok: 'Ổn',
  done: 'Xong',
  unknown: 'Chưa rõ',
};

export const unitStateLabels = {
  planned: 'Đã lên kế hoạch',
  queued: 'Đang xếp hàng',
  running: 'Đang chạy',
  reported: 'Đã báo cáo',
  deciding: 'Đang quyết định',
  done: 'Đạt',
  failed: 'Hỏng',
  dropped: 'Đã bỏ',
} as const;

export const stepLabels = {
  dispatch: 'Giao',
  run: 'Chạy',
  report: 'Báo cáo',
  checks: 'Kiểm',
  verdict: 'Chốt',
  land: 'Land',
} as const;

export const learningKindLabels: Record<string, string> = {
  lesson: 'Bài học',
  hypothesis: 'Giả thuyết',
  experiment: 'Thí nghiệm',
  'experiment-result': 'Kết quả thí nghiệm',
};

export const learningStateLabels: Record<string, string> = {
  kept: 'Giữ',
  reverted: 'Hoàn tác',
  keep: 'Giữ',
  revert: 'Hoàn tác',
  proposed: 'Đề xuất',
  running: 'Đang chạy',
  landed: 'Đã land',
};

export function formatOpLabel(op: string, labels: ContractInfo['opLabels']): string {
  return labels?.[op]?.vi?.trim() || labels?.[op.split('#')[0]]?.vi?.trim() || op;
}

export const reasonLabels: Record<string, string> = {
  OWNER_DECISION_OPEN: 'Có quyết định của chủ đang chờ',
  DECISION_OPEN: 'Có quyết định đang chờ',
  DECISION_OVERDUE: 'Quyết định đã quá hạn',
  PHASE_REASON: 'Pha workflow được ghi nhận',
  UNDER_DISPATCHED: 'Giao việc dưới mức tối thiểu',
  READY_UNDISPATCHED: 'Có đơn vị sẵn sàng chưa được giao',
  RAM_THROTTLED: 'Máy đang giới hạn do RAM',
  WORKER_SILENT: 'Op chưa có tín hiệu trong hạn',
  QUESTION_OVERDUE: 'Câu hỏi của Op đã quá hạn',
  SEAT_VACANT: 'Ghế Kernel đang trống',
  UpstreamNotDone: 'Đang chờ đơn vị trước hoàn thành',
  WorkerQuestionPending: 'Op đang chờ câu trả lời',
  SettleTailFailed: 'Bước sau settle bị lỗi',
  SLA_CRITICAL: 'SLA ở mức nghiêm trọng',
  SLA_WARNING: 'SLA đang cảnh báo',
  UNIT_FAILED: 'Đơn vị bị lỗi',
  PROGRESS: 'Tiến độ cần chú ý',
};

const reasonParamLabels: Record<string, string> = {
  kind: 'Loại quyết định',
  phase: 'Pha',
  count: 'Số lượng',
  running: 'Đang chạy',
  allowedParallel: 'Mức song song cho phép',
  queuedReady: 'Sẵn sàng trong hàng đợi',
};

const reasonParamValues: Record<string, string> = {
  'settle-nongreen': 'Chốt kết quả chưa đạt',
  'credential-missing': 'Thiếu thông tin truy cập',
  decision: 'Quyết định',
  paused: 'Tạm dừng',
  stopped: 'Đã dừng',
  running: 'Đang chạy',
  queued: 'Đang xếp hàng',
  done: 'Đã hoàn thành',
};

function reasonTitle(code: string): string {
  if (reasonLabels[code]) return reasonLabels[code];
  if (code.startsWith('DecisionOpen:')) return `Quyết định đang chờ · ${reasonParamValues[code.slice(13)] ?? code.slice(13)}`;
  if (code.startsWith('IncidentOpen:')) return `Sự cố đang mở · ${reasonParamValues[code.slice(13)] ?? code.slice(13)}`;
  return code;
}

export function formatReason(reason: Reason | null | undefined): string {
  if (!reason) return 'Chưa có lý do được ghi nhận';
  const title = reasonTitle(reason.code);
  const params = Object.entries(reason.params ?? {}).filter(([, value]) => value !== '' && value !== null && value !== undefined);
  if (!params.length) return title;
  return `${title} · ${params.map(([key, value]) => `${reasonParamLabels[key] ?? key}: ${reasonParamValues[String(value)] ?? value}`).join(' · ')}`;
}

export function formatAbsolute(at: number | null | undefined): string {
  if (at == null || !Number.isFinite(at)) return 'Chưa có thời điểm';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(at);
}

export function formatRelative(at: number | null | undefined, now = Date.now()): string {
  if (at == null || !Number.isFinite(at)) return 'Chưa có thời điểm';
  const delta = Math.max(0, now - at);
  if (delta < 60_000) return 'vừa xong';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} phút trước`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} giờ trước`;
  return `${Math.floor(delta / 86_400_000)} ngày trước`;
}
