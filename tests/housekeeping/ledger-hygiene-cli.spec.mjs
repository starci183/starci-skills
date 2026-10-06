import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openMachine, projectLedgerFile } from '../../engine/db/machine.mjs';
import { ledgerHygieneReport } from '../../scripts/housekeeping/ledger-hygiene.mjs';

const CLI = fileURLToPath(new URL('../../scripts/housekeeping/ledger-hygiene.mjs', import.meta.url));
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function sandbox(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-ledger-hygiene-cli-')));
  t.after(() => { try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* best effort */ } });
  return { root, env: { STARCI_LOCAL_ROOT: root } };
}

function makeLedger(env, { ledgerId, repoRoot }) {
  const file = projectLedgerFile(ledgerId, env);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'fixture');
  const m = openMachine({ env });
  try { m.registerLedger({ ledgerId, name: ledgerId, repoRoot, file }); } finally { m.close(); }
}

test('ledgerHygieneReport: clean state root is ok', async (t) => {
  const { env } = sandbox(t);
  makeLedger(env, { ledgerId: 'good-ledger', repoRoot: REPO_ROOT });
  const report = await ledgerHygieneReport({ env });
  assert.equal(report.ok, true);
  assert.deepEqual(report.orphans, []);
  assert.deepEqual(report.applied, []);
});

test('ledgerHygieneReport: an orphan ledger is reported; --apply archives it', async (t) => {
  const { env } = sandbox(t);
  const orphanRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-ledger-hygiene-cli-orphan-'));
  t.after(() => fs.rmSync(orphanRepo, { recursive: true, force: true }));
  makeLedger(env, { ledgerId: 'orphan-ledger', repoRoot: orphanRepo });
  const dry = await ledgerHygieneReport({ env });
  assert.equal(dry.ok, false);
  assert.equal(dry.orphans.length, 1);
  assert.equal(dry.orphans[0].ledgerId, 'orphan-ledger');
  assert.deepEqual(dry.applied, []);

  const applied = await ledgerHygieneReport({ env, apply: true });
  assert.equal(applied.orphans.length, 0, 'the orphan is archived, not reported again');
  assert.equal(applied.applied.length, 1);
  assert.equal(applied.applied[0].ledgerId, 'orphan-ledger');
  assert.equal(applied.ok, true);
});

test('CLI: --json prints the report shape and exits 1 on findings, 0 when clean, 2 on an unknown flag', (t) => {
  const { env } = sandbox(t);
  makeLedger(env, { ledgerId: 'good-ledger', repoRoot: REPO_ROOT });
  // Strip the ambient per-test-run isolation seams (tests/setup/isolated-registry.mjs) so the child's machine
  // registry resolution is decided by env.STARCI_LOCAL_ROOT alone, same as every in-process call in this file.
  const { STARCI_TEST_MACHINE_FILE, STARCI_PROJECTS_ROOT, ...baseEnv } = process.env;
  const run = (args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: { ...baseEnv, ...env } });

  const clean = run(['--json']);
  assert.equal(clean.status, 0, clean.stderr);
  const parsed = JSON.parse(clean.stdout);
  assert.equal(parsed.ok, true);

  const orphanRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-ledger-hygiene-cli-json-'));
  t.after(() => fs.rmSync(orphanRepo, { recursive: true, force: true }));
  makeLedger(env, { ledgerId: 'orphan-ledger', repoRoot: orphanRepo });
  const dirty = run(['--json']);
  assert.equal(dirty.status, 1);
  assert.equal(JSON.parse(dirty.stdout).orphans.length, 1);

  const bad = run(['--bogus']);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /unknown flag/);
});
