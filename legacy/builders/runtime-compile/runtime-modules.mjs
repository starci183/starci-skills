import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertInside, assertSafeRelative, readRealFile } from './paths.mjs';

const listPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../runtime-modules.txt');

/** Relative skill-root paths of executable modules mirrored into `.dist`. */
export function runtimeModuleList(skillRoot) {
  if (!fs.existsSync(listPath)) return [];
  const text = fs.readFileSync(listPath, 'utf8');
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const out = [];
  for (const line of lines) {
    const relative = assertSafeRelative(line, 'runtime module');
    if (!relative.endsWith('.mjs')) throw Error(`Runtime module must be .mjs: ${relative}`);
    const abs = path.join(skillRoot, relative);
    if (!fs.existsSync(abs)) throw Error(`Missing runtime module source: ${relative}`);
    readRealFile(abs, skillRoot);
    out.push(relative);
  }
  return [...new Set(out)].sort((a, b) => a.localeCompare(b));
}

/** Copy listed modules into the dist file map (raw bytes, not JSON). */
export function collectRuntimeModules(skillRoot, files) {
  for (const relative of runtimeModuleList(skillRoot)) {
    if (files.has(relative)) throw Error(`Output collision for runtime module ${relative}`);
    const abs = path.join(skillRoot, relative);
    const { bytes } = readRealFile(abs, skillRoot);
    assertInside(skillRoot, abs);
    files.set(relative, bytes);
  }
  return files;
}
