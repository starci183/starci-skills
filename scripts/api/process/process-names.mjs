// process-names.mjs — the running process image names: `tasklist /fo csv /nh` on Windows, `ps -eo comm=` elsewhere.
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/** [image name] of every running process, or null when the probe fails. */
export async function listProcessNames({ platform = process.platform } = {}) {
  if (platform === 'win32') {
    const r = spawnSync('tasklist', ['/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
    if (r.error || r.status !== 0) return null;
    return String(r.stdout ?? '').split(/\r?\n/).map((line) => /^"([^"]+)"/.exec(line.trim())?.[1]).filter(Boolean);
  }
  const r = spawnSync('ps', ['-eo', 'comm='], { encoding: 'utf8', timeout: 15000 });
  if (r.error || r.status !== 0) return null;
  return String(r.stdout ?? '').split(/\r?\n/).map((line) => path.basename(line.trim())).filter(Boolean);
}
