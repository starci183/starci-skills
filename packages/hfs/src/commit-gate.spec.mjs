// The commit gate of an app: the hooks folder core.hooksPath names is installed in the checkout (HFS_HOOKS_NOT_INSTALLED, the
// app check), and the staged run of `starci app hygiene` refuses a new measured back-end logic file without its unit spec
// (BE_UNIT_SPEC_NOT_STAGED), naming the file.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkAppRoot } from '../runtime/scripts/hfs/architecture/hfs.mjs';
import { openHfs } from '../runtime/scripts/hfs/slots.mjs';
import { runWorkHygiene } from '../sync/hygiene.mjs';
import { starterDeclaration } from '../scaffold/app.mjs';

/** The lite app declaration the package's own scaffold writes: the package proof carries no examples/ tree. */
const APP_DECLARATION = `${JSON.stringify(starterDeclaration('fixture', undefined, 'lite'), null, 2)}\n`;
const gitEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
const git = (cwd, ...args) => {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8', env: gitEnv, windowsHide: true });
  assert.equal(run.status, 0, `git ${args.join(' ')}: ${run.stderr}`);
};

/** A fresh app repository: git initialised on main, the scaffold's lite app declaration at its root. */
function appRepo(t, prefix) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(root, 'hfs.json'), APP_DECLARATION);
  return root;
}

const write = (root, file, text = '') => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
};

test('HFS_HOOKS_NOT_INSTALLED: a set core.hooksPath naming a missing or dispatcher-less husky folder is an app-check error', (t) => {
  const root = appRepo(t, 'hfs-hooks-');
  const hooks = () => checkAppRoot({ root, resolver: openHfs({ repoRoot: root }) }).violations.filter((v) => v.ruleId.startsWith('HFS_HOOKS'));
  assert.deepEqual(hooks(), [], 'an unset core.hooksPath (a CI checkout) is not judged');
  git(root, 'config', 'core.hooksPath', '.husky/_');
  const missing = hooks();
  assert.deepEqual(missing.map((v) => v.ruleId), ['HFS_HOOKS_NOT_INSTALLED']);
  assert.match(missing[0].message, /does not exist/);
  assert.match(missing[0].message, /starci npm ci/);
  write(root, '.husky/_/.gitignore', '*\n');
  write(root, '.husky/_/pre-commit', '#!/bin/sh\n');
  assert.match(hooks()[0]?.message ?? '', /holds no installed hook/, 'a folder without husky\'s dispatcher h runs no tracked hook');
  write(root, '.husky/_/h', '#!/usr/bin/env sh\n');
  assert.deepEqual(hooks(), [], 'husky\'s generated folder with its dispatcher is installed');
});

test('BE_UNIT_SPEC_NOT_STAGED: the staged hygiene run refuses a new measured logic file without its spec and names it', async (t) => {
  const root = appRepo(t, 'hfs-staged-spec-');
  const lines = [];
  const hygiene = async () => { lines.length = 0; return runWorkHygiene({ cwd: root, out: (line) => lines.push(line) }); };
  const policy = 'be/src/modules/domain/order/order.policy.ts';
  write(root, policy, 'export const allowed = (amount) => amount > 0;\n');
  write(root, 'be/src/features/order/order.handler.ts', 'export const handler = 1;\n');
  git(root, 'add', '-A');
  assert.equal(await hygiene(), 1);
  const findings = lines.filter((line) => line.startsWith('BE_UNIT_SPEC_NOT_STAGED'));
  assert.equal(findings.length, 1, 'a thin feature file owes no unit spec');
  assert.match(findings[0], new RegExp(`^BE_UNIT_SPEC_NOT_STAGED ${policy} .*order\\.policy\\.spec\\.ts`));
  write(root, 'be/src/modules/domain/order/order.policy.spec.ts', 'it("allows", () => undefined);\n');
  git(root, 'add', '-A');
  assert.equal(await hygiene(), 0, lines.join('\n'));
});

test('BE_UNIT_SPEC_NOT_STAGED owes no spec for a measured file with nothing to execute (constants and types only)', async (t) => {
  const root = appRepo(t, 'hfs-staged-constants-');
  write(root, 'be/src/modules/domain/order/order-status.policy.ts', 'export type Status = "open" | "paid";\nexport const STATUS_CODE: Readonly<Record<Status, number>> = { open: 1, paid: 2 };\n');
  git(root, 'add', '-A');
  const lines = [];
  assert.equal(await runWorkHygiene({ cwd: root, out: (line) => lines.push(line) }), 0, lines.join('\n'));
});

test('BE_UNIT_SPEC_NOT_STAGED is judged only at an HFS app root', async (t) => {
  const root = appRepo(t, 'hfs-staged-nonapp-');
  fs.rmSync(path.join(root, 'hfs.json'));
  write(root, 'be/src/modules/domain/order/order.service.ts', 'export class OrderService {}\n');
  git(root, 'add', '-A');
  assert.equal(await runWorkHygiene({ cwd: root, out: () => undefined }), 0);
});
