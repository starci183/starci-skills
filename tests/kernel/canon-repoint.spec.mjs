// The repoint unit (DESIGN §16.7, FMEA #20; scripts/kernel/seam-policy.mjs canonCutPlanOf + scripts/kernel/import-scan.mjs).
// fe-canon: slice 1 moved apps/app/src/i18n/request.ts into modules/i18n and 26 files still imported the old
// `@/i18n` paths - owned by nobody, the breakage surfaced as a sibling's checker "unavailable". A wave that moves code
// now gets ONE canon-wire unit owning EVERY importer of the moved paths (tsconfig aliases included), --after every
// slice of the wave, briefed "repoint imports to the new locations; no other change"; the invariant
// IMPORTS_BROKEN_AFTER_MOVE reads what is still broken.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { canonCutPlanOf, REPOINT_BRIEF } from '../../scripts/kernel/seam-policy.mjs';
import { importersOf, brokenImports, specifiersOf, matchAlias } from '../../scripts/kernel/import-scan.mjs';

const SRC = 'apps/app/src';
const shells = `${SRC}/components/product-shells`;
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
const git = (cwd, ...args) => { const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };

function repoFixture(t) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-repoint-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  git(repo, 'init', '-q', '-b', 'main');
  write(repo, 'apps/app/tsconfig.json', '{\n  // the app alias\n  "compilerOptions": {"baseUrl": ".", "paths": {"@/*": ["./src/*"]},},\n}\n');
  write(repo, `${SRC}/i18n/request.ts`, 'export const locale = "vi";\n');
  write(repo, `${SRC}/app/layout.tsx`, 'import { locale } from "@/i18n/request";\nexport default locale;\n');
  write(repo, `${SRC}/app/page.tsx`, 'export { locale } from "@/i18n/request";\n');
  write(repo, `${SRC}/middleware.ts`, 'import { locale } from "./i18n/request";\nexport const m = locale;\n');
  write(repo, `${SRC}/unrelated.ts`, 'import React from "react";\nexport const r = React;\n');
  write(repo, `${shells}/Sidebar/component.tsx`, 'export const Sidebar = 1;\n');
  write(repo, `${SRC}/app/(console)/layout.tsx`, 'import { Sidebar } from "@/components/product-shells/Sidebar/component";\nexport default Sidebar;\n');
  write(repo, `${SRC}/components/blocks/nav.tsx`, 'import { Sidebar } from "../product-shells/Sidebar/component";\nexport const n = Sidebar;\n');
  write(repo, `${SRC}/components/blocks/menu.tsx`, 'const s = await import("@/components/product-shells/Sidebar/component");\nexport const m = s;\n');
  git(repo, 'add', '-A');
  return repo;
}

test('importersOf: a moved file\'s importers through the tsconfig alias and relative paths, bare packages never', (t) => {
  const repo = repoFixture(t);
  assert.deepEqual(importersOf(repo, [`${SRC}/i18n/request.ts`]), [`${SRC}/app/layout.tsx`, `${SRC}/app/page.tsx`, `${SRC}/middleware.ts`]);
  assert.deepEqual(importersOf(repo, [`${SRC}/i18n`]), [`${SRC}/app/layout.tsx`, `${SRC}/app/page.tsx`, `${SRC}/middleware.ts`], 'a moved directory counts every file under it');
  assert.equal(matchAlias('@/*', '@/i18n/request'), 'i18n/request');
  assert.deepEqual(specifiersOf('import a from "x";\nexport * from \'./y\';\nconst z = require("z");\nvi.mock("@/m");'), ['x', './y', 'z', '@/m']);
});

test('a wave moving code gets ONE wire unit owning every importer, --after every slice of the wave', (t) => {
  const repo = repoFixture(t);
  const scan = {
    schema: 'starci/canon-findings@1', repository: repo,
    slices: [
      { ordinal: 1, wave: 'shared', paths: [`${shells}/Sidebar`] },
      { ordinal: 2, wave: 'shared', paths: [`${SRC}/components/blocks/sales`] },
      { ordinal: 3, wave: 'surfaces', paths: [`${SRC}/components/blocks/other`] },
    ],
    findings: [{ machine: 'eslint', ruleId: 'FE_SOURCE_LAYOUT_INVALID', family: 'layout', file: `${shells}/Sidebar/component.tsx`, line: 1 }],
  };
  const plan = canonCutPlanOf(scan, { cutId: 'fe-canon', importersOf: (moved) => importersOf(repo, moved) });
  const wires = plan.wires.filter((w) => w.wave === 'shared');
  assert.equal(wires.length, 1, 'ONE wire per wave');
  const [wire] = wires;
  const importers = [`${SRC}/app/(console)/layout.tsx`, `${SRC}/components/blocks/menu.tsx`, `${SRC}/components/blocks/nav.tsx`];
  assert.deepEqual(wire.repoint.importers, importers);
  for (const file of importers) assert.ok(wire.paths.includes(file), `the wire owns importer ${file}`);
  assert.ok(wire.repoint.moved.includes(`${shells}/Sidebar/component.tsx`));
  assert.deepEqual(wire.after, [1, 2], '--after every slice of the wave');
  assert.equal(wire.brief, REPOINT_BRIEF);
  assert.equal(REPOINT_BRIEF, 'repoint imports to the new locations; no other change');
  const command = plan.commands.find((c) => c.includes('"canonWire":true') && c.includes('ordinals 1,2'));
  assert.match(command, /ONE canon-wire leg; repoint imports to the new locations; no other change\)$/);
  assert.ok(!plan.wires.some((w) => w.wave === 'surfaces'), 'a wave that moves nothing gets no wire');
  // Without an importer resolver the plan is the one it always was.
  assert.ok(!canonCutPlanOf(scan, { cutId: 'fe-canon' }).wires.some((w) => w.repoint));
});

test('IMPORTS_BROKEN_AFTER_MOVE: after the move lands, the unrepointed importers are exactly what the scan reports', (t) => {
  const repo = repoFixture(t);
  assert.equal(brokenImports(repo).count, 0);
  fs.mkdirSync(path.join(repo, SRC, 'modules', 'i18n'), { recursive: true });
  git(repo, 'mv', `${SRC}/i18n/request.ts`, `${SRC}/modules/i18n/request.ts`);
  const broken = brokenImports(repo);
  assert.equal(broken.count, 3);
  assert.deepEqual(broken.broken.map((b) => b.from).sort(), [`${SRC}/app/layout.tsx`, `${SRC}/app/page.tsx`, `${SRC}/middleware.ts`]);
  // The repoint: the wire rewrites the specifiers, nothing else.
  for (const f of [`${SRC}/app/layout.tsx`, `${SRC}/app/page.tsx`]) write(repo, f, fs.readFileSync(path.join(repo, f), 'utf8').replace('@/i18n/request', '@/modules/i18n/request'));
  write(repo, `${SRC}/middleware.ts`, fs.readFileSync(path.join(repo, SRC, 'middleware.ts'), 'utf8').replace('./i18n/request', './modules/i18n/request'));
  assert.equal(brokenImports(repo).count, 0, 'the invariant is clean again');
});

test('RCA: a checker failing on an unresolved import is broken-import (not checker-unavailable), and the repoint unit is ranked first', async () => {
  const { causesOf, actionsOf, CAUSES } = await import('../../scripts/kernel/progress-rca.mjs');
  assert.equal(CAUSES['broken-import'].authority, 'kernel');
  const report = { outcome: 'blocked', blocker: { kind: 'environment', detail: 'gate.mjs exit 2: TS2307 Cannot find module "@/i18n/request"' } };
  assert.deepEqual(causesOf({ status: 'failed', report }), ['broken-import']);
  assert.equal(causesOf({ status: 'failed', report: { outcome: 'blocked', blocker: { kind: 'environment', detail: 'checker is unavailable (exit 3)' } } })[0], 'checker-unavailable');
  const importsBroken = { count: 26, files: 3, repointQueued: false, brokenFiles: ['todo-app-fe/apps/app/src/a.ts', 'todo-app-fe/apps/app/src/b.ts', 'todo-app-fe/apps/app/src/c.ts'] };
  const units = [{ key: 'u1', op: 'code.refactor', state: 'open', open: [], jobs: [{ job_id: 'op-next-1', status: 'queued' }] }];
  const progress = { queuedReady: 1, running: 1, allowedParallel: 3 };
  const acts = actionsOf({ progress, rca: { clusters: [] }, units, workflowId: 'wf-x', repo: 'r', importsBroken });
  assert.equal(acts[0].cause, 'broken-import', 'ranked above dispatching more units into broken imports');
  assert.ok(acts[0].command.endsWith('graph-edit --repo r --workflow wf-x --edit wire --op code.refactor --paths "todo-app-fe/apps/app/src/a.ts,todo-app-fe/apps/app/src/b.ts,todo-app-fe/apps/app/src/c.ts" --before op-next-1 --decision <id>'), acts[0].command);
  assert.ok(!actionsOf({ progress, rca: { clusters: [] }, units, workflowId: 'wf-x', importsBroken: { ...importsBroken, repointQueued: true } }).some((a) => a.cause === 'broken-import'), 'a queued repoint is not asked for twice');
});
