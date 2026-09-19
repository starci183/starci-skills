import fs from 'node:fs';
import path from 'node:path';

export function stableStringify(value) {
  return `${JSON.stringify(sortKeys(value))}\n`;
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) out[key] = sortKeys(value[key]);
    return out;
  }
  return value;
}

export function assertInside(base, candidate) {
  const relative = path.relative(base, candidate);
  if (relative === '') return;
  if (path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`)) {
    throw Error(`Path escapes knowledge root: ${candidate}`);
  }
}

export function assertSafeRelative(relative, label = 'path') {
  if (typeof relative !== 'string' || !relative.trim()) throw Error(`Invalid ${label}`);
  const normalized = relative.replaceAll('\\', '/');
  if (path.isAbsolute(normalized) || normalized.split('/').includes('..') || normalized.startsWith('/')) {
    throw Error(`Unsafe ${label}: ${relative}`);
  }
  return normalized;
}

export function readRealFile(file, root) {
  if (fs.lstatSync(file).isSymbolicLink()) throw Error(`Symlinks are not accepted: ${file}`);
  const real = fs.realpathSync(file);
  assertInside(root, real);
  if (fs.lstatSync(real).isSymbolicLink()) throw Error(`Symlinks are not accepted: ${file}`);
  return { real, bytes: fs.readFileSync(real) };
}

export function walkFiles(dir, { root, extensions }) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  if (fs.lstatSync(dir).isSymbolicLink()) throw Error(`Symlinks are not accepted: ${dir}`);
  const visit = current => {
    const entries = fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const file = path.join(current, entry.name);
      if (entry.isSymbolicLink()) throw Error(`Symlinks are not accepted: ${file}`);
      if (entry.isDirectory()) visit(file);
      else if (extensions.some(ext => entry.name.endsWith(ext))) {
        const real = fs.realpathSync(file);
        assertInside(root, real);
        out.push(real);
      }
    }
  };
  visit(dir);
  return out.sort((a, b) => a.localeCompare(b));
}

/** Map authored basename to public JSON basename (`index.yaml` → `INDEX.json`). */
export function publicJsonName(sourceBase) {
  const lower = sourceBase.toLowerCase();
  if (lower === 'index.yaml' || lower === 'index.json') return 'INDEX.json';
  if (lower.endsWith('.yaml')) return `${sourceBase.slice(0, -5)}.json`;
  if (lower.endsWith('.json')) return sourceBase;
  throw Error(`Unsupported knowledge source name: ${sourceBase}`);
}

export function outputRelativeFromSource(knowledgeRoot, sourceFile) {
  const relative = path.relative(knowledgeRoot, sourceFile).replaceAll('\\', '/');
  const dir = path.posix.dirname(relative);
  const base = path.posix.basename(relative);
  const jsonName = publicJsonName(base);
  const joined = dir === '.' ? jsonName : `${dir}/${jsonName}`;
  return `knowledge/${joined}`;
}

export function stemKey(knowledgeRoot, sourceFile) {
  const relative = path.relative(knowledgeRoot, sourceFile).replaceAll('\\', '/');
  const dir = path.posix.dirname(relative);
  const base = path.posix.basename(relative);
  const lower = base.toLowerCase();
  let stem;
  if (lower === 'index.yaml' || lower === 'index.json') stem = 'INDEX';
  else if (lower.endsWith('.yaml')) stem = base.slice(0, -5);
  else if (lower.endsWith('.json')) stem = base.slice(0, -5);
  else stem = base;
  return dir === '.' ? stem : `${dir}/${stem}`;
}
