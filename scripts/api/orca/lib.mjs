// scripts/api/orca/lib.mjs — shared mechanics for every Orca API wrapper.
// One place owns: binary resolution (orca.cmd cannot spawn on Windows without
// a shell), STARCI_ORCA_COMMAND/STARCI_ORCA_ARGS overrides, receipt parsing,
// terminal frame extraction and the synchronous sleep. Callers get normalized
// {status, error, stdout, stderr} — never a raw SpawnResult.
import { spawnSync } from 'node:child_process';

export const ORCA = (() => {
  if (process.env.STARCI_ORCA_COMMAND) return process.env.STARCI_ORCA_COMMAND;
  if (process.platform !== 'win32') return 'orca';
  const w = spawnSync('where.exe', ['orca'], { encoding: 'utf8' });
  const exe = (w.stdout || '').split(/\r?\n/).find((l) => l.trim().endsWith('.exe'));
  return exe ? exe.trim() : 'orca.exe';
})();

export const ORCA_PREFIX_ARGS = (() => {
  try { return JSON.parse(process.env.STARCI_ORCA_ARGS || '[]'); } catch { return []; }
})();

export function orcaRun(args, { timeout = 120000 } = {}) {
  const r = spawnSync(ORCA, [...ORCA_PREFIX_ARGS, ...args], { encoding: 'utf8', timeout, windowsHide: true });
  return { status: r.status, error: r.error?.message, stdout: r.stdout?.trim(), stderr: r.stderr?.trim() };
}

export const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
export const jsonOf = (text) => { try { return JSON.parse(text || 'null'); } catch { return null; } };
export const terminalOf = (receipt) => jsonOf(receipt?.stdout)?.result?.terminal ?? null;

export function frameText(terminal) {
  if (!terminal) return '';
  if (typeof terminal.screen === 'string') return terminal.screen;
  if (Array.isArray(terminal.tail)) return terminal.tail.join('\n');
  if (typeof terminal.tail === 'string') return terminal.tail;
  return terminal.preview ?? '';
}

// --name value CLI arg reader shared by the thin wrappers.
export const arg = (argv, name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
export const flag = (argv, name) => argv.includes(`--${name}`);
