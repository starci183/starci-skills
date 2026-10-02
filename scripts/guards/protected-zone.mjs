// protected-zone.mjs - the reader of modules/kernel/protected-zone.yaml, the ONE declaration of the protected zone
// (rule R224 RIGHTS_PROTECTED_ZONE), and the question the command guard asks of it: is this path inside a runtime checkout,
// and does it fall in a zone or on a protected catalog entry?
//
// A runtime checkout is found by rights.mjs runtimeRootOf (any directory tree holding knowledge/hfs/runtime-slots.yaml: the live
// .claude, a lane worktree of it, a staging checkout), so every worktree of the runtime is judged by the same declaration
// without asking git. Pure fs and one YAML read, loaded only when a role that can be
// refused writes a file (the guard's common path never loads it).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { globExpression } from '../lib/glob.mjs';
import { pathKey, posixPath } from '../lib/path-key.mjs';
import { runtimeRootOf } from './rights.mjs';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PROTECTED_ZONE_FILE = 'modules/kernel/protected-zone.yaml';

const cache = new Map();

/** {zones: [{id, why, matchers}], catalog: [{file, ids, codes}]} parsed from the declaration of `root`, or an empty zone when unreadable. */
export function loadProtectedZone({ root = SKILL_ROOT, read = (file) => fs.readFileSync(file, 'utf8') } = {}) {
  const key = pathKey(root);
  if (cache.has(key)) return cache.get(key);
  let parsed = null;
  try { parsed = parseYaml(read(path.join(root, PROTECTED_ZONE_FILE))); } catch { parsed = null; }
  const zone = {
    zones: (parsed?.zones ?? []).map((z) => ({ id: String(z.id), why: String(z.why ?? ''), matchers: (z.paths ?? []).map((p) => globExpression(String(p))) })),
    catalog: (parsed?.catalogEntries ?? []).map((c) => ({ file: posixPath(String(c.file)), ids: (c.ids ?? []).map(String), codes: (c.codes ?? []).map(String) })),
  };
  cache.set(key, zone);
  return zone;
}

/**
 * Where `file` stands against the zone: {runtimeRoot, rel, zone: {id, why} | null, catalog: entry | null}. runtimeRoot is
 * null when the path is outside every runtime checkout (then nothing here applies).
 */
export function zoneOfPath(file, { declaration = loadProtectedZone(), exists = fs.existsSync } = {}) {
  const runtimeRoot = runtimeRootOf(file, { exists });
  if (!runtimeRoot) return { runtimeRoot: null, rel: null, zone: null, catalog: null };
  const rel = posixPath(path.relative(runtimeRoot, path.resolve(file)));
  const zone = declaration.zones.find((z) => z.matchers.some((m) => m.test(rel))) ?? null;
  const catalog = declaration.catalog.find((c) => c.file === rel) ?? null;
  return { runtimeRoot, rel, zone: zone ? { id: zone.id, why: zone.why } : null, catalog };
}

/** The ids or codes of a catalog entry that `text` names (a rule id as a whole token, a code as a substring), or []. */
export function catalogNames(entry, text) {
  const body = String(text ?? '');
  const hits = [];
  for (const id of entry.ids) if (new RegExp(`(?:^|[^A-Za-z0-9])${id}(?![0-9])`).test(body)) hits.push(id);
  for (const code of entry.codes) if (body.includes(code)) hits.push(code);
  return hits;
}
