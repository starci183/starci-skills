// One registry of stop codes from two homes: errors/errors.json (codes shared by several operators,
// each with a `scope` list or ["*"]) and operators/<id>/errors.json (codes only that operator emits,
// scope implicit). Merging here is what lets a code live next to its only operator without the
// validators, the generator, or the runtime having to know where it came from. A code defined in
// two places is refused: the fix is to move it to errors/errors.json with both ids in scope.
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export const DISPOSITIONS = new Set(['terminate', 'fallback']);
export const DOMAINS = new Set(['self', 'architecture', 'business', 'backend', 'frontend', 'platform', 'workspace', 'caller']);

export async function loadErrorsRegistry(root) {
  const errors = [];
  const codes = {};
  const define = (id, entry, scope, home) => {
    if (codes[id]) { errors.push(`${home}: ${id} is already defined in ${codes[id].home}; a code two operators emit belongs in errors/errors.json with both ids in scope`); return; }
    if (!/^[A-Z][A-Z0-9_]+$/.test(id)) errors.push(`${home}: code ${id} must be UPPER_SNAKE`);
    if (!DISPOSITIONS.has(entry.disposition)) errors.push(`${home}: ${id} disposition must be terminate or fallback`);
    if (!DOMAINS.has(entry.domain)) errors.push(`${home}: ${id} domain ${entry.domain} is not a routing domain`);
    for (const key of ['meaning', 'resume']) if (!entry[key]?.en || !entry[key]?.vi) errors.push(`${home}: ${id} needs ${key}.en and ${key}.vi`);
    if (entry.disposition === 'fallback' && (!entry.fallback?.en || !entry.fallback?.vi)) errors.push(`${home}: ${id} is a fallback and needs fallback.en and fallback.vi`);
    if (entry.disposition === 'terminate' && entry.fallback) errors.push(`${home}: ${id} terminates and may not carry a fallback`);
    if (entry.unless) {
      const u = entry.unless;
      if (typeof u.param !== 'string' || u.equals === undefined || !DISPOSITIONS.has(u.then)) errors.push(`${home}: ${id} unless needs param, equals, then`);
      if (u.then === entry.disposition) errors.push(`${home}: ${id} unless.then equals its own disposition`);
    }
    codes[id] = { ...entry, scope, home };
  };
  const sharedPath = path.join(root, 'errors', 'errors.json');
  const shared = JSON.parse(await readFile(sharedPath, 'utf8'));
  if (shared.schemaVersion !== 9) errors.push('errors/errors.json: schemaVersion must be 9');
  for (const [id, entry] of Object.entries(shared.codes ?? {})) {
    if (!Array.isArray(entry.scope) || entry.scope.length === 0) { errors.push(`errors/errors.json: ${id} needs a scope list`); continue; }
    if (entry.scope.length === 1 && entry.scope[0] !== '*') errors.push(`errors/errors.json: ${id} is scoped to one operator ${entry.scope[0]}; move it to operators/<id>/errors.json`);
    define(id, entry, entry.scope, 'errors/errors.json');
  }
  const opsDir = path.join(root, 'operators');
  const operatorIds = new Set();
  for (const e of await readdir(opsDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const manifest = JSON.parse(await readFile(path.join(opsDir, e.name, 'operator.json'), 'utf8'));
    operatorIds.add(manifest.id);
    const local = path.join(opsDir, e.name, 'errors.json');
    if (!existsSync(local)) continue;
    const rel = `operators/${e.name}/errors.json`;
    const doc = JSON.parse(await readFile(local, 'utf8'));
    if (doc.schemaVersion !== 9) errors.push(`${rel}: schemaVersion must be 9`);
    for (const [id, entry] of Object.entries(doc.codes ?? {})) {
      if (entry.scope !== undefined) errors.push(`${rel}: ${id} must not carry scope; the file's operator is its scope`);
      define(id, entry, [manifest.id], rel);
    }
  }
  for (const [id, c] of Object.entries(codes)) for (const s of c.scope) if (s !== '*' && !operatorIds.has(s)) errors.push(`${c.home}: ${id} scope names ${s}, which is not an operator`);
  const allowed = (id, operatorId) => { const c = codes[id]; return Boolean(c) && (c.scope.includes('*') || c.scope.includes(operatorId)); };
  return { codes, errors, allowed, operatorIds };
}
