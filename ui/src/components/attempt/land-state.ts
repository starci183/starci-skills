import type { AttemptDetailV2 } from '../../contract';
import type { Status } from '../status';

export function workflowLandStatus(land: AttemptDetailV2['land']): Status {
  if (!land) return 'unknown';
  if (land.result === 'landed') return 'success';
  if (['failed', 'conflict', 'red'].includes(land.result)) return 'failed';
  if (['busy', 'main-moving'].includes(land.result)) return 'retry';
  return land.result === 'queued' ? 'queued' : 'unknown';
}
