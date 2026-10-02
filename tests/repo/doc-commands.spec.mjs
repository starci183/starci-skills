import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CATALOG } from '../../packages/cli/src/catalog.generated.mjs';

// Every `starci <group> <verb>` an agent or owner is told to run exists in the generated command catalog.
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const walk = (dir, ext) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p, ext) : ext.some((x) => e.name.endsWith(x)) ? [p] : [];
});
const PENDING = new Set();

test('docs, skills and op contracts name only generated starci groups and verbs', () => {
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
      if (/^\s*Removed spellings:/i.test(line)) return;
      for (const m of line.matchAll(/(?:`|^\s*|\b(?:[Rr]un|[Ee]xecute)\s+)starci\s+([a-z][a-z-]*)\s+([a-z][a-z-]*)\b/g)) {
        const [, group, verb] = m;
        if (!CATALOG.groups?.[group]?.verbs?.[verb]) bad.push(`${rel}:${i + 1} starci ${group} ${verb}`);
      }
    });
  }
  assert.deepEqual(bad, []);
});
