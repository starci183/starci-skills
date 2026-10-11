// spec-pool.mjs - the spec files of a tree with their text: the pool every spec selection (the land gate, `starci test affected`) chooses from.
import fs from 'node:fs';
import path from 'node:path';

/** [{file, text}] for every spec file below tests/ in `dir` (repository-relative `file`, posix); an unreadable file has empty text, a tree without tests/ has no specs. */
export function readSpecs(dir) {
  const tests = path.join(dir, 'tests');
  let names;
  try { names = fs.readdirSync(tests, { recursive: true }).map((n) => String(n).split(path.sep).join('/')).filter((n) => n.endsWith('.spec.mjs')); } catch { return []; }
  return names.map((n) => ({ file: `tests/${n}`, text: readText(path.join(tests, n)) }));
}

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}
