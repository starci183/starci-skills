// process-names.mjs — the running process image names: `tasklist /fo csv /nh` on Windows, `ps -eo comm=` elsewhere, each run
// from its fixed system location.
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { systemTool } from './system-tool.mjs';

/** [image name] of every running process, or null when the probe fails (or the host lacks the tool). */
export async function processNames({ platform = process.platform, spawn = spawnSync, tool = (name) => systemTool(name, { platform }) } = {}) {
  if (platform === 'win32') {
    const tasklist = tool('tasklist');
    if (!tasklist.ok) return null;
    const r = spawn(tasklist.path, ['/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
    if (r.error || r.status !== 0) return null;
    return String(r.stdout ?? '').split(/\r?\n/).map((line) => /^"([^"]+)"/.exec(line.trim())?.[1]).filter(Boolean);
  }
  const ps = tool('ps');
  if (!ps.ok) return null;
  const r = spawn(ps.path, ['-eo', 'comm='], { encoding: 'utf8', timeout: 15000 });
  if (r.error || r.status !== 0) return null;
  return String(r.stdout ?? '').split(/\r?\n/).map((line) => path.basename(line.trim())).filter(Boolean);
}
