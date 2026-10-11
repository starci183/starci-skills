// npm-install-failure.mjs - what an npm ci failure says about its cause, and who holds the tree.
//
// On Windows a loaded native module (a .node file of a running dev server, watcher or compiler) cannot be unlinked, so
// `npm ci` stops with EPERM or EBUSY at the first such file. That is a file lock, not a broken install: retrying it while the
// holder runs repeats the same failure. The failure names the locked path and, where the process table can be read, the
// processes that hold it: whose command line is inside it, or whose working directory, mapped file or loaded module is.
import path from 'node:path';
import { treeHolds } from '../api/process/tree-holds.mjs';
import { isBusyError } from '../api/fs/is-busy-error.mjs';
import { processList } from '../api/process/process-list.mjs';
import { isSpecRun } from '../lib/env.mjs';
import { foldCase, slash } from '../lib/path-key.mjs';

const NPM_FIELD = /^npm error (code|syscall|path) (.+)$/gm;

/** The cause npm's stderr names: {cause: 'file-locked' | 'other', code, syscall, path}. Pure. */
export function installFailureOf(stderr) {
  const fields = {};
  for (const [, key, value] of String(stderr ?? '').matchAll(NPM_FIELD)) fields[key] ??= value.trim();
  const locked = isBusyError(fields.code);
  return { cause: locked ? 'file-locked' : 'other', code: fields.code ?? null, syscall: fields.syscall ?? null, path: fields.path ?? null };
}

/** Whether a process command line names `tree` or a path inside it, on either slash style and any drive-letter case; a sibling tree whose name starts the same does not count. Pure. */
export function insideTree(commandLine, tree) {
  const key = foldCase(slash(path.resolve(tree)));
  const text = foldCase(slash(commandLine));
  for (let at = text.indexOf(key); at >= 0; at = text.indexOf(key, at + 1)) {
    if (!/[\w.-]/.test(text[at + key.length] ?? '')) return true;
  }
  return false;
}

/**
 * The processes that hold the tree: [{pid, name, commandLine, via}], or null when the table is unreadable (a spec run never reads the host's).
 * A process is named by its command line when that is inside the tree ('command line'), and by what the platform shows of a relative command
 * line otherwise (treeHolds: its working directory or a mapped file on Linux, a loaded module on Windows). The platform read is the slow one:
 * the caller asks for holders only after a file lock failed. The caller's own process is left out.
 */
export function treeHolders(tree, { list = processList, env = process.env, self = process.pid, holds = treeHolds } = {}) {
  if (isSpecRun(env) && list === processList) return null;
  const rows = list({ cmdMax: 1000 });
  if (!rows) return null;
  const others = rows.filter((p) => p.pid !== self);
  const named = new Map(others.filter((p) => insideTree(p.cmd, tree)).map((p) => [p.pid, 'command line']));
  for (const hold of holds(tree, { pids: others.map((p) => p.pid) }) ?? []) if (hold.pid !== self && !named.has(hold.pid)) named.set(hold.pid, hold.via);
  return others.filter((p) => named.has(p.pid)).map((p) => ({ pid: p.pid, name: String(p.name ?? ''), commandLine: p.cmd, via: named.get(p.pid) }));
}
