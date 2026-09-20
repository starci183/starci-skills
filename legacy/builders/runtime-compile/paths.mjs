import fs from 'node:fs';
import path from 'node:path';

export function assertInside(base, candidate) {
  const relative = path.relative(base, candidate);
  if (relative === '') return;
  if (path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`)) {
    throw Error(`Path escapes root: ${candidate}`);
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

/** Deterministic sorted walk; rejects symlink escapes. */
export function walkFiles(dir, { root, extensions, fileFilter } = {}) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  if (fs.lstatSync(dir).isSymbolicLink()) throw Error(`Symlinks are not accepted: ${dir}`);
  const visit = current => {
    const entries = fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const file = path.join(current, entry.name);
      if (entry.isSymbolicLink()) throw Error(`Symlinks are not accepted: ${file}`);
      if (entry.isDirectory()) visit(file);
      else if (!extensions || extensions.some(ext => entry.name.endsWith(ext))) {
        if (fileFilter && !fileFilter(file, entry.name)) continue;
        const real = fs.realpathSync(file);
        assertInside(root, real);
        out.push(real);
      }
    }
  };
  visit(dir);
  return out.sort((a, b) => a.localeCompare(b));
}

/** Public JSON basename: `index.yaml` → `INDEX.json`, `foo.yaml` → `foo.json`. */
export function publicJsonName(sourceBase) {
  const lower = sourceBase.toLowerCase();
  if (lower === 'index.yaml' || lower === 'index.json') return 'INDEX.json';
  if (lower.endsWith('.yaml')) return `${sourceBase.slice(0, -5)}.json`;
  if (lower.endsWith('.yml')) return `${sourceBase.slice(0, -4)}.json`;
  if (lower.endsWith('.json')) return sourceBase;
  throw Error(`Unsupported declarative source name: ${sourceBase}`);
}

export function stemKey(dirRoot, sourceFile) {
  const relative = path.relative(dirRoot, sourceFile).replaceAll('\\', '/');
  const dir = path.posix.dirname(relative);
  const base = path.posix.basename(relative);
  const lower = base.toLowerCase();
  let stem;
  if (lower === 'index.yaml' || lower === 'index.yml' || lower === 'index.json') stem = 'INDEX';
  else if (lower.endsWith('.yaml')) stem = base.slice(0, -5);
  else if (lower.endsWith('.yml')) stem = base.slice(0, -4);
  else if (lower.endsWith('.json')) stem = base.slice(0, -5);
  else stem = base;
  return dir === '.' ? stem : `${dir}/${stem}`;
}

export function outputRelative(dirRoot, sourceFile, outPrefix) {
  const relative = path.relative(dirRoot, sourceFile).replaceAll('\\', '/');
  const dir = path.posix.dirname(relative);
  const jsonName = publicJsonName(path.posix.basename(relative));
  const joined = dir === '.' ? jsonName : `${dir}/${jsonName}`;
  return `${outPrefix.replace(/\/?$/, '/')}${joined}`.replace(/^\//, '');
}
