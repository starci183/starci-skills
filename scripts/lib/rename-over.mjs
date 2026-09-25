// rename-over.mjs — replacing a file whole through a temp file beside it.
import fs from 'node:fs';
import { sleepSync } from './sleep-sync.mjs';

/** The rename errors Windows returns while another process holds the target open. */
export const RENAME_BUSY = Object.freeze(['EPERM', 'EBUSY', 'EACCES']);

/**
 * Rename `tmp` over `file`. A busy refusal (RENAME_BUSY) is retried up to `retries` times, `delayMs(attempt)`
 * apart. When the rename fails for good, `tmp` is removed and the last error is thrown.
 */
export function renameOver(tmp, file, { retries = 20, delayMs = () => 25, sleep = sleepSync } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try { fs.renameSync(tmp, file); return; } catch (error) {
      if (attempt >= retries || !RENAME_BUSY.includes(error?.code)) {
        try { fs.rmSync(tmp, { force: true }); } catch { /* best effort */ }
        throw error;
      }
      sleep(delayMs(attempt));
    }
  }
}
