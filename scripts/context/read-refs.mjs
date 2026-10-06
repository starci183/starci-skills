// Concrete READ roots and file expansion for the context owner. Template/prose
// references remain explicit; missing Source inputs and bounded expansions refuse execution.
import fs from 'node:fs';
import path from 'node:path';
import { byCodeUnit } from '../lib/list.mjs';
import { sha256 } from '../../engine/digest.mjs';
import { braceVariants, globExpression } from '../lib/glob.mjs';
import { bindOpPath } from '../lib/op-shared.mjs';
import { insidePath } from '../lib/path-key.mjs';
import { lines } from '../lib/verb-call.mjs';
import { READ_SEPARATOR } from '../lib/filed-reads.mjs';

const SKIP = new Set(['node_modules', '.git', '.next', 'dist']);
const INSPECTION_LIMIT = 10000;
const MATCH_LIMIT = 500;

/** Name the exact params.* instance READ; it is an attempt value rather than a filesystem path. */
export const readParamName=token=>/^params\.([A-Za-z][A-Za-z0-9]*)$/.exec(token)?.[1]??null;

/** Split declared references while preserving brace alternation; a trailing field
 * selector annotates its leading concrete path rather than becoming another file. */
export function declaredReadTokens(raw) {
  return lines(raw, { separator: READ_SEPARATOR });
}

/** Refuse a hit whose path chain crosses a symlink or escapes `root`. */
const safeReadPath = (root, file) => {
  let at = root;
  for (const segment of path.relative(root, file).split(path.sep).filter(Boolean)) {
    at = path.join(at, segment);
    if (fs.lstatSync(at).isSymbolicLink()) throw Object.assign(new Error('linked READ path'), { code: 'READ_LINKED' });
  }
  if (!insidePath(fs.realpathSync(root), fs.realpathSync(file), { includeSelf: true })) throw Object.assign(new Error('READ root escape'), { code: 'READ_ROOT_ESCAPE' });
};

const addHit = (state, file) => {
  safeReadPath(state.root, file);
  if (!fs.lstatSync(file).isFile()) return;
  if (state.hits.size >= MATCH_LIMIT && !state.hits.has(file)) { state.truncated = true; return; }
  state.hits.add(file);
};

const visitDir = (state, dir, regex) => {
  if (state.truncated) return;
  safeReadPath(state.root, dir);
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (++state.visited > INSPECTION_LIMIT) { state.truncated = true; return; }
    const file = path.join(dir, entry.name);
    if (entry.isDirectory() && !SKIP.has(entry.name)) visitDir(state, file, regex);
    else if (entry.isFile() && regex.test(path.relative(state.root, file).replaceAll('\\', '/'))) addHit(state, file);
    if (state.truncated) return;
  }
};

/** Expand one concrete pattern list under `state.root` into absolute file hits; returns true on an escaping pattern. */
const expandPatterns = (patterns, state, missing) => {
  const { root } = state;
  for (const pattern of patterns) {
    if (!insidePath(root, path.resolve(root, pattern), { includeSelf: true })) return true;
    if (/[*?]/.test(pattern)) {
      const prefix = pattern.slice(0, pattern.search(/[*?]/)).replace(/\/[^/]*$/, '');
      const base = path.resolve(root, prefix);
      if (fs.existsSync(base)) visitDir(state, base, globExpression(pattern));
    } else {
      const file = path.resolve(root, pattern);
      if (fs.existsSync(file)) { if (fs.lstatSync(file).isDirectory()) visitDir(state, file, globExpression(`${pattern.replace(/\/$/, '')}/**`)); else addHit(state, file); }
    }
    const matches = /[*?]/.test(pattern) ? globExpression(pattern) : globExpression(`${pattern.replace(/\/$/, '')}/**`);
    if (![...state.hits].some((file) => file === path.resolve(root, pattern) || matches.test(path.relative(root, file).replaceAll('\\', '/')))) missing.push(pattern);
  }
  return false;
};

/** Resolve one READ reference with an explicit Source, Work or app root. Values
 * of params.* are instance inputs, not runtime filenames. New record templates
 * may remain unresolved; they are never reported as missing Source law files. */
export function resolveReadReference(token, { sourceRoot, stateDir = null, appRoot = null, params = {} } = {}) {
  const original = token;
  let rel = token.replaceAll('\\', '/');
  if (readParamName(rel) !== null) return { token: original, kind: 'instance', resolved: [], missing: [], truncated: false };
  const first = rel.split(/\s/)[0];
  if (/^(?:knowledge|docs|modules|scripts|engine|\.starciwork|\.starcistacks)\//.test(first)) rel = first;
  else if (/\s/.test(rel)) return { token: original, kind: 'prose', resolved: [], missing: [], truncated: false };
  let rootKind = 'source', root = sourceRoot;
  if (rel.startsWith('<app>/')) { rootKind = 'app'; root = appRoot; rel = rel.slice(6); }
  else if (/^\.starcistacks(?:\/|$)/.test(rel)) { rootKind = 'app'; root = appRoot; }
  else if (/^\.starciwork(?:\/|$)/.test(rel)) { rootKind = 'work'; root = stateDir; rel = rel.replace(/^\.starciwork\/?/, ''); }
  if (/^(?:N|evidence|STARCI_JOB_SCRATCH)\//.test(rel)) return { token: original, kind: 'instance', resolved: [], missing: [], truncated: false };
  rel = bindOpPath(rel, params);
  if (rel.includes('<') || !root) return { token: original, kind: 'template', rootKind, resolved: [], missing: rootKind === 'source' ? [original] : [], truncated: false };
  root = path.resolve(root);
  if (!insidePath(root, path.resolve(root, rel), { includeSelf: true })) return { token: original, kind: 'invalid', rootKind, resolved: [], missing: [original], truncated: false };
  const patterns = braceVariants(rel), missing = [];
  const expansion = { root, hits: new Set(), visited: 0, truncated: false };
  try {
    if (expandPatterns(patterns, expansion, missing)) return { token: original, kind: 'invalid', rootKind, resolved: [], missing: [original], truncated: false };
    const resolved = [...expansion.hits].sort(byCodeUnit).map((absolute) => ({
      path: rootKind === 'work' ? `.starciwork/${path.relative(root, absolute).replaceAll('\\', '/')}` : path.relative(root, absolute).replaceAll('\\', '/'),
      absolute, rootKind, root, sha256: sha256(fs.readFileSync(absolute)),
    }));
    return { token: original, kind: /[*?{]/.test(rel) ? 'glob' : 'file', rootKind, resolved, missing, truncated: expansion.truncated };
  } catch (error) {
    return { token: original, kind: ['READ_LINKED', 'READ_ROOT_ESCAPE'].includes(error.code) ? 'invalid' : 'unreadable', rootKind, resolved: [], missing: [original], truncated: expansion.truncated, error: error.code ?? 'read-failed' };
  }
}
