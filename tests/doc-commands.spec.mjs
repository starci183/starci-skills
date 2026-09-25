import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Every `starci <verb>` an agent or owner is told to run is a route bin/starci.mjs serves.
const ROOT = path.resolve(import.meta.dirname, '..');
const routes = () => {
  const source = fs.readFileSync(path.join(ROOT, 'bin', 'starci.mjs'), 'utf8');
  const block = /const ROUTES = \{([\s\S]*?)\};/.exec(source)[1];
  return new Set([...block.matchAll(/^\s*([a-z-]+):/gm)].map((m) => m[1]).concat(['help']));
};
const walk = (dir, ext) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p, ext) : ext.some((x) => e.name.endsWith(x)) ? [p] : [];
});
// docs/brand-checks.md belongs to another fix lane (its `starci render check` is listed there).
const PENDING = new Set(['docs/brand-checks.md']);

test('docs, skills and op contracts name only starci verbs bin/starci.mjs routes', () => {
  const known = routes();
  const files = [
    ...walk(path.join(ROOT, 'docs'), ['.md']), ...walk(path.join(ROOT, 'skills'), ['.md']),
    ...walk(path.join(ROOT, 'modules', 'ops'), ['.yaml']),
    path.join(ROOT, 'README.md'), path.join(ROOT, 'CONTEXT.md'),
  ];
  const bad = [];
  for (const file of files) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    if (PENDING.has(rel)) continue;
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/(?:`|^\s*|\b(?:[Rr]un|[Ee]xecute)\s+)starci ([a-z][a-z-]*)\b/g)) {
        if (!known.has(m[1])) bad.push(`${rel}:${i + 1} starci ${m[1]}`);
      }
    });
  }
  assert.deepEqual(bad, []);
});
