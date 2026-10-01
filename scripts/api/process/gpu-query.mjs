// gpu-query.mjs — `nvidia-smi --query-gpu=<fields> --format=csv,noheader,nounits`, run WITHOUT blocking the calling
// thread: one CSV line per NVIDIA GPU of the host (the harness UI's host view). A host without the tool answers null.
import { execFile } from 'node:child_process';

/** Promise<string | null>: the CSV text for `fields` (e.g. ['name', 'temperature.gpu']), or null. */
export const gpuQuery = (fields, timeout = 3000) => new Promise((resolve) => {
  try {
    execFile('nvidia-smi', [`--query-gpu=${fields.join(',')}`, '--format=csv,noheader,nounits'], { timeout, windowsHide: true, maxBuffer: 1 << 20 },
      (error, stdout) => resolve(error ? null : String(stdout)));
  } catch { resolve(null); }
});
