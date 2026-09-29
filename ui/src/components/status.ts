import type { UiState } from '../contract';

/** Status vocabulary produced by ui/api/pipeline.mjs and used by every surface. */
export type Status = 'success' | 'running' | 'settling' | 'queued' | 'retry' | 'failed' | 'blocked' | 'awaiting-owner' | 'planned' | 'deferred' | 'external' | 'dropped' | 'rejected' | 'warning' | 'unknown';
/** Colour family. One tone = one token set in style.css ([data-tone=…]). */
export type Tone = 'success' | 'running' | 'queued' | 'failed' | 'warning' | 'skipped' | 'owner';

export const statusTone: Record<Status, Tone> = {
  success: 'success', running: 'running', settling: 'running', queued: 'queued', retry: 'warning',
  failed: 'failed', blocked: 'failed', 'awaiting-owner': 'owner', planned: 'queued', deferred: 'skipped', external: 'skipped', dropped: 'skipped', rejected: 'skipped', warning: 'warning', unknown: 'queued',
};

export const statusLabels: Record<Status, string> = {
  success: 'Đạt', running: 'Đang chạy', settling: 'Đang chốt', queued: 'Đang chờ', retry: 'Chờ thử lại',
  failed: 'Hỏng', blocked: 'Bị chặn', 'awaiting-owner': 'Chờ thầy trả lời', planned: 'Chưa tới', deferred: 'Hoãn', external: 'Ngoài workflow', dropped: 'Đã bỏ', rejected: 'Bị từ chối khi giao', warning: 'Cảnh báo', unknown: 'Chưa rõ',
};

/** Statuses that are "live" (animated dot). */
export const liveStatuses = new Set<Status>(['running', 'settling']);

export function statusFromUi(ui: UiState): Status {
  switch (ui) {
    case 'ok': case 'done': return 'success';
    case 'running': return 'running';
    case 'waiting': return 'queued';
    case 'warn': return 'warning';
    case 'bad': return 'failed';
    default: return 'unknown';
  }
}

/** A blocked verdict on an op that filed an ask (report outcome 'ask') waits on the owner; it is neither failed nor blocked. */
export function statusFromVerdict(verdict: string | null | undefined, open = false, reportOutcome?: string | null): Status {
  if (verdict === 'pass') return 'success';
  if (verdict === 'blocked') return reportOutcome === 'ask' ? 'awaiting-owner' : 'blocked';
  if (verdict === 'fail' || verdict === 'partial') return 'failed';
  if (verdict === 'dropped' || verdict === 'cancelled') return 'dropped';
  return open ? 'running' : 'unknown';
}

/** An Op's self-reported outcome (report) — shown separately from the verdict. */
export function statusFromOutcome(outcome: string | null | undefined): Status {
  if (outcome === 'done') return 'success';
  if (outcome === 'blocked') return 'blocked';
  if (outcome === 'failed') return 'failed';
  if (outcome === 'partial' || outcome === 'ask') return 'retry';
  return 'unknown';
}

export function statusFromCheck(status: string | null | undefined): Status {
  if (status === 'pass') return 'success';
  if (status === 'fail' || status === 'error') return 'failed';
  if (status === 'skipped') return 'deferred';
  if (status === 'unavailable') return 'retry';
  return 'unknown';
}

export function statusFromUnit(state: string): Status {
  switch (state) {
    case 'done': return 'success';
    case 'running': case 'reported': return 'running';
    case 'deciding': return 'settling';
    case 'failed': return 'failed';
    case 'dropped': return 'dropped';
    case 'planned': return 'planned';
    default: return 'queued';
  }
}

/** CSS custom property for a tone's ink colour, for SVG fills/strokes. */
export const toneVar = (tone: Tone, part: '' | '-bg' | '-line' = '') => `var(--status-${tone}${part})`;
