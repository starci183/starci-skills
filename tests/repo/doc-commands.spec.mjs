import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Every `starci <verb>` an agent or owner is told to run is a route bin/starci.mjs serves: `starci help` prints
// the served verb list, and an unknown verb is refused — the CLI's own output is the route authority.
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const BIN = path.join(ROOT, 'bin', 'starci.mjs');
const routes = () => {
  const help = spawnSync(process.execPath, [BIN, 'help'], { encoding: 'utf8', windowsHide: true, timeout: 30_000 });
  assert.equal(help.status, 0, help.stderr);
  const verbs = new Set([...help.stdout.matchAll(/\bstarci ([a-z][a-z-]*)\b/g)].map((m) => m[1]).filter((v) => !['x', 'run'].includes(v)));
  for (const v of ['init', 'update', 'doctor', 'version', 'api', 'start', 'goal', 'validate', 'check', 'help']) assert.ok(verbs.has(v), `starci help names ${v}`);
  const bad = spawnSync(process.execPath, [BIN, 'definitely-not-a-verb'], { encoding: 'utf8', windowsHide: true, timeout: 30_000 });
  assert.notEqual(bad.status, 0, 'an unknown verb is refused');
  assert.match(`${bad.stdout}${bad.stderr}`, /unknown command/);
  return verbs;
};
const walk = (dir, ext) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p, ext) : ext.some((x) => e.name.endsWith(x)) ? [p] : [];
});
const PENDING = new Set();

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
