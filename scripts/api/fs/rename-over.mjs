// rename-over.mjs — replacing a file whole through a temp file beside it.
import fs from 'node:fs';
import { sleepSync } from '../../lib/sleep-sync.mjs';
import { FS_BUSY } from './lib.mjs';

/**
 * Rename `tmp` over `file`. A busy refusal (FS_BUSY of lib.mjs) is retried up to `retries` times, `delayMs(attempt)`
 * apart. When the rename fails for good, `tmp` is removed and the last error is thrown. `rename` is the seam
 * a spec injects (default fs.renameSync).
 */
export function renameOver(tmp, file, { retries = 20, delayMs = () => 25, sleep = sleepSync, rename = fs.renameSync } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try { rename(tmp, file); return; } catch (error) {
      if (attempt >= retries || !FS_BUSY.includes(error?.code)) {
        try { fs.rmSync(tmp, { force: true }); } catch { /* best effort */ }
        throw error;
      }
      sleep(delayMs(attempt));
    }
  }
}
