import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../core/yaml.mjs';
import { compactJsonBuffer } from './emit.mjs';
import {
  assertSafeRelative,
  outputRelative,
  readRealFile,
  stemKey,
  walkFiles
} from './paths.mjs';

/**
 * YAML declarative collection. Reject dual authority and unapproved JSON inputs.
 * Knowledge is never collected here (compile-knowledge owns that tree).
 */
export function collectDeclarativeTree(skillRoot, {
  dir,
  outPrefix,
  recursive = true,
  excludeNames = new Set(),
  excludeRelative = new Set(),
  allowJsonFallback = false
} = {}) {
  const abs = path.join(skillRoot, dir);
  const files = new Map();
  if (!fs.existsSync(abs)) return files;
  if (fs.lstatSync(abs).isSymbolicLink()) throw Error(`${dir} cannot be a symlink`);

  const fileFilter = (_file, name) => {
    if (excludeNames.has(name)) return false;
    return name.endsWith('.yaml') || name.endsWith('.yml') || name.endsWith('.json');
  };

  const found = recursive
    ? walkFiles(abs, { root: abs, extensions: ['.yaml', '.yml', '.json'], fileFilter })
    : fs.readdirSync(abs, { withFileTypes: true })
      .filter(e => e.isFile() && fileFilter(null, e.name) && !e.isSymbolicLink())
      .map(e => {
        const file = path.join(abs, e.name);
        readRealFile(file, abs);
        return file;
      })
      .sort((a, b) => a.localeCompare(b));

  const byStem = new Map();
  for (const file of found) {
    const relative = path.relative(abs, file).replaceAll('\\', '/');
    if (excludeRelative.has(relative)) continue;
    const stem = stemKey(abs, file);
    const lower = path.posix.basename(relative).toLowerCase();
    const kind = lower.endsWith('.yaml') || lower.endsWith('.yml') ? 'yaml' : 'json';
    const prev = byStem.get(stem);
    if (!prev) {
      byStem.set(stem, { kind, file, relative });
      continue;
    }
    throw Error(`Duplicate declarative authority for ${dir}/${stem}`);
  }

  for (const stem of [...byStem.keys()].sort((a, b) => a.localeCompare(b))) {
    const entry = byStem.get(stem);
    if (entry.kind === 'json' && !allowJsonFallback) {
      throw Error(`Authored JSON is not accepted under ${dir}: ${entry.relative}; use YAML`);
    }
    const outRel = outputRelative(abs, entry.file, outPrefix);
    assertSafeRelative(outRel, 'dist path');
    if (files.has(outRel)) throw Error(`Output collision for ${outRel}`);
    const { bytes } = readRealFile(entry.file, abs);
    const value = entry.kind === 'yaml'
      ? parseYaml(bytes.toString('utf8'))
      : JSON.parse(bytes.toString('utf8'));
    files.set(outRel, compactJsonBuffer(value));
  }
  return files;
}

/** Load one declarative document by public stem (prefer YAML). */
export function loadDeclarative(skillRoot, relativeJsonPath) {
  const normalized = assertSafeRelative(relativeJsonPath, 'declarative path');
  if (!normalized.endsWith('.json')) throw Error(`Expected .json public path: ${normalized}`);
  const stem = normalized.slice(0, -5);
  const dir = path.posix.dirname(stem);
  const base = path.posix.basename(stem);
  const candidates = [];
  const folder = dir === '.' ? skillRoot : path.join(skillRoot, dir);
  if (base === 'INDEX') {
    candidates.push(path.join(folder, 'index.yaml'), path.join(folder, 'index.yml'));
  } else {
    candidates.push(
      path.join(folder, `${base}.yaml`),
      path.join(folder, `${base}.yml`)
    );
  }
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const { bytes } = readRealFile(file, skillRoot);
    const lower = path.basename(file).toLowerCase();
    if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return parseYaml(bytes.toString('utf8'));
    return JSON.parse(bytes.toString('utf8'));
  }
  throw Error(`Missing declarative source for ${normalized}`);
}
