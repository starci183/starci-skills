// tree-holds.mjs - which processes hold a directory tree open, by the signals the process table's command line does not carry.
//
// A server started with a relative command line (`next start -p 3919`) from inside a tree names the tree nowhere in its command line;
// the platform still knows it: on Linux the process's working directory and its mapped files (/proc/<pid>/cwd, /proc/<pid>/maps), on
// Windows the modules the process loaded (PowerShell Process.Modules), which is exactly what blocks `npm ci` from unlinking a native
// .node file. The Windows read walks every process's module list, so a caller asks for it only after a file lock failed, and it is bounded.
import fs from 'node:fs';
import { foldCase, slash, trimTrailingSlashes } from '../../lib/path-key.mjs';
import { runPowershell } from './run-powershell.mjs';

const quote = (text) => `'${String(text).replaceAll("'", "''")}'`;
const WINDOWS_SCAN_MS = 45_000;

const underTree = (file, key) => {
  const text = foldCase(slash(file));
  return text === key || text.startsWith(`${key}/`);
};

// The mapped file of a /proc/<pid>/maps line is the text after the sixth column.
const mappedPaths = (maps) => String(maps ?? '').split('\n').map((line) => line.split(/\s+/).slice(5).join(' ')).filter((file) => file.startsWith('/'));

function linuxHolds(key, pids, { readlink, readFile }) {
  const found = [];
  for (const pid of pids) {
    let via = null;
    try { if (underTree(readlink(`/proc/${pid}/cwd`), key)) via = 'working directory'; } catch { /* another user's process or gone */ }
    if (!via) {
      try { if (mappedPaths(readFile(`/proc/${pid}/maps`, 'utf8')).some((file) => underTree(file, key))) via = 'mapped file'; } catch { /* unreadable */ }
    }
    if (via) found.push({ pid, via });
  }
  return found;
}

function windowsHolds(tree, run, timeoutMs) {
  const script = [`$tree = ${quote(tree)}`, 'Get-Process | ForEach-Object {',
    '  $p = $_; try { foreach ($m in $p.Modules) { if ($m.FileName.StartsWith($tree, [StringComparison]::OrdinalIgnoreCase)) { [pscustomobject]@{ pid = [int]$p.Id; file = [string]$m.FileName }; break } } } catch { }',
    '} | ConvertTo-Json -Compress'].join('\n');
  const r = run(script, { timeout: timeoutMs });
  if (!r || r.error || r.status !== 0) return null;
  const text = String(r.stdout ?? '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return (Array.isArray(parsed) ? parsed : [parsed]).map((row) => ({ pid: Number(row.pid), via: `loaded module ${row.file}` }));
  } catch { return null; }
}

/**
 * The processes that hold `tree` open: [{pid, via}], or null when the platform read failed. `pids` are the candidates on Linux (the
 * table's pids); Windows scans the loaded modules of every process. Seams: platform, run (PowerShell), readlink, readFile.
 */
export function treeHolds(tree, { pids = [], platform = process.platform, run = runPowershell, readlink = fs.readlinkSync, readFile = fs.readFileSync, timeoutMs = WINDOWS_SCAN_MS } = {}) {
  if (platform === 'win32') return windowsHolds(tree, run, timeoutMs);
  if (platform === 'linux') return linuxHolds(trimTrailingSlashes(foldCase(slash(tree))), pids, { readlink, readFile });
  return null;
}
