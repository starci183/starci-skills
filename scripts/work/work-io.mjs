// work-io.mjs — the file, record and argv helpers the scripts/work tools and the work checks share.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';

/** How many directories below its start a record walk descends (features/<f>/ui/<r> is 3). */
export const RECORD_DEPTH = 12;
/** Directories a record walk never enters: a record's own files and the kernel's evidence hold no records. */
export const RECORD_SKIP = Object.freeze(['node_modules', 'assets', 'evidence', 'runs', '_derived', 'kernel-evidence', 'kernel-strays', 'kernel-approvals']);
/** The share of a keyed #FF00FF rectangle that must be key-coloured for it to count as a slot. */
export const SLOT_FILL_MIN = 0.98;

export const list = (v) => (Array.isArray(v) ? v : []);
export const slash = (p) => String(p).replace(/\\/g, '/');
export const sha256Of = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
export const sha256File = (file) => sha256Of(fs.readFileSync(file));
/** A YAML file's document; throws when the file is unreadable or does not parse. */
export const readYaml = (file) => parseYaml(fs.readFileSync(file, 'utf8'));
/** A YAML file's document, or null when it is unreadable or does not parse. */
export const readYamlOrNull = (file) => { try { return readYaml(file); } catch { return null; } };
/** The value after `name` in argv, or null when `name` is absent or last. */
export const flag = (args, name) => { const i = args.indexOf(name); return i >= 0 && i + 1 < args.length ? args[i + 1] : null; };
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
  const m = String(ref ?? '').match(/^(ui\.[^:]+):(.+)$/);
  return m ? { id: m[1], path: m[2] } : null;
}

/** The Work root enclosing `dir`: the nearest `.starciwork`, or the nearest directory with a workspace.yaml; null when none. */
export function workRootOf(dir) {
  for (let at = path.resolve(dir); ; at = path.dirname(at)) {
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
      if (e.isDirectory()) { if (depth < RECORD_DEPTH && !RECORD_SKIP.includes(e.name)) walk(full, depth + 1); }
      else if (e.name === 'index.yaml') out.push(full);
    }
  };
  walk(root, 0);
  return out;
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * Replace a record file whole: the text is written beside it and renamed over it, so a reader or a crash never
 * sees half a record. A rename Windows refuses while a reader holds the file is retried; nothing is written in place.
 */
export function writeRecordFile(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, text);
  for (let attempt = 0; ; attempt += 1) {
    try { fs.renameSync(tmp, file); return; } catch (error) {
      if (attempt >= 20 || !['EPERM', 'EBUSY', 'EACCES'].includes(error?.code)) {
        try { fs.rmSync(tmp, { force: true }); } catch { /* best effort */ }
        throw error;
      }
      sleep(25);
    }
  }
}
