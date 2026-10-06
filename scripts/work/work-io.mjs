// work-io.mjs — the file, record and argv helpers the scripts/work tools and the work checks share.
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { list } from '../lib/list.mjs';
import { renameOver } from '../api/fs/rename-over.mjs';
import { underWorktrees } from '../lib/worktree-exclude.mjs';
import { valueAfter } from '../lib/cli-arg.mjs';
export { slash } from '../lib/path-key.mjs';

/** How many directories below its start a record walk descends (features/<f>/ui/<r> is 3). */
export const RECORD_DEPTH = 12;
/** Directories a record walk never enters: a record's own files and the kernel's evidence hold no records. */
const RECORD_SKIP = Object.freeze(['node_modules', 'assets', 'evidence', 'runs', '_derived', 'kernel-evidence', 'kernel-strays', 'kernel-approvals']);
/** The share of a keyed #FF00FF rectangle that must be key-coloured for it to count as a slot. */
export const SLOT_FILL_MIN = 0.98;

export { list };
export { sha256 as sha256Of, sha256File } from '../../engine/digest.mjs';
export { isFile, isDir } from '../lib/fs-kind.mjs';
/** A record state label folded for comparison ('default' when absent). */
export const stateKey = (s) => String(s ?? 'default').trim().toLowerCase();
/** A YAML file's document; throws when the file is unreadable or does not parse. */
export const readYaml = (file) => parseYaml(fs.readFileSync(file, 'utf8'));
/** A YAML file's document, or null when it is unreadable or does not parse. */
export const readYamlOrNull = (file) => { try { return readYaml(file); } catch { return null; } };
/** The value after `name` in argv, or null when `name` is absent or last. */
export const flag = (args, name) => valueAfter(args, name);
/** Every value after an occurrence of `name` in argv. */
export const flags = (args, name) => args.flatMap((a, i) => (a === name && i + 1 < args.length ? [args[i + 1]] : []));

/** A record's assets, record.assets before ui.assets, one per path. */
export function assetsOf(record) {
  const byPath = new Map();
  for (const a of [...list(record?.assets), ...list(record?.ui?.assets)]) if (typeof a?.path === 'string' && !byPath.has(a.path)) byPath.set(a.path, a);
  return [...byPath.values()];
}

/** A `ui.<id>:<path>` image reference: {id, path}, or null for any other reference. */
export function parseUiRef(ref) {
  const m = /^(ui\.[^:]+):(.+)$/.exec(String(ref ?? ''));
  return m ? { id: m[1], path: m[2] } : null;
}

/** The Work root enclosing `dir`: the nearest `.starciwork`, or the nearest directory with a workspace.yaml; null when none. */
export function workRootOf(dir) {
  for (let at = path.resolve(dir), prev = null; ; prev = at, at = path.dirname(at)) {
    // A product worktree lives at <repo>/.starciwork/worktrees/<wf>/<op> (DESIGN §16.7): the `.starciwork` holding the
    // worktrees container is never the Work root of a path inside one of them.
    if (path.basename(at) === '.starciwork' && prev && path.basename(prev) === 'worktrees') return null;
    if (path.basename(at) === '.starciwork' || fs.existsSync(path.join(at, 'workspace.yaml'))) return at;
    if (path.dirname(at) === at) return null;
  }
}

/** Every index.yaml under `root` (itself included), at most RECORD_DEPTH directories down, never inside RECORD_SKIP. */
export function indexFilesUnder(root) {
  const out = [];
  const walk = (dir, depth) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (depth < RECORD_DEPTH && !RECORD_SKIP.includes(e.name) && !underWorktrees(root, full)) walk(full, depth + 1); }
      else if (e.name === 'index.yaml') out.push(full);
    }
  };
  walk(root, 0);
  return out;
}

/**
 * Replace a record file whole: the text is written beside it and renamed over it, so a reader or a crash never
 * sees half a record. A rename Windows refuses while a reader holds the file is retried; nothing is written in place.
 */
export function writeRecordFile(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, text);
  renameOver(tmp, file);
}

/**
 * The `<status|question|apply>` main the owner-review tools share (draw-review.mjs, brand-direction.mjs): the command
 * is argv[0], the subject is `targetFlag`'s value (`--ui`, `--work`), `apply` runs with `--receipt`/`--write`.
 * `status`/`question`/`apply` return the handler's answer - {exitCode, text} to refuse, else {result, text} (text
 * carries its trailing newline): status and apply print `result` as JSON under --json, else the human text;
 * question's answer is always the JSON question. `tag` is the error prefix.
 */
export function reviewMain(argv, { targetFlag, usage, tag, status, question, apply }) {
  const [command, ...args] = argv;
  const json = args.includes('--json');
  const target = flag(args, targetFlag);
  if (!['status', 'question', 'apply'].includes(command) || !target) return { exitCode: 2, text: usage };
  try {
    if (command === 'status') {
      const s = status(target, args);
      return 'exitCode' in s ? s : { exitCode: 0, text: json ? `${JSON.stringify(s.result, null, 2)}\n` : s.text };
    }
    if (command === 'question') {
      const q = question(target, args);
      return 'exitCode' in q ? q : { exitCode: 0, text: `${JSON.stringify(q.result, null, 2)}\n` };
    }
    const receipt = flag(args, '--receipt');
    if (!receipt) return { exitCode: 2, text: usage };
    const r = apply(target, receipt, args);
    return 'exitCode' in r ? r : { exitCode: 0, text: json ? `${JSON.stringify(r.result, null, 2)}\n` : r.text };
  } catch (error) {
    return { exitCode: 1, text: `${tag}: ${error.message}\n` };
  }
}
