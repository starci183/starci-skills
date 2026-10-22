import type { AttemptDetailV2 } from '../../contract';
import type { Status } from '../status';

/** Maps a workflow land receipt to the status chip it is shown with; a missing or unrecognised receipt stays `unknown`. */
export const workflowLandStatus = (land: AttemptDetailV2['land']): Status => {
  if (!land) return 'unknown';
  if (land.result === 'landed') return 'success';
  if (['failed', 'conflict', 'red'].includes(land.result)) return 'failed';
  if (['busy', 'main-moving'].includes(land.result)) return 'retry';
  if (land.result === 'queued') return 'queued';
  return 'unknown';
};
