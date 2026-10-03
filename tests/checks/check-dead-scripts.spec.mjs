import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DYNAMIC_ROOTS, deadScriptFindings, checkDeadScripts } from '../../scripts/checks/check-dead-scripts.mjs';
import { ALLOWLIST_FILE } from '../../scripts/lib/allowlist.mjs';

/** An allowlist fixture document carrying only a dead-script-entries section of {path, reason} pairs. */
const allowlistWith = (entries) => `schema: starci/allowlist@1\ndead-script-entries:\n${entries.map(([path, reason]) => `  - {path: ${path}, reason: "${reason}"}`).join('\n')}\n`;

// RED18: a runtime script is alive only when something executable names it. A doc, README, YAML prose line, retired-paths
// entry, contract-change or benchmark finding is not a reader.
const run = (files) => deadScriptFindings({ tracked: Object.keys(files), read: (rel) => files[rel] ?? '' });
const codes = (findings) => findings.map((f) => [f.code, f.path]);

test('a script imported, spawned or run by a package script, a skill or a YAML executable key is alive', () => {
  assert.deepEqual(run({
    'scripts/lib/used.mjs': 'export const x = 1;',
    'scripts/checks/uses.mjs': "import { x } from '../lib/used.mjs';",
    'scripts/kernel/spawned.mjs': '',
    'scripts/gates/skill-run.mjs': '',
    'scripts/gates/yaml-run.mjs': '',
    'scripts/gates/yaml-cmd.mjs': '',
    'package.json': '{"scripts":{"check":"node scripts/checks/uses.mjs && node scripts/kernel/spawned.mjs"}}',
    'skills/x/SKILL.md': 'Run `node scripts/gates/skill-run.mjs --all`.\n',
    'modules/ops/ops/a.yaml': 'check: scripts/gates/yaml-run.mjs\nsteps:\n  - run: node scripts/gates/yaml-cmd.mjs\n',
  }), []);
});

test('a runtime check-only command and a catalog impl are executable readers', () => {
  assert.deepEqual(run({
    'scripts/checks/check-workflow.mjs': '',
    'scripts/checks/check-contract.mjs': '',
    'scripts/checks/check-skill.mjs': '',
    'scripts/checks/check-package.mjs': '',
    'scripts/checks/check-hook.mjs': '',
    'scripts/checks/check-npm-wrapper.mjs': '',
    'scripts/housekeeping/catalog-reader.mjs': '',
    '.github/workflows/checks.yml': 'steps:\n  - run: starci runtime check --only workflow\n  - run: npm run starci --silent -- runtime check --only npm-wrapper\n',
    'modules/ops/ops/contract.yaml': 'check: starci runtime check --only=contract\n',
    'skills/checks/SKILL.md': 'Run `starci runtime check --only skill`.\n',
    'package.json': '{"scripts":{"check:package":"starci runtime check --only package"}}',
    '.husky/pre-push': '#!/bin/sh\nstarci runtime check --only hook\n',
    'modules/cli/commands/runtime/catalog-reader.yaml': 'impl: {script: scripts/housekeeping/catalog-reader.mjs}\n',
  }), []);
});

test('a script named only by a doc, a README, YAML prose, retired-paths, a contract-change or a comment is dead', () => {
  const findings = run({
    'scripts/supervisor/why-gone.mjs': 'export const x = 1;',
    'scripts/work/gone-ui-shapes.mjs': '',
    'scripts/kernel/repair-gone-attempts.mjs': '',
    'scripts/kernel/commented.mjs': '',
    'scripts/checks/check-prose-only.mjs': '',
    'scripts/checks/check-commented-hook.mjs': '',
    'docs/why.md': 'Dry-run backfill: `node scripts/supervisor/why-gone.mjs`.\n',
    'README.md': 'see scripts/work/gone-ui-shapes.mjs\n',
    'modules/cli/commands/kernel/dispatch.yaml': 'reads: scripts/kernel/repair-gone-attempts.mjs seals the rest\n',
    'modules/ops/ops/prose.yaml': 'description: starci runtime check --only prose-only\n',
    '.husky/pre-commit': '# starci runtime check --only commented-hook\n',
    'modules/kernel/retired-paths.yaml': '  - {path: scripts/kernel/commented.mjs}\n',
    'modules/kernel/contract-changes/x.yaml': 'run: node scripts/kernel/commented.mjs\n',
    'scripts/lib/other.mjs': '// node scripts/kernel/commented.mjs\n/* scripts/kernel/commented.mjs */\n * scripts/kernel/commented.mjs\n',
    'package.json': '{}',
  });
  assert.deepEqual(codes(findings).filter(([, p]) => p !== 'scripts/lib/other.mjs'), [
    ['RT_DEAD_SCRIPT', 'scripts/supervisor/why-gone.mjs'], ['RT_DEAD_SCRIPT', 'scripts/work/gone-ui-shapes.mjs'],
    ['RT_DEAD_SCRIPT', 'scripts/kernel/repair-gone-attempts.mjs'], ['RT_DEAD_SCRIPT', 'scripts/kernel/commented.mjs'],
    ['RT_DEAD_SCRIPT', 'scripts/checks/check-prose-only.mjs'],
    ['RT_DEAD_SCRIPT', 'scripts/checks/check-commented-hook.mjs'],
  ]);
});

test('a script only a test names, or only itself or a generated copy names, is dead', () => {
  const findings = run({
    'scripts/checks/only-tested.mjs': 'export const y = 1;',
    'scripts/kernel/orphan.mjs': '',
    'scripts/kernel/self.mjs': "const me = 'scripts/kernel/self.mjs';",
    'tests/only-tested.spec.mjs': "import { y } from '../scripts/checks/only-tested.mjs';",
    'packages/hfs/runtime/scripts/lib/copy.mjs': "import '../../../../../scripts/kernel/orphan.mjs';",
  });
  assert.deepEqual(codes(findings).sort(), [['RT_DEAD_SCRIPT', 'scripts/checks/only-tested.mjs'], ['RT_DEAD_SCRIPT', 'scripts/kernel/orphan.mjs'], ['RT_DEAD_SCRIPT', 'scripts/kernel/self.mjs']]);
});

test('a directory the runtime loads by listing it is alive without a named reader', () => {
  assert.deepEqual(run({ 'scripts/kernel/verbs/enqueue.mjs': '', 'scripts/kernel/status/progress.mjs': '', 'scripts/reconciler/controllers/job.mjs': '' }), []);
  assert.deepEqual(codes(run({ 'scripts/kernel/other/enqueue.mjs': '' })), [['RT_DEAD_SCRIPT', 'scripts/kernel/other/enqueue.mjs']]);
});

test('a declared CLI entry is alive; an entry whose script is gone or that code now reads is stale', () => {
  assert.deepEqual(run({
    'scripts/checks/cli.mjs': '',
    [ALLOWLIST_FILE]: allowlistWith([['scripts/checks/cli.mjs', 'CLI run by the owner']]),
  }), []);
  assert.deepEqual(codes(run({
    'scripts/checks/gone.mjs': '',
    'scripts/checks/used.mjs': '',
    'scripts/lib/user.mjs': "import '../checks/used.mjs';",
    'package.json': '{"scripts":{"x":"node scripts/lib/user.mjs"}}',
    [ALLOWLIST_FILE]: allowlistWith([['scripts/checks/used.mjs', 'CLI'], ['scripts/checks/missing.mjs', 'CLI']]),
  })), [['RT_DEAD_SCRIPT', 'scripts/checks/gone.mjs'], ['RT_DEAD_ENTRY', 'scripts/checks/used.mjs'], ['RT_DEAD_ENTRY', 'scripts/checks/missing.mjs']]);
});

test('each dynamic root names a loader that still lists it, and this runtime has no dead script', () => {
  const root = path.resolve(import.meta.dirname, '..', '..');
  for (const [dir, loader] of Object.entries(DYNAMIC_ROOTS)) {
    const file = loader.split(' ')[0];
    assert.ok(fs.existsSync(path.join(root, file)), `${dir}: loader ${file} exists`);
    assert.ok(fs.existsSync(path.join(root, dir)), `${dir} exists`);
  }
  assert.deepEqual(checkDeadScripts(root), []);
});
